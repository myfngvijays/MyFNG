/**
 * Tool/Function Definitions for LLM Chatbot
 * These are the functions the LLM can call to interact with the system
 */

import { getPricing, getWorkshops, getCityByPincode, getServicePlansByPincode, resolveVehicleClassFromModelName } from './database-queries';
import { saveBooking } from './booking';
import {
  isPhoneVerifiedInSession,
  markPhoneVerifiedInSession,
  normalizeBookingOtp,
  normalizeBookingPhone,
  sendBookingOtpForPhone,
  verifyBookingOtpForPhone,
} from './bookingOtp';
import { getServiceChecklist } from './checklist-queries';
import type { MisaBookingChannel } from './misaLeadSource';
import type { SessionData } from './session';
import { isValidVehicleNumber, normalizeVehicleNumber } from './vehicleNumber';
import {
  getVerifiedPhoneFromSession,
  getVehicleNumberFromSession,
  isPricingAllowedInSession,
  setVehicleNumberInSession,
} from './verificationSession';
import {
  isPremiumLuxuryClass,
  PREMIUM_LUXURY_PRICING_MESSAGE,
} from '../vehicleClassPricing';
import {
  mergePricingPlans,
  resolveMisaServicesPricing,
} from './misa-service-pricing';

function rememberPricingInSession(session: SessionData | undefined, plans: Array<Record<string, unknown>>, context: {
  service_category?: string;
  car_model?: string;
  pincode?: string;
  city?: string;
}) {
  if (!session || !plans.length) return;
  const existing = Array.isArray(session.lastShownPlans) ? session.lastShownPlans : [];
  session.lastShownPlans = mergePricingPlans(existing, plans);
  session.bookingState = session.bookingState || {};
  session.bookingState.pricingShown = true;
  if (context.service_category) session.bookingState.category = context.service_category;
  if (context.car_model) session.bookingState.carModel = context.car_model;
  if (context.pincode) session.bookingState.pincode = context.pincode;
  if (context.city) session.bookingState.city = context.city;
}

/**
 * OpenAI Function/Tool Schemas
 */
export const CHATBOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_service_pricing',
      description:
        "Get pricing information for a specific car service. ONLY call after mobile OTP is verified (verify_booking_otp). Requires service category, car model, and PIN code collected first.",
      parameters: {
        type: 'object',
        properties: {
          service_category: {
            type: 'string',
            description:
              "Service category. Must be one of: 'Car Periodic Service', 'Car AC Service', 'Car Battery Service', 'Car Brake Service', 'Car Clutch Service', 'Car Denting & Painting', 'Car Detailing Service', 'Car Engine Service', 'Car Tyre & Wheel Care', 'Electrical & Battery Service', 'Suspension & Steering Service'",
            enum: [
              'Car Periodic Service',
              'Car AC Service',
              'Car Battery Service',
              'Car Brake Service',
              'Car Clutch Service',
              'Car Denting & Painting',
              'Car Detailing Service',
              'Car Engine Service',
              'Car Tyre & Wheel Care',
              'Electrical & Battery Service',
              'Suspension & Steering Service',
            ],
          },
          car_model: {
            type: 'string',
            description: "Car model (e.g., 'Swift', 'City', 'Creta', 'WagonR')",
          },
          pincode: {
            type: 'string',
            description: '6-digit PIN code for location-specific pricing. Prefer this over city if available.',
            pattern: '^[0-9]{6}$',
          },
          city: {
            type: 'string',
            description: "City name (e.g., 'Mumbai', 'Pune', 'Thane'). Use only if PIN code is not available.",
          },
        },
        required: ['service_category', 'car_model'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_workshops',
      description:
        'Search for workshops by PIN code. Use this when user asks about workshop locations or wants to see available workshops.',
      parameters: {
        type: 'object',
        properties: {
          pincode: {
            type: 'string',
            description: '6-digit PIN code to search workshops',
            pattern: '^[0-9]{6}$',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of workshops to return (default: 5)',
            default: 5,
          },
        },
        required: ['pincode'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_service_details',
      description:
        "Get detailed checklist/description of what's included in a specific service. Use when user asks 'what's included' or wants service details.",
      parameters: {
        type: 'object',
        properties: {
          service_name: {
            type: 'string',
            description: "Service name (e.g., 'Basic Service', 'General Service', 'Battery Charging')",
          },
        },
        required: ['service_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_customer_name',
      description:
        'Save the customer\'s real name as soon as they share it (after "What\'s your name?"). Call immediately — do not wait for create_booking. Replaces placeholder names like Customer_1234 on the CRM lead.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: {
            type: 'string',
            description: "Customer's real full name (e.g. Nikhil, Rahul Sharma)",
          },
          phone_number: {
            type: 'string',
            description: 'Optional 10-digit phone if already known/verified',
            pattern: '^[0-9]{10}$',
          },
        },
        required: ['customer_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_vehicle_number',
      description:
        'Save and validate the customer car registration number. Call ONLY at the end of booking flow, just before showing booking summary and create_booking — NOT before pricing.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_number: {
            type: 'string',
            description: "Customer's car registration number (e.g. DL01AB1234, MH12AB1234)",
          },
        },
        required: ['vehicle_number'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'set_preferred_schedule',
      description:
        'Save the customer preferred service date and/or pickup time as soon as they share it. Call immediately — do not wait for create_booking. Date as YYYY-MM-DD when possible; time like 10 AM or 14:00.',
      parameters: {
        type: 'object',
        properties: {
          preferred_date: {
            type: 'string',
            description: 'Preferred service date (YYYY-MM-DD, tomorrow, or 7 September)',
          },
          preferred_time: {
            type: 'string',
            description: "Preferred pickup time (e.g. '10 AM', '2 PM', '14:00')",
          },
          phone_number: {
            type: 'string',
            description: 'Optional 10-digit phone if already known/verified',
            pattern: '^[0-9]{10}$',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_booking_otp',
      description:
        'Send a 6-digit OTP on WhatsApp to verify the customer mobile number. Call ONLY after service type, car model, and PIN code are collected — immediately before showing pricing.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: "Customer's 10-digit mobile number to verify",
            pattern: '^[0-9]{10}$',
          },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'verify_booking_otp',
      description:
        'Verify the 6-digit OTP entered by the customer. Must be called after send_booking_otp succeeds. Booking cannot proceed until this returns verified=true.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: {
            type: 'string',
            description: "Same 10-digit phone number used in send_booking_otp",
            pattern: '^[0-9]{10}$',
          },
          otp: {
            type: 'string',
            description: '6-digit OTP from customer',
            pattern: '^[0-9]{6}$',
          },
        },
        required: ['phone_number', 'otp'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_booking',
      description:
        'Create a new service booking. ONLY call after phone OTP is verified (verify_booking_otp succeeded). Requires vehicle registration number, service, car model, customer name, verified phone, address, preferred date, and preferred time.',
      parameters: {
        type: 'object',
        properties: {
          session_id: {
            type: 'string',
            description: 'Session ID for this conversation',
          },
          service_name: {
            type: 'string',
            description: "Selected service name (e.g., 'Basic Service', 'Battery Charging')",
          },
          service_category: {
            type: 'string',
            description: 'Service category',
          },
          car_model: {
            type: 'string',
            description: "Customer's car model",
          },
          vehicle_number: {
            type: 'string',
            description: "Customer's car registration number (e.g. DL01AB1234)",
          },
          customer_name: {
            type: 'string',
            description: "Customer's full name",
          },
          phone_number: {
            type: 'string',
            description: "Customer's verified 10-digit phone number",
            pattern: '^[0-9]{10}$',
          },
          address: {
            type: 'string',
            description: 'Complete pickup address including house/flat, society, landmark, and PIN code',
          },
          city: {
            type: 'string',
            description: 'City name',
          },
          pincode: {
            type: 'string',
            description: '6-digit PIN code',
            pattern: '^[0-9]{6}$',
          },
          preferred_date: {
            type: 'string',
            description: 'Preferred service date in YYYY-MM-DD format',
          },
          preferred_time: {
            type: 'string',
            description: "Preferred pickup time (e.g., '10 AM', '2 PM')",
          },
          quoted_price: {
            type: 'number',
            description:
              'Total quoted price in INR. For multiple services, pass the sum of all selected service prices.',
          },
          workshop_name: {
            type: 'string',
            description: 'Selected workshop name (optional)',
          },
        },
        required: [
          'session_id',
          'service_name',
          'service_category',
          'car_model',
          'vehicle_number',
          'customer_name',
          'phone_number',
          'address',
          'preferred_date',
          'preferred_time',
        ],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'validate_pincode',
      description: 'Validate if a PIN code is in our service area and get the city name. Use this before showing pricing or workshops.',
      parameters: {
        type: 'object',
        properties: {
          pincode: {
            type: 'string',
            description: '6-digit PIN code to validate',
            pattern: '^[0-9]{6}$',
          },
        },
        required: ['pincode'],
      },
    },
  },
];

/**
 * Tool Execution Handler
 * Executes the actual function calls when LLM requests them
 */
export async function executeToolCall(
  toolName: string,
  args: any,
  opts?: {
    bookingChannel?: MisaBookingChannel;
    sessionId?: string;
    sessionData?: SessionData;
    dryRun?: boolean;
    channelPhone?: string;
  },
): Promise<any> {
  console.log(`[TOOL] Executing: ${toolName}`, args);

  try {
    switch (toolName) {
      case 'get_service_pricing': {
        const session = opts?.sessionData;

        if (!isPricingAllowedInSession(session)) {
          const verifiedPhone = getVerifiedPhoneFromSession(session);
          return {
            success: false,
            blocked_reason: verifiedPhone ? 'PHONE_NOT_VERIFIED' : 'PHONE_OTP_REQUIRED',
            message: verifiedPhone
              ? 'Mobile OTP verification is pending. Call verify_booking_otp with the 6-digit code.'
              : 'Mobile OTP verification is required before showing pricing. First collect service, car model, and PIN code, then collect mobile, call send_booking_otp, and verify_booking_otp.',
          };
        }

        const { service_category, car_model, pincode, city } = args;

        // Prefer PIN code-based pricing
        if (pincode) {
          const plans = await getServicePlansByPincode({
            category: service_category,
            carModel: car_model,
            pincode: pincode,
          });

          if (plans.length > 0 && !(plans[0] as any).error) {
            // Sort by price
            const sorted = plans.sort((a: any, b: any) => a.min_price - b.min_price);
            const pricing = sorted.map((p: any) => ({
              service_name: p.service_name,
              min_price: p.min_price,
              max_price: p.max_price,
              description: p.description,
              service_type_id: p.service_type_id || null,
              points: typeof p.points === 'number' ? p.points : null,
              checklist_count: Array.isArray(p.checklist_items) ? p.checklist_items.length : 0,
              checklist_items: Array.isArray(p.checklist_items) ? p.checklist_items : [],
            }));
            rememberPricingInSession(session, pricing, {
              service_category,
              car_model,
              pincode,
              city,
            });
            return {
              success: true,
              pricing,
              plan_count: sorted.length,
              instruction: `List ALL ${sorted.length} service plans returned. Do not show only 3.`,
              location: `PIN ${pincode}`,
            };
          } else if (plans.length > 0 && (plans[0] as any).error) {
            const planError = plans[0] as any;
            return {
              success: false,
              error: planError.error,
              message: planError.message,
            };
          } else if (plans.length === 0 && car_model) {
            const vehicleClass = await resolveVehicleClassFromModelName(car_model);
            if (isPremiumLuxuryClass(vehicleClass)) {
              return {
                success: false,
                error: 'PREMIUM_LUXURY_NO_PRICING',
                message: PREMIUM_LUXURY_PRICING_MESSAGE,
              };
            }
          }
        }

        // Fallback to city-based pricing
        if (city) {
          if (car_model) {
            const vehicleClass = await resolveVehicleClassFromModelName(car_model);
            if (isPremiumLuxuryClass(vehicleClass)) {
              return {
                success: false,
                error: 'PREMIUM_LUXURY_NO_PRICING',
                message: PREMIUM_LUXURY_PRICING_MESSAGE,
              };
            }
          }

          const pricing = await getPricing({
            service: service_category,
            city: city,
            carModel: car_model,
            limit: 5,
          });

          if (pricing.length > 0) {
            const mappedPricing = pricing.map((p: any) => ({
              workshop_name: p.workshop_name,
              service_name: p.service_name,
              min_price: p.custom_price || p.price,
              max_price: p.custom_price || p.price,
              price: p.custom_price || p.price,
              city: p.workshop_city,
            }));
            rememberPricingInSession(session, mappedPricing, {
              service_category,
              car_model,
              pincode,
              city,
            });
            return {
              success: true,
              pricing: mappedPricing,
              location: city,
            };
          }
        }

        return {
          success: false,
          message: 'No pricing found for the specified service and location.',
        };
      }

      case 'search_workshops': {
        const { pincode, limit = 5 } = args;

        const workshops = await getWorkshops({
          city: pincode,
          limit: limit,
        });

        if (workshops.length > 0) {
          return {
            success: true,
            workshops: workshops.map((w: any) => ({
              id: String(w.id || ''),
              name: w.workshop_name || w.name,
              address: w.short_address || w.address,
              city: w.city,
              pincode: w.pincode,
              phone: '9152307030',
              working_time: w.working_time,
              map_link: w.near_area_google_map || w.map_link || null,
            })),
          };
        } else {
          return {
            success: false,
            message: `No workshops found for PIN code ${pincode}. We currently operate in Mumbai, Thane, Pune, and Navi Mumbai.`,
          };
        }
      }

      case 'get_service_details': {
        const { service_name } = args;

        const checklist = await getServiceChecklist(service_name);

        if (checklist && checklist.length > 0) {
          return {
            success: true,
            service_name: service_name,
            checklist: checklist,
          };
        } else {
          return {
            success: false,
            message: 'Detailed checklist will be provided by our team when you book the service.',
          };
        }
      }

      case 'set_customer_name': {
        const customerName = String(args.customer_name || '').trim();
        const phone =
          normalizeBookingPhone(args.phone_number) ||
          normalizeBookingPhone(opts?.sessionData?.bookingState?.phoneNumber) ||
          normalizeBookingPhone(getVerifiedPhoneFromSession(opts?.sessionData)) ||
          normalizeBookingPhone(opts?.channelPhone);

        if (customerName.length < 2 || /^customer_/i.test(customerName)) {
          return {
            success: false,
            message: 'Please ask for their real name (not a placeholder).',
          };
        }

        if (opts?.sessionData) {
          opts.sessionData.bookingState = {
            ...(opts.sessionData.bookingState || {}),
            customerName,
          };
        }

        if (phone.length === 10) {
          try {
            const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
            const { updateLeadCustomerNameByPhone } = await import('@/lib/service-lead-reopen');
            const { supabaseAdmin } = getSupabaseAdmin();
            if (supabaseAdmin) {
              await updateLeadCustomerNameByPhone(supabaseAdmin, phone, customerName);
            }
          } catch (err) {
            console.warn('[TOOL] set_customer_name lead update failed', err);
          }
        }

        return {
          success: true,
          customer_name: customerName,
          message: 'Customer name saved. Continue with address / next booking question.',
        };
      }

      case 'set_vehicle_number': {
        if (!opts?.sessionData) {
          return { success: false, message: 'Session unavailable. Please try again.' };
        }

        const result = setVehicleNumberInSession(opts.sessionData, args.vehicle_number);
        if (!result.ok) {
          return { success: false, message: result.message };
        }

        if (opts.sessionData.bookingState) {
          opts.sessionData.bookingState.vehicleNumber = result.vehicleNumber;
        }

        return {
          success: true,
          vehicle_number: result.vehicleNumber,
          message:
            'Vehicle number saved. Include it in the booking summary and proceed to create_booking after user confirms.',
        };
      }

      case 'set_preferred_schedule': {
        const preferredDate = String(args.preferred_date || '').trim();
        const preferredTime = String(args.preferred_time || '').trim();
        if (!preferredDate && !preferredTime) {
          return { success: false, message: 'Need a date or a time to save the schedule.' };
        }

        const phone =
          normalizeBookingPhone(args.phone_number) ||
          normalizeBookingPhone(opts?.sessionData?.bookingState?.phoneNumber) ||
          normalizeBookingPhone(getVerifiedPhoneFromSession(opts?.sessionData)) ||
          normalizeBookingPhone(opts?.channelPhone);

        if (opts?.sessionData) {
          opts.sessionData.bookingState = {
            ...(opts.sessionData.bookingState || {}),
            ...(preferredDate ? { preferredDate } : {}),
            ...(preferredTime ? { preferredTime } : {}),
          };
        }

        try {
          const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
          const { updateLeadScheduleByPhone } = await import('@/lib/service-lead-reopen');
          const { supabaseAdmin } = getSupabaseAdmin();
          if (supabaseAdmin && phone.length === 10) {
            await updateLeadScheduleByPhone(supabaseAdmin, phone, {
              preferred_date: preferredDate || opts?.sessionData?.bookingState?.preferredDate,
              preferred_time: preferredTime || opts?.sessionData?.bookingState?.preferredTime,
            });
          }
        } catch (err) {
          console.warn('[TOOL] set_preferred_schedule lead update failed', err);
        }

        return {
          success: true,
          preferred_date: preferredDate || null,
          preferred_time: preferredTime || null,
          message: 'Schedule saved on the CRM lead. Continue the booking flow.',
        };
      }

      case 'send_booking_otp': {
        const phone = normalizeBookingPhone(args.phone_number);
        if (phone.length !== 10) {
          return { success: false, message: 'Please share a valid 10-digit mobile number.' };
        }

        if (opts?.sessionData) {
          opts.sessionData.bookingState = {
            ...(opts.sessionData.bookingState || {}),
            phoneNumber: phone,
          };
        }

        const result = await sendBookingOtpForPhone(phone, {
          source: 'misa_booking',
          session_id: opts?.sessionId || null,
          channel:
            opts?.bookingChannel ||
            (String(opts?.sessionId || '').startsWith('wa_') ? 'WHATSAPP' : null),
        }, { dryRun: opts?.dryRun });

        if (!result.success) {
          return { success: false, message: result.error || 'Failed to send OTP' };
        }

        return {
          success: true,
          message: result.message || 'OTP sent on WhatsApp. Ask customer for the 6-digit code.',
          expires_in_seconds: result.expiresInSeconds || 600,
          dry_run: Boolean(result.dryRun),
        };
      }

      case 'verify_booking_otp': {
        const phone = normalizeBookingPhone(args.phone_number);
        const otp = normalizeBookingOtp(args.otp);
        if (phone.length !== 10) {
          return { success: false, verified: false, message: 'Valid 10-digit phone is required.' };
        }

        const result = await verifyBookingOtpForPhone(phone, otp, { dryRun: opts?.dryRun });
        if (!result.verified) {
          return {
            success: false,
            verified: false,
            message: result.error || 'Invalid or expired OTP. Ask customer to try again or resend OTP.',
          };
        }

        if (opts?.sessionData) {
          markPhoneVerifiedInSession(opts.sessionData, phone);
        }

        return {
          success: true,
          verified: true,
          message:
            'Mobile number verified. You may now call get_service_pricing if service, car model, and PIN code are available.',
          dry_run: Boolean(result.dryRun),
        };
      }

      case 'create_booking': {
        const phone = normalizeBookingPhone(args.phone_number);
        const vehicleNumber = normalizeVehicleNumber(args.vehicle_number);

        const sessionVehicle = getVehicleNumberFromSession(opts?.sessionData);
        if (!sessionVehicle && !isValidVehicleNumber(vehicleNumber)) {
          return {
            success: false,
            message:
              'Vehicle registration number is required before booking. Ask for car number, call set_vehicle_number, then show summary.',
          };
        }

        const finalVehicleNumber = sessionVehicle || vehicleNumber;

        if (!isPhoneVerifiedInSession(opts?.sessionData, phone)) {
          return {
            success: false,
            message:
              'Phone not verified. Call send_booking_otp, then verify_booking_otp before create_booking.',
          };
        }

        // Auto-derive city from PIN code if not provided
        let city = args.city;
        if (!city && args.pincode) {
          console.log(`[TOOL] Auto-deriving city from PIN code: ${args.pincode}`);
          const cityData = await getCityByPincode(args.pincode);
          if (cityData) {
            city = cityData.name;
            console.log(`[TOOL] Derived city: ${city}`);
          }
        }

        const customerName = String(args.customer_name || '').trim();
        if (!customerName || customerName.length < 2 || /^customer_/i.test(customerName)) {
          return {
            success: false,
            message: 'Customer name is required. Ask "What\'s your name?" and wait for response before booking.',
          };
        }

        if (opts?.sessionData) {
          opts.sessionData.bookingState = {
            ...(opts.sessionData.bookingState || {}),
            customerName,
          };
        }

        try {
          const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
          const { updateLeadCustomerNameByPhone } = await import('@/lib/service-lead-reopen');
          const { supabaseAdmin } = getSupabaseAdmin();
          if (supabaseAdmin) {
            await updateLeadCustomerNameByPhone(supabaseAdmin, phone, customerName);
          }
        } catch (err) {
          console.warn('[TOOL] create_booking name sync failed', err);
        }

        const trackingUtm = opts?.sessionData?.bookingState?.trackingUtm;
        const sessionPlans = Array.isArray(opts?.sessionData?.lastShownPlans)
          ? opts.sessionData.lastShownPlans
          : [];
        const directQuoted = Number(args.quoted_price);
        const resolvedServices = await resolveMisaServicesPricing({
          serviceNameRaw: String(args.service_name || ''),
          sessionPlans,
          pincode: String(args.pincode || opts?.sessionData?.bookingState?.pincode || '').trim(),
          carModel: String(args.car_model || opts?.sessionData?.bookingState?.carModel || '').trim(),
          category: String(args.service_category || opts?.sessionData?.bookingState?.category || '').trim(),
          directQuotedPrice: Number.isFinite(directQuoted) && directQuoted > 0 ? directQuoted : undefined,
        });
        const quotedPrice = resolvedServices.totalPrice > 0 ? resolvedServices.totalPrice : undefined;

        if (opts?.sessionData) {
          opts.sessionData.bookingState = opts.sessionData.bookingState || {};
          opts.sessionData.bookingState.selectedService = resolvedServices.displayLabel;
          opts.sessionData.bookingState.selectedServices = resolvedServices.services;
          if (quotedPrice) {
            opts.sessionData.bookingState.selectedServicePlan = {
              service_name: resolvedServices.displayLabel,
              min_price: quotedPrice,
              max_price: quotedPrice,
            };
          }
        }

        const bookingData = {
          session_id: args.session_id,
          service_name: resolvedServices.displayLabel,
          service_category: args.service_category,
          customer_name: customerName,
          phone_number: phone,
          vehicle_number: finalVehicleNumber,
          address: args.address,
          car_model: args.car_model,
          city: city,
          pincode: args.pincode,
          preferred_date: args.preferred_date || opts?.sessionData?.bookingState?.preferredDate,
          preferred_time: args.preferred_time || opts?.sessionData?.bookingState?.preferredTime,
          quoted_price: quotedPrice,
          misa_services: resolvedServices.services,
          service_type_ids: resolvedServices.serviceTypeIds,
          status: 'pending',
          channel: opts?.bookingChannel,
          tracking_utm: trackingUtm && typeof trackingUtm === 'object' ? (trackingUtm as Record<string, string>) : undefined,
        };

        const result = await saveBooking(bookingData);

        if (result.success) {
          if (opts?.sessionData) {
            opts.sessionData.lastBookingCompleted = Date.now();
            opts.sessionData.phoneVerification = undefined;
          }
          return {
            success: true,
            booking_id: result.id,
            message: 'Booking created successfully!',
          };
        } else {
          return {
            success: false,
            error: result.error,
            message: 'Failed to create booking. Please try again.',
          };
        }
      }

      case 'validate_pincode': {
        const { pincode } = args;

        const cityData = await getCityByPincode(pincode);

        if (cityData) {
          return {
            success: true,
            pincode: pincode,
            city: cityData.name,
            city_id: cityData.id,
          };
        } else {
          return {
            success: false,
            message: `We don't operate in PIN code ${pincode} yet. Please try a nearby PIN code or check our service areas: Mumbai, Thane, Pune, Navi Mumbai.`,
          };
        }
      }

      default:
        return {
          success: false,
          error: 'Unknown tool',
          message: `Tool ${toolName} is not recognized.`,
        };
    }
  } catch (error: any) {
    console.error(`[TOOL] Error executing ${toolName}:`, error);
    return {
      success: false,
      error: error.message,
      message: 'An error occurred while processing your request.',
    };
  }
}

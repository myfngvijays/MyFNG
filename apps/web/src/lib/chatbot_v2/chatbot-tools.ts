/**
 * Tool/Function Definitions for LLM Chatbot
 * These are the functions the LLM can call to interact with the system
 */

import { getPricing, getWorkshops, getCityByPincode, getServicePlansByPincode } from './database-queries';
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

/**
 * OpenAI Function/Tool Schemas
 */
export const CHATBOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_service_pricing',
      description:
        "Get pricing information for a specific car service. Use this when user asks about prices or when you have service type, car model, and location (PIN code or city).",
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
      name: 'send_booking_otp',
      description:
        'Send a 6-digit OTP on WhatsApp to verify the customer mobile number before booking. Call this immediately after collecting a valid 10-digit phone number.',
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
            return {
              success: true,
              pricing: sorted.map((p: any) => ({
                service_name: p.service_name,
                min_price: p.min_price,
                max_price: p.max_price,
                description: p.description,
              })),
              plan_count: sorted.length,
              instruction: `List ALL ${sorted.length} service plans returned. Do not show only 3.`,
              location: `PIN ${pincode}`,
            };
          } else if (plans.length > 0 && (plans[0] as any).error) {
            return {
              success: false,
              error: (plans[0] as any).error,
              message: (plans[0] as any).message,
            };
          }
        }

        // Fallback to city-based pricing
        if (city) {
          const pricing = await getPricing({
            service: service_category,
            city: city,
            carModel: car_model,
            limit: 5,
          });

          if (pricing.length > 0) {
            return {
              success: true,
              pricing: pricing.map((p: any) => ({
                workshop_name: p.workshop_name,
                service_name: p.service_name,
                price: p.custom_price || p.price,
                city: p.workshop_city,
              })),
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
              name: w.workshop_name || w.name,
              address: w.short_address || w.address,
              city: w.city,
              pincode: w.pincode,
              phone: '9152307030',
              working_time: w.working_time,
              map_link: w.near_area_google_map,
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

      case 'send_booking_otp': {
        const phone = normalizeBookingPhone(args.phone_number);
        if (phone.length !== 10) {
          return { success: false, message: 'Please share a valid 10-digit mobile number.' };
        }

        const result = await sendBookingOtpForPhone(phone, {
          source: 'misa_booking',
          session_id: opts?.sessionId || null,
          channel: opts?.bookingChannel || null,
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
          message: 'Mobile number verified. You may continue with address, date, and time.',
          dry_run: Boolean(result.dryRun),
        };
      }

      case 'create_booking': {
        const phone = normalizeBookingPhone(args.phone_number);
        const vehicleNumber = normalizeVehicleNumber(args.vehicle_number);

        if (!isValidVehicleNumber(vehicleNumber)) {
          return {
            success: false,
            message: 'Invalid vehicle number. Ask for registration number like DL01AB1234.',
          };
        }

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

        const bookingData = {
          session_id: args.session_id,
          service_name: args.service_name,
          service_category: args.service_category,
          customer_name: args.customer_name,
          phone_number: phone,
          vehicle_number: vehicleNumber,
          address: args.address,
          car_model: args.car_model,
          city: city,
          pincode: args.pincode,
          preferred_date: args.preferred_date,
          preferred_time: args.preferred_time,
          status: 'pending',
          channel: opts?.bookingChannel,
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

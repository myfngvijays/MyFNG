import { getPricing, getWorkshops, getCityByPincode, getServicePlansByPincode } from './database-queries';
import { saveBooking } from './booking';
import { getServiceChecklist } from './checklist-queries';

export const CHATBOT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_service_pricing',
      description: 'Get pricing information for a specific service category and car model.',
      parameters: {
        type: 'object',
        properties: {
          service_category: { type: 'string' },
          car_model: { type: 'string' },
          pincode: { type: 'string', pattern: '^[0-9]{6}$' },
          city: { type: 'string' },
        },
        required: ['service_category', 'car_model'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_workshops',
      description: 'Search workshops by PIN code.',
      parameters: {
        type: 'object',
        properties: {
          pincode: { type: 'string', pattern: '^[0-9]{6}$' },
          limit: { type: 'number', default: 5 },
        },
        required: ['pincode'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_service_details',
      description: "Get checklist/details for what's included in a service.",
      parameters: {
        type: 'object',
        properties: {
          service_name: { type: 'string' },
        },
        required: ['service_name'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_booking',
      description: 'Create booking when all mandatory details are available.',
      parameters: {
        type: 'object',
        properties: {
          session_id: { type: 'string' },
          service_name: { type: 'string' },
          service_category: { type: 'string' },
          car_model: { type: 'string' },
          customer_name: { type: 'string' },
          phone_number: { type: 'string', pattern: '^[0-9]{10}$' },
          address: { type: 'string' },
          city: { type: 'string' },
          pincode: { type: 'string', pattern: '^[0-9]{6}$' },
          preferred_date: { type: 'string' },
          preferred_time: { type: 'string' },
        },
        required: ['session_id', 'service_name', 'service_category', 'car_model', 'customer_name', 'phone_number', 'address', 'preferred_date', 'preferred_time'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'validate_pincode',
      description: 'Validate pincode and return mapped city.',
      parameters: {
        type: 'object',
        properties: {
          pincode: { type: 'string', pattern: '^[0-9]{6}$' },
        },
        required: ['pincode'],
      },
    },
  },
];

export async function executeToolCall(toolName: string, args: any): Promise<any> {
  try {
    switch (toolName) {
      case 'get_service_pricing': {
        const { service_category, car_model, pincode, city } = args;
        if (pincode) {
          const plans = await getServicePlansByPincode({
            category: service_category,
            carModel: car_model,
            pincode,
          });
          if (plans.length > 0 && !(plans[0] as any).error) {
            return { success: true, pricing: plans, location: `PIN ${pincode}` };
          }
          if (plans.length > 0 && (plans[0] as any).error) return { success: false, ...(plans[0] as any) };
        }

        if (city) {
          const pricing = await getPricing({ service: service_category, city, carModel: car_model, limit: 5 });
          if (pricing.length > 0) return { success: true, pricing, location: city };
        }
        return { success: false, message: 'No pricing found for this request.' };
      }
      case 'search_workshops': {
        const { pincode, limit = 5 } = args;
        const workshops = await getWorkshops({ city: pincode, limit });
        if (workshops.length > 0) return { success: true, workshops };
        return { success: false, message: `No workshops found for PIN ${pincode}.` };
      }
      case 'get_service_details': {
        const { service_name } = args;
        const checklist = await getServiceChecklist(service_name);
        if (checklist.length > 0) return { success: true, service_name, checklist };
        return { success: false, message: 'Detailed checklist will be shared during booking.' };
      }
      case 'create_booking': {
        let city = args.city;
        if (!city && args.pincode) {
          const cityData = await getCityByPincode(args.pincode);
          city = cityData?.name || city;
        }
        const result = await saveBooking({
          session_id: args.session_id,
          service_name: args.service_name,
          service_category: args.service_category,
          customer_name: args.customer_name,
          phone_number: args.phone_number,
          address: args.address,
          car_model: args.car_model,
          city: city || '',
          pincode: args.pincode,
          preferred_date: args.preferred_date,
          preferred_time: args.preferred_time,
          status: 'pending',
        });
        return result.success ? { success: true, booking_id: result.id, message: 'Booking created successfully!' } : { success: false, error: result.error };
      }
      case 'validate_pincode': {
        const cityData = await getCityByPincode(String(args.pincode || ''));
        if (cityData) return { success: true, pincode: args.pincode, city: cityData.name, city_id: cityData.id };
        return { success: false, message: `We don't operate in PIN ${args.pincode} yet.` };
      }
      default:
        return { success: false, message: `Unknown tool: ${toolName}` };
    }
  } catch (error: any) {
    return { success: false, error: String(error?.message || error), message: 'An error occurred while processing your request.' };
  }
}

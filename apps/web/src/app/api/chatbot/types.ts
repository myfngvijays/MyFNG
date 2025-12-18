export type ChatbotIntent = 'SERVICE_BOOKING' | 'RSA' | 'PRICE_ENQUIRY' | 'STATUS' | 'UNKNOWN';
export type ChatbotUrgency = 'LOW' | 'MEDIUM' | 'HIGH';
export type ChatbotVehicleType = 'CAR' | 'BIKE' | 'UNKNOWN';

export type ChatbotSafetyFlag = 'EMERGENCY' | 'COMPLAINT' | 'ABUSIVE';

export interface IntentDetectionResult {
  intent: ChatbotIntent;
  urgency: ChatbotUrgency;
  vehicle_type: ChatbotVehicleType;
  flags: ChatbotSafetyFlag[];
  confidence: number; // 0..1
  extracted?: {
    symptoms?: string[];
    locationText?: string;
  };
}

export interface ChatbotContext {
  // Optional context coming from UI (web/mobile) or from prior turns
  conversationId?: string;

  // New 6-step conversation flow (matches book-service)
  conversationStage?:
    | 'INITIAL' // Welcome/greeting
    | 'NEED_LOCATION' // Step 1: Location (usually pre-detected)
    | 'NEED_CAR_MODEL' // Step 2: Car model with autocomplete
    | 'NEED_PHONE' // Step 3: 10-digit mobile
    | 'NEED_VEHICLE_NUMBER' // Vehicle number (required for booking insert)
    | 'NEED_ISSUE' // Step 4: Car issue + service suggestions
    | 'NEED_PICKUP_PREF' // Step 5: Pickup vs self come + workshop
    | 'NEED_PAYMENT' // Step 6: Payment method
    | 'WAITING_SERVICE_SELECTION' // User selecting from service plans
    | 'WAITING_WORKSHOP_SELECTION' // User selecting workshop (if self come)
    | 'READY_TO_BOOK'; // All info collected, ready to create lead

  // Booking fields (progressively filled)
  customerName?: string;
  customerPhone?: string;
  vehicleNumber?: string;

  // Preferred reply language (explicitly set by user)
  preferredLanguage?: 'auto' | 'en' | 'hi' | 'mr' | 'gu';

  // Step 1: Location (usually auto-detected from browser)
  cityId?: string;
  cityName?: string;
  addressText?: string; // area/city/state/pincode combined
  locationLat?: number | null;
  locationLng?: number | null;

  // Step 2: Vehicle (car model autocomplete)
  modelId?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleVariant?: string;
  vehicleClass?: string | null; // used for pricing tiers
  zoneId?: string | null;
  
  // Car model suggestions for autocomplete
  carModelSuggestions?: Array<{ id: string; make: string; model: string; variant?: string }>;

  // Step 4: Problem + Selected Services
  problemDescription?: string;
  // Service category selection (same as /book-service category tabs)
  serviceCategory?: string;
  selectedServiceTypeIds?: string[];
  selectedPackageId?: string;

  // Step 5: Pickup preference
  pickupRequired?: boolean; // true = pickup, false = self come
  pickupDate?: string;
  pickupTime?: string;
  pickupAddress?: string;
  flatNumber?: string;
  landmark?: string;

  // Workshop (for self come option)
  workshopId?: string;
  workshopName?: string;
  workshopOptions?: Array<{ id: string; name: string; km?: number; address?: string }>;

  // Step 6: Payment
  paymentMethod?: string; // UPI, CARD, CASH, etc.
  paymentStatus?: 'PAY_NOW' | 'PAY_LATER';
}

export interface ChatbotMessageRequest {
  message: string;
  context?: ChatbotContext;
}

export interface ServiceSuggestion {
  kind: 'SERVICE_TYPE' | 'PACKAGE' | 'RSA';
  id: string;
  name: string;
  why: string; // short human explanation
}

export interface PriceRange {
  currency: 'INR';
  min: number;
  max: number;
  // informative label, never exact
  label: string; // e.g. "₹2,000 – ₹3,000"
  source: 'workshop_service_pricing' | 'service_packages' | 'fallback';
}

export interface SuggestedOption {
  suggestion: ServiceSuggestion;
  priceRange?: PriceRange;
  checklistItems?: string[]; // What's included in this service
  checklistNote?: string; // Summary note for checklist
  category?: string; // Service category for display
}

export interface BookingResult {
  leadId: string;
  leadNumber: string;
}

export interface ChatbotResponse {
  conversationId: string;
  intent: IntentDetectionResult;
  suggestions?: SuggestedOption[];
  assistantMessage: string;
  // Updated context to send back to client for next turn
  contextPatch?: Partial<ChatbotContext>;
  booking?: BookingResult;
}

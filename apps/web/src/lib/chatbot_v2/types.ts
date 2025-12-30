export type ChatbotV2ResponseType = 'answer' | 'pricing' | 'booking' | 'escalation';

export type IntentCategory =
  | 'GeneralInfo'
  | 'PriceEnquiry'
  | 'PeriodicService'
  | 'RepairIssue'
  | 'CleaningDetailing'
  | 'WorkshopLocation'
  | 'BookingRequest'
  | 'WarrantySupport'
  | 'HumanEscalation';

export type UserLang = 'en' | 'hi' | 'hinglish';

export type ChatbotV2Context = {
  conversationId?: string;

  // language
  preferredLanguage?: 'auto' | UserLang;

  // location coming from frontend (website already has it)
  locationLat?: number;
  locationLng?: number;
  locationLabel?: string; // e.g. "Andheri West, Mumbai"
  addressText?: string; // legacy from v1 UI reverse geocode (full display_name)

  // captured info
  vehicleModel?: string; // free text, e.g. "Hyundai i20"
  carModelId?: string; // DB car_models.id (when confidently matched)
  vehicleClass?: string; // e.g. SEDANS/SUV
  vehicleNumber?: string; // e.g. "MH12AB1234" (required for booking in DB schema)
  customerPhone?: string; // 10-digit (India)
  pickupPreference?: 'PICKUP' | 'SELF_VISIT';
  locationConfirmed?: boolean;
  selectedServiceTypeId?: string;
  selectedServiceTypeName?: string;
  selectedCategoryUuid?: string;
  selectedCategoryName?: string;
  lastServiceDoneAt?: string; // month/year free text, required before pricing

  // Conversation memory (lightweight)
  flow?: 'BOOKING' | 'PRICING' | 'WORKSHOP';
  greeted?: boolean; // greeting should happen only once per conversation

  // Last knowledge answer memory (for follow-ups like "tell me more")
  lastKbQuery?: string;
  lastKbAnswerFacts?: string;
  lastKbAt?: number; // epoch ms

  // booking / payment
  leadId?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  paymentLink?: string;

  // UI step memory (short-lived)
  awaitingPaymentLinkConsent?: boolean;
  awaitingCarModelSelection?: boolean;
  awaitingSlotText?: boolean;
  preferredSlotText?: string; // free text like "tomorrow 11am"
};

export type ChatbotV2Request = {
  message: string;
  context?: ChatbotV2Context;
};

export type ClassifiedIntent = {
  intent: IntentCategory;
  confidence: number; // 0..1
  entities?: {
    wantsPaymentLink?: boolean;
    mentionedWorkshop?: boolean;
    mentionedPrice?: boolean;
  };
};

export type MissingInfo = {
  needsVehicleModel: boolean;
  needsLocationConfirm: boolean;
  needsPickupPreference: boolean;
  needsPhone: boolean;
};

export type WorkshopHit = {
  id: string;
  name: string;
  address?: string | null;
  mapLink?: string | null;
  imageUrl?: string | null;
  km: number | null;
  auditScore?: number | null;
  workshopArea?: string | null;
  nearFamousArea?: string | null;
  category?: string | null;
};

export type PricingHit = {
  kind: 'PACKAGE' | 'SERVICE';
  id: string;
  name: string;
  price: number | null;
  note?: string | null;
};

export type ChatbotV2Response = {
  type: ChatbotV2ResponseType;
  message: string;
  cta: string;
  data: Record<string, any>;
};



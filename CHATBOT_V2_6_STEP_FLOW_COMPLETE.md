# Chatbot V2 - 6-Step Flow Implementation Complete ✅

## Overview
Restructured chatbot to match book-service page flow with OpenAI managing natural conversation at each step.

## New 6-Step Flow

### Step 1: Location (Pre-detected)
- **Auto-detected** from browser geolocation
- Skip asking if `locationLat` & `locationLng` available
- Infer `cityId`, `cityName`, `zoneId` from coordinates
- **Stage**: `NEED_LOCATION`

### Step 2: Car Model (Autocomplete)
- **User types** car name (e.g., "Tata Tigor")
- **Backend provides** up to 8 suggestions from `car_models` table
- **Frontend shows** autocomplete dropdown with:
  - 🚗 icon
  - Make + Model + Variant
  - Click or type to select
- **API**: `/api/car-models/search?q=query` (new endpoint)
- **Stage**: `NEED_CAR_MODEL`

### Step 3: Mobile Number
- **Ask** for 10-digit mobile number
- **Auto-extract** from user message if provided
- **Required** for booking updates
- **Stage**: `NEED_PHONE`

### Step 4: Issue + Service Plans
- **User describes** car issue/problem
- **Backend suggests** services from `service_types` + `service_packages`
- **Frontend shows** service cards with:
  - Plan name + number
  - Price range (location + vehicle-specific)
  - Category badge (Periodic, Repair, Body, etc.)
  - **"See Details" button** (shows checklist items)
  - **"Select Plan" button**
- **Checklist source**:
  - `service_type_checklist_templates` for service types
  - `service_package_items` mapped names for packages
- **Stage**: `NEED_ISSUE` → `WAITING_SERVICE_SELECTION`

### Step 5: Pickup Preference
- **Ask**: Pickup chahiye ya self come?
- **Options**:
  1. Pickup (doorstep service)
  2. Self come (visit workshop)
- **If self come**: Show nearest workshops with:
  - Workshop name
  - Address
  - Distance (km)
  - Select workshop button
- **Stage**: `NEED_PICKUP_PREF` → `WAITING_WORKSHOP_SELECTION`

### Step 6: Payment Method
- **Ask** payment preference
- **Options**:
  1. UPI/Online Payment 💳
  2. Credit/Debit Card 💳
  3. Cash on Service 💳
  4. Pay Later at Workshop 💳
- **Stage**: `NEED_PAYMENT` → `READY_TO_BOOK`

### Final: Booking Confirmation
- All info collected → `triggerBooking()`
- Returns `leadNumber`
- OpenAI composes success message

---

## Key Features

### ✅ OpenAI Manages Everything
- **No rigid templates** - all phrasing via `composeReply()` using `REPLY_COMPOSER_SYSTEM_PROMPT`
- **Detects language** - replies in same language (English, Hindi, Hinglish, Marathi, Gujarati)
- **Natural conversation** - understands context, provides helpful suggestions

### ✅ Autocomplete at Every Step
- **Car models**: Type to search, instant suggestions
- **Service plans**: Category-aware, multiple options
- **Workshops**: Nearest based on coordinates
- **Payment**: Quick selection buttons

### ✅ "See Details" Button
- Shows **checklist items** for services (what's included)
- Modal/alert with:
  - Service type checklist templates
  - Package itemsincludes (service names)
  - Description notes

### ✅ Smart Suggestions
- **Type or select** - both work
- User can type freely or click option numbers
- OpenAI phrases suggestions naturally

---

## Files Changed

### Backend
1. **`apps/web/src/app/api/chatbot/types.ts`**
   - Updated `ChatbotContext` with new stages
   - Added `carModelSuggestions`, `pickupDate`, `pickupTime`, `paymentMethod`, etc.
   - Added `checklistItems`, `checklistNote`, `category` to `SuggestedOption`

2. **`apps/web/src/app/api/chatbot/route.ts`**
   - Added `searchCarModelsForAutocomplete()` function
   - Updated vehicle collection step to show car autocomplete
   - Added payment step before final booking
   - Added checklist details to suggestions response
   - Improved stage-aware context capture

3. **`apps/web/src/app/api/chatbot/serviceResolver.ts`**
   - Exported `getServiceCategory()` for reuse
   - Already had checklist fetching logic

4. **`apps/web/src/app/api/car-models/search/route.ts`** ✨ NEW
   - Autocomplete API for car models
   - Query params: `?q=search_term`
   - Returns up to 10 matches

### Frontend
5. **`apps/web/src/app/page.tsx`** (Landing page chatbot widget)
   - Updated `ChatMsg` type with new suggestion properties
   - Added rendering for:
     - Car model autocomplete cards (🚗)
     - Service plan cards with "See Details" button
     - Payment option cards (💳)
   - Different UI for each suggestion type

6. **`apps/web/src/app/ai-booking/page.tsx`** (Full-page chat)
   - Same updates as page.tsx
   - Synced with floating widget via `BroadcastChannel`

---

## How It Works (User Journey)

```
User: "Hi"
Bot: "Hello! Aapko kis cheez me help chahiye — RSA ya car service?"

User: "service"
Bot: "Aapki car model? (Type karein for suggestions)"

User: "tata"
Bot: Shows autocomplete:
     🚗 1. Tata Tigor
     🚗 2. Tata Nexon
     🚗 3. Tata Punch
     ...

User: "Option 1"
Bot: "Great! Aapka 10-digit mobile number?"

User: "9876543210"
Bot: "Perfect! Kya problem aa rahi hai aapki car mein?"

User: "ac not cooling"
Bot: Shows service plans:
     ┌─────────────────────────────────────┐
     │ 1. AC Service                       │ [Repair]
     │ ₹1,500 - ₹2,500                    │
     │ [Select Plan] [See Details]        │
     └─────────────────────────────────────┘
     ┌─────────────────────────────────────┐
     │ 2. AC Gas Refill                    │ [Repair]
     │ ₹800 - ₹1,200                      │
     │ [Select Plan] [See Details]        │
     └─────────────────────────────────────┘
     ...

User: clicks "See Details" on Option 1
Modal: "What's Included:
        • AC system inspection
        • Gas leak check
        • Compressor check
        • Filter cleaning"

User: "Option 1"
Bot: "Pickup chahiye ya khud workshop aana pasand karenge?
     1. Pickup chahiye
     2. Main khud aaunga"

User: "1"
Bot: "Payment method?
     💳 1. UPI/Online
     💳 2. Credit/Debit Card
     💳 3. Cash on Service
     💳 4. Pay Later at Workshop"

User: "Option 4"
Bot: "✅ Booking confirmed!
     Your Lead Number: LN000123
     Our team will contact you shortly."
```

---

## Technical Implementation

### OpenAI Integration
```typescript
async function composeReply(params: {
  userMessage: string;
  context: ChatbotContext;
  stage: string;
  deterministicFacts: any;
  fallback: string;
}): Promise<string>
```

- Uses `REPLY_COMPOSER_SYSTEM_PROMPT`
- Model: `gpt-4o-mini` (configurable via `OPENAI_MODEL`)
- Detects reply language from user message
- Passes deterministic facts (DB data) to LLM
- Falls back to template if OpenAI fails

### Database Queries
- **Cities**: For location inference
- **Car Models**: Autocomplete search (`make` + `model_name` ILIKE)
- **Service Types**: From `service_types` table
- **Service Packages**: From `service_packages` table
- **Checklist Templates**: From `service_type_checklist_templates`
- **Pricing**: From `workshop_service_pricing` (city+zone+class aware)
- **Workshops**: Nearest by haversine distance

### Pricing Logic
- Matches `/book-service` priority:
  1. City + Vehicle Class
  2. City only
  3. Zone + Vehicle Class
  4. Zone only
  5. Class only
  6. Fallback (generic)

---

## Environment Variables Required

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

---

## Testing Checklist

- [x] Location pre-detected from browser
- [x] Car model autocomplete shows 8 suggestions
- [x] Mobile number extraction works
- [x] Service plans show with accurate pricing
- [x] "See Details" button shows checklist items
- [x] Category badges display correctly
- [x] Pickup vs self-come selection
- [x] Workshop list shows for self-come
- [x] Payment options display
- [x] Booking creates lead successfully
- [x] OpenAI manages phrasing naturally
- [x] Multi-language support (EN/HI/MR/GU)
- [x] Sync between floating widget and full-page chat

---

## Notes

- ✅ No exact pricing promises (ranges only)
- ✅ OpenAI never sees raw DB credentials
- ✅ All DB queries use service role client
- ✅ Conversation logged to `chatbot_messages` table
- ✅ Backward compatible with existing leads
- ✅ Mobile responsive UI
- ✅ Type-safe TypeScript throughout

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/chatbot` | POST | Main chatbot conversation |
| `/api/car-models/search` | GET | Car model autocomplete |
| `/api/cities` | GET | City list (existing) |

---

## Future Enhancements (Optional)

1. Image upload for issue description
2. Video call with mechanic
3. Real-time ETA updates
4. Payment gateway integration
5. Calendar date/time picker for pickup
6. Voice input support
7. Rich media responses (images/videos)

---

**Status**: ✅ Complete and Production Ready
**Date**: 2025-12-18
**Version**: V2.0

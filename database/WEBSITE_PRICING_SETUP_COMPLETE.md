# 🌐 Website Service Pricing Setup - Complete Guide

## 📋 Overview
Super Admin ab **Zone + City + Service** basis par website rates manage kar sakta hai. Yeh customer-facing prices hain jo website par dikhaye jayenge.

---

## ✅ Setup Steps

### Step 1: Run Database Migrations

```bash
# 1. Link cities to zones (optional but recommended)
psql -d your_database -f database/LINK_CITIES_TO_ZONES.sql

# 2. Create website service pricing table
psql -d your_database -f database/CREATE_WEBSITE_SERVICE_PRICING.sql
```

---

## 📊 Database Structure

### Table: `website_service_pricing`

**Columns:**
- `id` - UUID primary key
- `zone_id` - Zone reference (FK to zones)
- `city_id` - City reference (FK to cities)
- `service_type_id` - Service reference (FK to service_types)
- `base_price` - Base price before tax
- `tax_rate` - Tax percentage (default 18%)
- `final_price` - Auto-calculated (base_price + tax)
- `vehicle_class` - Optional (HATCHBACK, SEDAN, SUV, etc.)
- `is_active` - Active status
- `created_by`, `updated_by` - Audit fields
- `created_at`, `updated_at` - Timestamps

**Unique Constraint:**
- One price per `(zone_id, city_id, service_type_id, vehicle_class)` combination

---

## 🔧 Key Features

### 1. **Zone-City-Service Pricing**
- Har zone-city-service combination ke liye alag price set kar sakte hain
- Example: Delhi (North Zone) me Oil Change = ₹500, Mumbai (West Zone) me = ₹600

### 2. **Vehicle Class Support** (Optional)
- Vehicle class ke basis par alag pricing
- NULL = sabhi classes ke liye same price

### 3. **Auto-calculated Final Price**
- `final_price` automatically calculate hota hai: `base_price + (base_price * tax_rate / 100)`

### 4. **Helper View**
- `website_pricing_view` - Easy querying ke liye
- Zone, City, Service names ke saath complete data

### 5. **Helper Function**
- `get_website_service_price(zone_id, city_id, service_type_id, vehicle_class)`
- API me directly use kar sakte hain

---

## 📝 Usage Examples

### Insert New Pricing

```sql
INSERT INTO public.website_service_pricing (
  zone_id,
  city_id,
  service_type_id,
  base_price,
  tax_rate,
  is_active
)
SELECT 
  z.id,
  c.id,
  st.id,
  500.00,
  18.00,
  true
FROM public.zones z, public.cities c, public.service_types st
WHERE z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change';
```

### Update Existing Price

```sql
UPDATE public.website_service_pricing wsp
SET base_price = 600.00, updated_at = NOW()
FROM public.zones z, public.cities c, public.service_types st
WHERE wsp.zone_id = z.id
  AND wsp.city_id = c.id
  AND wsp.service_type_id = st.id
  AND z.name = 'North Zone'
  AND c.name = 'Delhi'
  AND st.name = 'Oil Change';
```

### Get Price (Using Function)

```sql
SELECT * FROM public.get_website_service_price(
  (SELECT id FROM zones WHERE name = 'North Zone'),
  (SELECT id FROM cities WHERE name = 'Delhi'),
  (SELECT id FROM service_types WHERE name = 'Oil Change'),
  NULL  -- vehicle_class
);
```

### View All Pricing

```sql
SELECT * FROM public.website_pricing_view
ORDER BY zone_name, city_name, service_name;
```

---

## 🔐 Security (RLS Policies)

1. **Public View**: Active pricing sabko dikh sakta hai
2. **Authenticated View**: Authenticated users sab pricing dekh sakte hain
3. **Super Admin Manage**: Sirf SUPER_ADMIN role pricing manage kar sakta hai

---

## 🎯 Frontend Integration

### API Endpoint Example

```typescript
// Get price for a service in a city
GET /api/pricing/service-price
Query params:
  - zoneId: UUID
  - cityId: UUID
  - serviceTypeId: UUID
  - vehicleClass?: string (optional)

Response:
{
  basePrice: 500.00,
  taxRate: 18.00,
  finalPrice: 590.00
}
```

### React Component Example

```typescript
const getServicePrice = async (zoneId, cityId, serviceTypeId) => {
  const response = await fetch(
    `/api/pricing/service-price?zoneId=${zoneId}&cityId=${cityId}&serviceTypeId=${serviceTypeId}`
  );
  return response.json();
};
```

---

## 📋 Super Admin Dashboard Features

### 1. **Price Management Table**
- Zone dropdown
- City dropdown (filtered by zone)
- Service dropdown
- Price input fields
- Save/Update button

### 2. **Bulk Operations**
- Multiple cities ke liye same price set karna
- CSV import/export
- Price comparison across zones

### 3. **Price History**
- Price change history
- Who changed and when

---

## 🔍 Query Examples

### Find Missing Pricing

```sql
-- Cities without pricing for a service
SELECT z.name, c.name, st.name
FROM zones z
CROSS JOIN cities c
CROSS JOIN service_types st
LEFT JOIN website_service_pricing wsp ON 
  wsp.zone_id = z.id 
  AND wsp.city_id = c.id 
  AND wsp.service_type_id = st.id
WHERE wsp.id IS NULL
ORDER BY z.name, c.name;
```

### Compare Prices Across Zones

```sql
SELECT 
  st.name AS service,
  z.name AS zone,
  c.name AS city,
  wsp.base_price,
  wsp.final_price
FROM website_service_pricing wsp
JOIN zones z ON wsp.zone_id = z.id
JOIN cities c ON wsp.city_id = c.id
JOIN service_types st ON wsp.service_type_id = st.id
WHERE st.name = 'Oil Change'
ORDER BY z.name, c.name;
```

---

## ✅ Checklist

- [x] Database table created
- [x] Indexes for performance
- [x] RLS policies for security
- [x] Helper view created
- [x] Helper function created
- [x] Auto-update trigger for updated_at
- [x] Usage examples provided
- [ ] Frontend integration
- [ ] Super Admin UI
- [ ] API endpoints

---

## 📚 Related Files

1. `CREATE_WEBSITE_SERVICE_PRICING.sql` - Main table creation
2. `LINK_CITIES_TO_ZONES.sql` - Link cities to zones
3. `WEBSITE_PRICING_USAGE_EXAMPLES.sql` - Usage examples
4. `ADD_95_MASTER_PRODUCTS.sql` - Master products (already done)

---

## 🎉 Next Steps

1. ✅ Database setup complete
2. ⏳ Create Super Admin UI for price management
3. ⏳ Create API endpoints
4. ⏳ Integrate with frontend
5. ⏳ Add price history tracking (optional)

---

**Status:** ✅ **Database Setup Complete!**


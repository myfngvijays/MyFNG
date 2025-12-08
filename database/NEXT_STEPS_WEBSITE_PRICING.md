# 🚀 Next Steps - Website Pricing Setup

## ✅ Completed
- [x] Database table created (`website_service_pricing`)
- [x] Cities linked to zones
- [x] Indexes and constraints set up
- [x] RLS policies configured
- [x] Helper functions and views created

---

## 📋 Immediate Next Steps

### 1. **Add Sample Data** (Optional but Recommended)

```sql
-- Check what data you have
SELECT id, name FROM public.zones;
SELECT id, name FROM public.cities LIMIT 10;
SELECT id, name FROM public.service_types LIMIT 10;

-- Then insert sample pricing using:
\i database/INSERT_SAMPLE_WEBSITE_PRICING.sql
```

### 2. **Verify Setup**

```sql
-- View all pricing
SELECT * FROM public.website_pricing_view;

-- Test the helper function
SELECT * FROM public.get_website_service_price(
  (SELECT id FROM zones WHERE name = 'North Zone'),
  (SELECT id FROM cities WHERE name = 'Delhi'),
  (SELECT id FROM service_types WHERE name = 'Oil Change'),
  NULL
);
```

---

## 🎯 Frontend Integration

### Option A: Create API Endpoints

#### 1. **Get Price API**

```typescript
// apps/web/src/app/api/pricing/service-price/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get('zoneId');
  const cityId = searchParams.get('cityId');
  const serviceTypeId = searchParams.get('serviceTypeId');
  const vehicleClass = searchParams.get('vehicleClass');

  const supabase = createClient();

  const { data, error } = await supabase.rpc('get_website_service_price', {
    p_zone_id: zoneId,
    p_city_id: cityId,
    p_service_type_id: serviceTypeId,
    p_vehicle_class: vehicleClass || null
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data: data[0] || null });
}
```

#### 2. **List All Pricing API** (For Super Admin)

```typescript
// apps/web/src/app/api/admin/pricing/list/route.ts
export async function GET(request: Request) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from('website_pricing_view')
    .select('*')
    .order('zone_name, city_name, service_name');

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data });
}
```

#### 3. **Create/Update Pricing API** (Super Admin Only)

```typescript
// apps/web/src/app/api/admin/pricing/route.ts
export async function POST(request: Request) {
  const supabase = createClient();
  const body = await request.json();

  const { data, error } = await supabase
    .from('website_service_pricing')
    .upsert({
      zone_id: body.zoneId,
      city_id: body.cityId,
      service_type_id: body.serviceTypeId,
      base_price: body.basePrice,
      tax_rate: body.taxRate,
      vehicle_class: body.vehicleClass || null,
      is_active: body.isActive ?? true,
      updated_by: (await supabase.auth.getUser()).data.user?.id
    }, {
      onConflict: 'zone_id,city_id,service_type_id'
    })
    .select();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data: data[0] });
}
```

---

### Option B: Super Admin UI Components

#### 1. **Pricing Management Page**

```typescript
// apps/web/src/components/admin/PricingManagement.tsx
'use client';

import { useState, useEffect } from 'react';

export default function PricingManagement() {
  const [zones, setZones] = useState([]);
  const [cities, setCities] = useState([]);
  const [services, setServices] = useState([]);
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [taxRate, setTaxRate] = useState('18');

  // Fetch zones, cities, services on mount
  useEffect(() => {
    // Load zones, cities, services
  }, []);

  const handleSave = async () => {
    const response = await fetch('/api/admin/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zoneId: selectedZone,
        cityId: selectedCity,
        serviceTypeId: selectedService,
        basePrice: parseFloat(basePrice),
        taxRate: parseFloat(taxRate),
      })
    });
    // Handle response
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manage Website Pricing</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <select value={selectedZone} onChange={(e) => setSelectedZone(e.target.value)}>
          <option>Select Zone</option>
          {/* Map zones */}
        </select>
        
        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)}>
          <option>Select City</option>
          {/* Map cities filtered by zone */}
        </select>
        
        <select value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
          <option>Select Service</option>
          {/* Map services */}
        </select>
        
        <input
          type="number"
          placeholder="Base Price"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
        />
        
        <input
          type="number"
          placeholder="Tax Rate %"
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
        />
      </div>
      
      <button onClick={handleSave} className="bg-blue-500 text-white px-4 py-2">
        Save Pricing
      </button>
    </div>
  );
}
```

#### 2. **Pricing List/Table Component**

```typescript
// apps/web/src/components/admin/PricingTable.tsx
'use client';

export default function PricingTable() {
  const [pricing, setPricing] = useState([]);

  useEffect(() => {
    fetch('/api/admin/pricing/list')
      .then(res => res.json())
      .then(data => setPricing(data.data));
  }, []);

  return (
    <table className="w-full">
      <thead>
        <tr>
          <th>Zone</th>
          <th>City</th>
          <th>Service</th>
          <th>Base Price</th>
          <th>Tax Rate</th>
          <th>Final Price</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {pricing.map((item) => (
          <tr key={item.id}>
            <td>{item.zone_name}</td>
            <td>{item.city_name}</td>
            <td>{item.service_name}</td>
            <td>₹{item.base_price}</td>
            <td>{item.tax_rate}%</td>
            <td>₹{item.final_price}</td>
            <td>
              <button>Edit</button>
              <button>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 🔍 Testing Checklist

- [ ] Test inserting pricing via SQL
- [ ] Test helper function `get_website_service_price()`
- [ ] Test view `website_pricing_view`
- [ ] Test API endpoints (if created)
- [ ] Test Super Admin UI (if created)
- [ ] Test RLS policies (only Super Admin can manage)
- [ ] Test price calculation (base_price + tax)

---

## 📊 Useful Queries

### Find Missing Pricing

```sql
-- Cities without pricing for a service
SELECT z.name AS zone, c.name AS city, st.name AS service
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

### Bulk Update Prices

```sql
-- Update all prices in a zone by percentage
UPDATE website_service_pricing
SET base_price = base_price * 1.1  -- 10% increase
WHERE zone_id = (SELECT id FROM zones WHERE name = 'North Zone');
```

### Export Pricing to CSV

```sql
-- Export for Super Admin review
COPY (
  SELECT * FROM website_pricing_view
  ORDER BY zone_name, city_name, service_name
) TO '/tmp/pricing_export.csv' WITH CSV HEADER;
```

---

## 🎯 Priority Actions

1. **High Priority:**
   - [ ] Add sample pricing data
   - [ ] Create API endpoints
   - [ ] Test price retrieval

2. **Medium Priority:**
   - [ ] Build Super Admin UI
   - [ ] Add price history tracking
   - [ ] Add bulk import/export

3. **Low Priority:**
   - [ ] Add price change notifications
   - [ ] Add pricing analytics
   - [ ] Add A/B testing for prices

---

## 📚 Related Files

- `CREATE_WEBSITE_SERVICE_PRICING.sql` - Main table
- `LINK_CITIES_TO_ZONES.sql` - City-zone linking
- `WEBSITE_PRICING_USAGE_EXAMPLES.sql` - SQL examples
- `INSERT_SAMPLE_WEBSITE_PRICING.sql` - Sample data

---

**Status:** ✅ Database Ready | ⏳ Frontend Integration Pending


# Book Service Page Debug Guide

## Debug Logging Added

Console me ab ye messages dikhenge:

### 1. Cities Fetch
```
📍 Fetching cities from database...
✅ Cities fetched successfully: X cities
```
Ya error:
```
❌ Error fetching cities: [error details]
Using fallback cities
```

### 2. Car Models Fetch
```
🚗 Fetching car models from database...
✅ Car models fetched successfully: X models
```

### 3. Service Types Fetch
```
🔧 Fetching service types from database...
✅ Service types fetched: X services
✅ Filtered services: X services matched
```

### 4. Pricing Fetch
```
💰 Fetching pricing... { city, carModel, class }
```

## How to Check:

1. **Open browser console**: Press `F12` or `Cmd+Option+I` (Mac)
2. **Go to Console tab**
3. **Reload the page**: `http://localhost:3000/book-service`
4. **Check for messages**

## Common Issues & Fixes:

### Issue 1: "Missing Supabase environment variables"
**Fix**: Check `.env.local` file exists in `apps/web/`
```bash
cd apps/web
cat .env.local
```

### Issue 2: Cities/Car Models not loading
**Possible causes**:
- Supabase credentials incorrect
- Database tables empty
- RLS policies blocking access

**Check database**:
```sql
-- Check if cities exist
SELECT COUNT(*) FROM cities WHERE is_active = true;

-- Check if car models exist
SELECT COUNT(*) FROM car_models WHERE is_active = true;

-- Check if service types exist
SELECT COUNT(*) FROM service_types WHERE is_active = true;
```

### Issue 3: Pricing not showing
**Causes**:
- `workshop_service_pricing` table empty
- No pricing set for selected city/class combination

**Fix**: Add pricing in Super Admin → Inventory → Service Pricing

## Browser Console Commands:

Check if data is loading:
```javascript
// Check if cities loaded
console.log('Cities:', document.querySelector('select[name="city"]'));

// Check Supabase client
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
```

## Next Steps:

1. Open browser console
2. Check for error messages
3. Share console output if issues persist


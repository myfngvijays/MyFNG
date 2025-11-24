# Service Type Names Fix

## Problem
Service type IDs (UUIDs) are showing instead of readable names across all dashboards.

## Solution
Created utility functions and database helpers to automatically convert service type IDs to names.

## Files Created

### 1. Database Helper (`database/CREATE_SERVICE_TYPE_HELPERS.sql`)
- Creates views for easy access to service types and subservices
- PostgreSQL functions to convert ID arrays to comma-separated names
- Run this in Supabase SQL Editor

### 2. Frontend Utility (`apps/web/src/utils/serviceTypeHelpers.ts`)
- `getServiceTypeNames()` - Async function to fetch names
- `getSubserviceNames()` - Async function to fetch subservice names
- React hooks for easy integration

## How to Use in Components

### Option 1: Direct Function Call
```typescript
import { getServiceTypeNames, getSubserviceNames } from '@/utils/serviceTypeHelpers';

// In your component
const serviceNames = await getServiceTypeNames(lead.service_type_ids);
const subserviceNames = await getSubserviceNames(lead.subservice_ids);
```

### Option 2: React Hook (Recommended)
```typescript
import { useServiceTypeNames, useSubserviceNames } from '@/utils/serviceTypeHelpers';

function LeadCard({ lead }) {
  const serviceNames = useServiceTypeNames(lead.service_type_ids);
  const subserviceNames = useSubserviceNames(lead.subservice_ids);
  
  return (
    <div>
      <p>Services: {serviceNames}</p>
      <p>Subservices: {subserviceNames}</p>
    </div>
  );
}
```

## Where to Apply

Apply this fix to:
- ✅ Mechanic Dashboard (`workshop_mechanic/page.tsx`)
- ✅ Mechanic Job Details (`workshop_mechanic/jobs/[id]/page.tsx`)
- ✅ Workshop Admin Dashboard
- ✅ Workshop Supervisor Dashboard
- ✅ Lead Manager Dashboard
- ✅ Telecaller Dashboard

## Next Steps
1. Run `CREATE_SERVICE_TYPE_HELPERS.sql` in Supabase
2. Import helpers in dashboard components
3. Replace UUID displays with helper functions


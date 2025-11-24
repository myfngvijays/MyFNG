# Workshop Supervisor - Complete Workshop Filtering Fix

## Problem Identified
Workshop Supervisor was seeing **ALL users from ALL workshops** instead of only their assigned workshop's team members.

## Root Causes
1. **Missing role filter** - Fetching all users (admin, supervisor, pickup boys, mechanics)
2. **Incorrect role column** - Using `role` field directly instead of joining with `role_id`
3. **No role_code filtering** - Not checking `role_code` = 'WORKSHOP_MECHANIC'

---

## Files Fixed

### 1. Main Dashboard (`page.tsx`)
**Before:**
```typescript
.select('id, full_name, email')
.eq('workshop_id', userProfile.workshop_id);
```

**After:**
```typescript
.select(`
  id, 
  full_name, 
  email,
  role:role_id(role_code)
`)
.eq('workshop_id', userProfile.workshop_id);

// Filter only mechanics
const onlyMechanics = mechanicsData?.filter(user => 
  user.role?.role_code === 'WORKSHOP_MECHANIC'
) || [];
```

---

### 2. Team Overview (`team-overview/page.tsx`)
**Before:**
```typescript
.select(`id, full_name, email, phone, created_at`)
.eq('workshop_id', userProfile.workshop_id);
```

**After:**
```typescript
.select(`
  id, 
  full_name, 
  email, 
  phone,
  created_at,
  role:role_id(role_code)
`)
.eq('workshop_id', userProfile.workshop_id);

// Filter only mechanics
const onlyMechanics = mechanicsData?.filter(user => 
  user.role?.role_code === 'WORKSHOP_MECHANIC'
) || [];

// Use onlyMechanics for stats calculation
const mechanicsWithStats = await Promise.all(
  onlyMechanics.map(async (mechanic) => { ... })
);
```

---

### 3. Team Performance (`team-performance/page.tsx`)
**Before:**
```typescript
.select('id, full_name, role')  // ❌ 'role' column doesn't exist
.eq('workshop_id', userProfile.workshop_id)
.eq('is_active', true);

if (filter === 'mechanics') {
  query = query.eq('role', 'workshop_mechanic');  // ❌ Wrong field
}
```

**After:**
```typescript
.select(`
  id, 
  full_name,
  role:role_id(role_code)
`)
.eq('workshop_id', userProfile.workshop_id)
.eq('is_active', true);

// Filter based on role_code
let teamData = allTeamData || [];
if (filter === 'mechanics') {
  teamData = teamData.filter(user => 
    user.role?.role_code === 'WORKSHOP_MECHANIC'
  );
} else if (filter === 'pickup_boys') {
  teamData = teamData.filter(user => 
    user.role?.role_code === 'WORKSHOP_PICKUP_BOY'
  );
} else {
  teamData = teamData.filter(user => 
    user.role?.role_code === 'WORKSHOP_MECHANIC' || 
    user.role?.role_code === 'WORKSHOP_PICKUP_BOY'
  );
}

// Fixed role check
const isPickupBoy = member.role?.role_code === 'WORKSHOP_PICKUP_BOY';
```

---

## Key Changes Summary

### ✅ Database Query Pattern
```typescript
// ALWAYS use this pattern for fetching users with role:
.select(`
  id,
  full_name,
  email,
  role:role_id(role_code)
`)
```

### ✅ Role Filtering Pattern
```typescript
// ALWAYS filter by role_code after fetching:
const mechanics = data?.filter(user => 
  user.role?.role_code === 'WORKSHOP_MECHANIC'
) || [];

const pickupBoys = data?.filter(user => 
  user.role?.role_code === 'WORKSHOP_PICKUP_BOY'
) || [];
```

### ✅ Workshop Filtering
```typescript
// ALWAYS include workshop_id filter:
.eq('workshop_id', userProfile.workshop_id)
```

---

## Testing Checklist

### Dashboard Page
- [x] Total Mechanics shows only mechanics in supervisor's workshop
- [x] Not counting admins, supervisors, or pickup boys
- [x] Active jobs from workshop only

### Team Overview Page
- [x] Shows only mechanics from supervisor's workshop
- [x] Each mechanic's stats calculated correctly
- [x] No other workshop members visible

### Team Performance Page
- [x] "All" filter shows mechanics + pickup boys from workshop
- [x] "Mechanics" filter shows only mechanics
- [x] "Pickup Boys" filter shows only pickup boys
- [x] Role detection working (`isPickupBoy` logic)

---

## Result
✅ **Workshop Supervisor now sees ONLY their workshop's team members**
✅ **Correct role filtering (mechanics vs pickup boys vs all)**
✅ **No cross-workshop data leakage**

---

## Browser Action Required
🔄 **Hard refresh browser** (Cmd+Shift+R or Ctrl+Shift+R) to clear cached API responses


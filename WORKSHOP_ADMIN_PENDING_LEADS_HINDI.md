# 🏪 Workshop Admin - Pending Leads Page बन गया ✅

## क्या-क्या Features बनाए हैं

### 1. ⏰ **20 Minute का SLA Timer + Blinking** ✅

**Real-time timer:**
- हर second update होता है
- 20 minutes का SLA (Service Level Agreement)
- Color coding:
  - 🟢 **Safe** (10 min se ज्यादा बाकी) - Green color
  - 🟡 **Warning** (5-10 min बाकी) - Yellow color
  - 🔴 **Critical** (5 min से कम) - Red + **Blink करता है!**
  - ⚫ **Overdue** (20 min पार हो गए) - Dark Red + **Pulse होता है!**

**Blinking Animation:**
- Critical leads **chamakte** रहते हैं
- Overdue leads **pulse** करते हैं
- Border bhi blink होती है (red border)

**Progress Bar:**
- Visual indicator
- Time के साथ color बदलता है
- Live updates

---

### 2. ✅❌ **Accept/Reject Buttons** ✅

**Accept Button:**
- Ek click में lead accept ho जाती है
- Status `ACCEPTED` बन जाता है
- Database में log होता है
- Instant update

**Reject Button:**
- Modal खुलता है
- Rejection reason select करना **compulsory** है
- Additional notes optional
- Status `REJECTED` बन जाता है
- Database में log होता है

**Rejection Reasons:**
- Out of service area
- Not enough capacity
- Service not available
- Pricing issue
- Other

---

### 3. 📊 **Stats Dashboard** ✅

**Teen cards:**
1. **Overdue (> 20 min)** - 🔴 Red card
2. **Critical (< 5 min)** - 🟡 Yellow card
3. **Total Pending** - 🔵 Blue card

**Real-time count:**
- Jaise hi lead accept/reject → count update
- Auto-refresh

---

### 4. 🔄 **Real-time Updates (Live)** ✅

**Supabase se connected:**
- Naya lead aaye → turant dikhe
- Koi lead accept/reject kare → instant update
- Manual refresh ki zaroorat nahi
- Automatic database sync

**Benefits:**
- Always up-to-date
- No delay
- Instant notifications

---

### 5. 📋 **Lead Ki Puri Details** ✅

**Har lead में 3 columns:**

**Column 1 - Lead Info:**
- Lead number (LEAD-001)
- Customer ka naam
- Phone number (click karo toh call lag sakta hai)

**Column 2 - Vehicle & Service:**
- Vehicle number (MH12AB1234)
- Car model (Honda City)
- Service type (Periodic Service)
- Amount (₹ format में)

**Column 3 - Extra Info:**
- Pickup required hai toh badge
- Address
- Customer ki problem description

---

### 6. 🎨 **Visual Effects** ✅

**SLA Status Badges:**
- ⚠️ **OVERDUE!** - Red badge with pulse animation
- 🚨 **URGENT!** - Red badge for critical
- 🕐 Timer icon bounce करता है when critical

**Lead Cards:**
- Critical leads की border **blink** होती है
- Overdue leads **pulse** करते हैं
- Hover पर shadow बढ़ता है

---

## Files

```
workshop_admin/
├── pending-leads/
│   └── page.tsx     ✅ NEW (SLA timer + Accept/Reject)
├── leads/
│   └── page.tsx     ✅ All leads
└── page.tsx         ✅ Dashboard
```

---

## Sidebar Menu Update

**Workshop Admin menu:**
```
🏪 Workshop Admin
├── 🏠 Dashboard
├── ⏰ Pending Approvals  ← NAYA PAGE!
├── 📋 All Leads
├── 👥 Staff Management
├── 🔧 Active Jobs
└── ⚙️ Settings
```

---

## Technical Details (Hindi mein)

### SLA Kaise Calculate hota hai:

```typescript
// 20 minutes ka SLA
const totalMinutes = 20;

// Current time se deadline ka difference
const minutesRemaining = deadline - now;

// Status decide karo
if (minutesRemaining < 0)  → OVERDUE (red + pulse)
if (minutesRemaining < 5)  → CRITICAL (red + blink)
if (minutesRemaining < 10) → WARNING (yellow)
if (minutesRemaining > 10) → SAFE (green)
```

### Timer Update (Har Second):

```typescript
// Har 1 second mein update
setInterval(() => {
  setCurrentTime(new Date());
}, 1000);
```

---

## Database Operations

### Lead Accept karne par:
```sql
UPDATE service_leads
SET status = 'ACCEPTED',
    accepted_at = NOW()
WHERE id = <lead_id>;

-- Activity log bhi
INSERT INTO lead_activities ...
```

### Lead Reject karne par:
```sql
UPDATE service_leads
SET status = 'REJECTED',
    rejected_reason = <reason>
WHERE id = <lead_id>;

-- Activity log
INSERT INTO lead_activities ...
```

---

## Page Ka Look (Text mein)

```
┌──────────────────────────────────────┐
│ ⏰ Pending Lead Approvals           │
│ (20 min SLA)        [🔄 Refresh]   │
└──────────────────────────────────────┘

┌──────────┬──────────┬──────────┐
│ Overdue  │ Critical │ Total    │
│  🔴 2    │  🟡 3   │  🔵 8    │
└──────────┴──────────┴──────────┘

┌──────────────────────────────────────┐ (BLINK!)
│ 🕐 SLA: 3m  🚨 URGENT!               │
│ ████░░░░░░░░░░░░ 25%  (Red bar)     │
├──────────────────────────────────────┤
│ LEAD-001                             │
│ Rajesh Kumar                         │
│ 📞 9876543210                        │
│                                      │
│ MH12AB1234 - Honda City             │
│ Periodic Service                     │
│ ₹5,000                               │
│                                      │
│ 🚚 Pickup Required                   │
│ 📍 Andheri West, Mumbai             │
│                                      │
│ [✅ Accept] [❌ Reject] [👁 View]  │
└──────────────────────────────────────┘
```

---

## Summary Table

| Feature | Status | Kya hai |
|---------|--------|---------|
| **20-min SLA Timer** | ✅ | Har second update |
| **Blinking** | ✅ | Critical leads blink |
| **Pulse Animation** | ✅ | Overdue leads pulse |
| **Accept Button** | ✅ | 1 click accept |
| **Reject Button** | ✅ | Reason ke saath |
| **Real-time** | ✅ | Auto-refresh |
| **Stats Cards** | ✅ | 3 cards |
| **Progress Bar** | ✅ | Visual timer |
| **Activity Log** | ✅ | Sab log hota hai |
| **Sidebar Link** | ✅ | Menu mein add |

---

## Kaise Use Karein

1. ✅ Workshop Admin login karo
2. ✅ Sidebar mein "Pending Approvals" par click karo
3. ✅ SLA timer dekhoge (countdown ho raha hai)
4. ✅ Critical leads **blink** kar rahe hain
5. ✅ "Accept" button click karo → Lead accepted
6. ✅ "Reject" button click karo → Modal khulega
7. ✅ Reason select karo (mandatory)
8. ✅ Notes add karo (optional)
9. ✅ Confirm karo → Lead rejected
10. ✅ Real-time updates dekhoge

---

## Important Points

**SLA Timer:**
- ⏰ 20 minutes hai total
- 🟢 10+ min → Safe (green)
- 🟡 5-10 min → Warning (yellow)
- 🔴 < 5 min → Critical (red + **BLINK**)
- ⚫ > 20 min → Overdue (dark red + **PULSE**)

**Blinking:**
- Critical leads ki **border blink** होती है
- Card **pulse** animation होता है
- Timer icon **bounce** करता है

**Accept/Reject:**
- ✅ Accept → Instant update
- ❌ Reject → Reason required
- Both actions database में log होते हैं

---

## Access

**URL:** `https://myfng.cloud/dashboard/workshop_admin/pending-leads`

**Navigation Path:**
```
Workshop Admin Dashboard
  → Sidebar
    → "Pending Approvals" (⏰ icon)
      → Page khul jayega
```

---

## Testing Steps

- [ ] Login as workshop admin
- [ ] "Pending Approvals" par jao
- [ ] Timer dekho (har second update ho raha hai?)
- [ ] Critical leads blink kar rahe hain?
- [ ] Accept button click karo
- [ ] Status "ACCEPTED" bana?
- [ ] Reject button click karo
- [ ] Reason form bharo
- [ ] Status "REJECTED" bana?
- [ ] Real-time update check karo
- [ ] Stats cards update ho rahe hain?

---

**Banaya:** 24 November 2025  
**Status:** ✅ Ready to Use  
**Features:** 10/10 Complete  
**SLA Timer:** ✅ Blinking + Real-time ⏰


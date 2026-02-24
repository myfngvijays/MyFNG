# Telecaller + RSA Manager Mobile Parity (Web Baseline)

## Scope
- Roles covered: `TELECALLER`, `RSA_MANAGER`
- Baseline: web dashboard routes/menu and visible actions/buttons
- Target: mobile app should be same-to-same for functional coverage (allowed UI differences)
- Status legend:
  - `Match`: feature exists and usable end-to-end in mobile
  - `Partial`: feature exists but missing some actions/flows/buttons
  - `Missing`: web feature not available on mobile

## Source Of Truth
- Web menu config: `/apps/web/src/components/DashboardLayout.tsx`
- Web role pages:
  - `/apps/web/src/app/dashboard/telecaller/**/page.tsx`
  - `/apps/web/src/app/dashboard/rsa_manager/**/page.tsx`
- Mobile navigator: `/apps/mobile/src/navigation/DashboardNavigator.tsx`
- Mobile role screens:
  - `/apps/mobile/src/screens/dashboard/TelecallerDashboard.tsx`
  - `/apps/mobile/src/screens/dashboard/telecaller/*.tsx`
  - `/apps/mobile/src/screens/dashboard/RSAManagerDashboard.tsx`
  - `/apps/mobile/src/screens/dashboard/rsa/*.tsx`

---

## TELECALLER

## 1) Web Menu Baseline (Expected)
- `/dashboard/telecaller` - Dashboard
- `/dashboard/telecaller/enquiry-leads` - Enquiry
- `/dashboard/telecaller/leads` - My Leads
- `/dashboard/telecaller/leads/create` - Create Lead
- `/dashboard/telecaller/rsa` - RSA module
- `/dashboard/telecaller/profile` - My Profile

## 2) Route/Screen Parity Matrix

| Web Route | Mobile Screen | Status | Notes |
|---|---|---|---|
| `/dashboard/telecaller` | `TelecallerDashboard` | Match | KPIs, quick actions, recent leads, follow-up cards present. |
| `/dashboard/telecaller/enquiry-leads` | `TelecallerEnquiryLeadsScreen` | Match | List + search + open detail present. |
| `/dashboard/telecaller/enquiry-leads/[id]` | `TelecallerEnquiryLeadDetailScreen` | Match | Note/call log/disposition/coupon/history present. |
| `/dashboard/telecaller/leads` | `TelecallerLeadsScreen` | Match | Queue list, filters, call/view/edit actions present. |
| `/dashboard/telecaller/leads/[id]` | `TelecallerLeadDetailScreen` | Match | Call/WhatsApp/edit, call log + follow-up forms present. |
| `/dashboard/telecaller/leads/create` | `TelecallerCreateLeadScreen` | Match | Multi-step create form with vehicle/service/coupon/location present. |
| `/dashboard/telecaller/leads/[id]/edit` | `TelecallerEditLeadScreen` | Match | Edit with city/vehicle/service/pickup and update action present. |
| `/dashboard/telecaller/followups` | `TelecallerFollowUpsScreen` | Match | Filters + complete/cancel/reschedule/call/view actions present. |
| `/dashboard/telecaller/profile` | `TelecallerProfileScreen` | Match | Edit/save/cancel profile flow present. |
| `/dashboard/telecaller/rsa` | (none) | Missing | Full telecaller RSA module absent on mobile. |
| `/dashboard/telecaller/rsa-complaints/create` | (none) | Missing | Create RSA complaint (telecaller side) absent on mobile. |
| `/dashboard/telecaller/rsa/complaints/[id]` | (none) | Missing | RSA complaint detail for telecaller absent on mobile. |

## 3) Detailed Action/Button Checklist (Web -> Mobile)

### A. Dashboard (`/dashboard/telecaller`)
- Web actions:
  - Quick links: `Create Lead`, `New Leads`, `Follow-ups`, `Scripts`
  - Lead card CTA: `Call`, `View Details`
  - KPI navigation cards/tiles
- Mobile parity:
  - `View Queue`, `Enquiry Leads`, `Create Lead`, `Follow-ups`, `Call Scripts`, `My Profile`
  - Recent lead tap -> lead detail
  - Upcoming follow-up: `Call Now`, `Reschedule`
- Status: `Match`

### B. Leads List (`/dashboard/telecaller/leads`)
- Web actions:
  - Search input
  - Filters: `All`, `New`, `Callback`, `Incomplete`, `Follow-up`, `In Progress`, `Completed`, `Rejected`
  - Per lead actions: `Call Now`, `View Details`, `Complete Info` (when incomplete), `WhatsApp`
  - Phone privacy toggle: `Show/Hide`
- Mobile parity:
  - Search + filter chips available
  - Per lead actions available via list/detail (`Call`, `View`, `Edit`, `WhatsApp`)
  - Incomplete lead edit supported
- Status: `Match`

### C. Lead Detail (`/dashboard/telecaller/leads/[id]`)
- Web actions:
  - `Call Customer`, `Edit Lead`
  - Call log section: toggle/add/save/cancel
  - Follow-up section: toggle/add/save/cancel
  - utility buttons (template-style actions)
- Mobile parity:
  - `Call`, `WhatsApp`, `Edit`
  - Add call log form with status/outcome/save/cancel
  - Add follow-up form with type/priority/schedule/save/cancel
- Status: `Match`

### D. Create/Edit Lead
- Web create actions:
  - Step navigation: `Previous`, `Next`, `Submit`
  - Coupon mode toggle + add/remove
  - `Get Current Location`
- Mobile create actions:
  - Step navigation: `Previous`, `Next`, `Create Lead`
  - Coupon mode toggle + selection/manual
  - `Get Current Location`
  - Service/add-ons selection and pickup toggle
- Web edit actions:
  - `Back`, `Save`/`Update`, coupon operations
- Mobile edit actions:
  - `Update Lead`, `Go Back`, same core editable fields
- Status: `Match`

### E. Follow-ups (`/dashboard/telecaller/followups`)
- Web actions:
  - Filters: `All Pending`, `Today`, `Overdue`, `Completed`
  - Search
  - Per follow-up: `Call Now`, `View Lead`, `Mark Done`, `Cancel`
- Mobile parity:
  - Same filters + search
  - Per follow-up: `Call Now`, `View Lead`, `Complete`, `Cancel`, `Reschedule`
  - Completion notes modal flow
- Status: `Match` (mobile has extra `Reschedule`)

### F. Enquiry Leads + Enquiry Lead Detail
- Web list actions:
  - Open lead `View`
  - columns for source/status/coupon/calls/follow-up
- Mobile list actions:
  - search + pull-to-refresh + open detail
- Web detail actions:
  - `Apply/Remove Coupon`
  - `Save Note`
  - `Log Call`
  - `Save Disposition`
- Mobile detail actions:
  - Same: add note, log call, disposition save, apply/remove coupon, date-time pickers
- Status: `Match`

### G. Profile (`/dashboard/telecaller/profile`)
- Web actions:
  - `Edit Profile`, `Save Changes`, `Cancel`, image upload control
- Mobile parity:
  - `Edit Profile`, `Save Changes`, `Cancel`
- Status: `Match` (image upload parity depends on API/storage handling)

### H. RSA Module (Telecaller side)
- Web actions (major):
  - Tabs: `Overview`, `Create Complaint`, `View Registered`, `Car Service`, `Collect Payment`, `Call Report`
  - Refresh buttons for lists/calls
  - Complaint card actions: view/edit/cancel/open
  - Payment link flow: `Generate Link`, `Copy`, `Open Link`, `Cancel Link`, `View Complaint`
  - Call report flow: `View Summary`, `View Audit`, `Save Disposition`, pagination
- Mobile parity:
  - Not present as telecaller RSA module/screens
- Status: `Missing`

### I. Mobile-only (not in web menu baseline)
- `TelecallerScriptsScreen` (explicit scripts browsing/copy)
- `TeamManagerViewScreen` (team members + unassigned leads)
- Status: `Partial` (extra mobile functionality; not parity blocker)

---

## RSA_MANAGER

## 1) Web Menu Baseline (Expected)
- `/dashboard/rsa_manager` - Dashboard
- `/dashboard/rsa_manager/leads` - View All Complaints
- `/dashboard/rsa_manager/create-complaint` - Create Complaint
- `/dashboard/rsa_manager/car-service-enquiry` - Car Service Enquiry
- `/dashboard/rsa_manager/registered` - View Registered
- `/dashboard/rsa_manager/rsa-sessions` - Active Aansh Sessions
- `/dashboard/rsa_manager/payments` - Payment
- `/dashboard/rsa_manager/mechanics` - Manage Mechanics
- `/dashboard/rsa_manager/membership-customer` - Membership Customer
- `/dashboard/rsa_manager/reports` - Reports
- `/dashboard/rsa_manager/settings` - Settings

## 2) Route/Screen Parity Matrix

| Web Route | Mobile Screen | Status | Notes |
|---|---|---|---|
| `/dashboard/rsa_manager` | `RSAManagerDashboard` | Partial | Core leads/stats/filter present; web call-report tab not available. |
| `/dashboard/rsa_manager/leads` | `RSALeadsScreen` | Match | Search/filter/list and claim path available. |
| `/dashboard/rsa_manager/leads/[id]` | `RSALeadDetailScreen` | Match | Claim/assign/update status/call/map/assign mechanic present. |
| `/dashboard/rsa_manager/mechanics` | `RSAMechanicsScreen` | Match | Search/filter/list/call/detail open present. |
| `/dashboard/rsa_manager/mechanics/[id]` | `RSAMechanicDetailScreen` | Match | Contact/actions/history navigation present. |
| `/dashboard/rsa_manager/create-complaint` | (none) | Missing | No mobile create complaint screen for RSA manager. |
| `/dashboard/rsa_manager/car-service-enquiry` | (none) | Missing | Create/view car service enquiries missing on mobile. |
| `/dashboard/rsa_manager/registered` | (none) | Missing | Registered complaints list missing on mobile. |
| `/dashboard/rsa_manager/rsa-sessions` | (none) | Missing | Active Aansh sessions view/remove missing on mobile. |
| `/dashboard/rsa_manager/payments` | (none) | Missing | Payment link generation/refund flow missing on mobile. |
| `/dashboard/rsa_manager/membership-customer` | (none) | Missing | Membership customer module missing on mobile. |
| `/dashboard/rsa_manager/reports` | (none) | Missing | Reports/filters/analytics missing on mobile. |
| `/dashboard/rsa_manager/settings` | (none) | Missing | Settings/profile/preferences/security missing on mobile. |
| (mobile) `AddMechanic` | `AddMechanicScreen` | Partial | Mobile-only feature; web uses in-page add/edit flow in mechanics module. |

## 3) Detailed Action/Button Checklist (Web -> Mobile)

### A. Dashboard (`/dashboard/rsa_manager`)
- Web actions:
  - Top tabs: `Overview`, `Call Report`
  - status quick links: assigned/pending/completed/cancelled
  - overview filter chips and pagination
  - call report actions: `Summary`, `Recording`, `Audit`, `Disposition`
- Mobile parity:
  - KPI cards, filter chips, claim action, list open
  - No dedicated `Call Report` tab/modal suite
- Status: `Partial`

### B. Leads List (`/dashboard/rsa_manager/leads`)
- Web actions:
  - Search
  - filters: `My Complaints`, `Pending`, `Completed`, `Cancelled`
  - list -> detail, `Claim`
- Mobile parity:
  - Search + filters + list -> detail
  - `Claim Lead` action present
- Status: `Match`

### C. Lead Detail (`/dashboard/rsa_manager/leads/[id]`)
- Web actions:
  - `Claim Lead`, `Assign to Manager`, `Assign Mechanic`, `Update Status`
  - Pincode edit/detect from map
  - mechanic amount edit/save
  - open map/call actions
- Mobile parity:
  - `Claim Lead`, `Assign to Manager`, `Assign Mechanic`, `Update Status`
  - Call and map launch present
  - Manager/mechanic selection modals present
- Status: `Match` (some fine-grained finance/pincode edit subflows may be web-first)

### D. Mechanics (`/dashboard/rsa_manager/mechanics` + `[id]`)
- Web actions:
  - Search + availability/service filters
  - open mechanic detail
  - add/edit mechanic
  - call numbers, assignment history navigation
- Mobile parity:
  - Search + filters + availability filter
  - open detail + call primary/alternate
  - assignment list/detail path
  - separate add mechanic screen
- Status: `Match`

### E. Create Complaint (`/dashboard/rsa_manager/create-complaint`)
- Web actions:
  - RSA complaint creation form and submit
- Mobile parity:
  - Not available
- Status: `Missing`

### F. Car Service Enquiry (`/dashboard/rsa_manager/car-service-enquiry`)
- Web actions:
  - create enquiry `Submit`
  - `View/Hide` submitted list
  - `Refresh` history
- Mobile parity:
  - Not available
- Status: `Missing`

### G. Registered (`/dashboard/rsa_manager/registered`)
- Web actions:
  - list unassigned registered complaints
  - search + refresh + open detail
- Mobile parity:
  - Not available
- Status: `Missing`

### H. Aansh Sessions (`/dashboard/rsa_manager/rsa-sessions`)
- Web actions:
  - list active sessions
  - `Remove` session
  - `Refresh`
- Mobile parity:
  - Not available
- Status: `Missing`

### I. Payments (`/dashboard/rsa_manager/payments`)
- Web actions:
  - payment link flow: `Generate Link`, `Copy`, `Open`, `Refresh`, `Cancel`
  - refund modal flow: open/submit/close
  - open linked complaint
- Mobile parity:
  - Not available
- Status: `Missing`

### J. Membership Customer (`/dashboard/rsa_manager/membership-customer`)
- Web actions:
  - membership customer dashboard/operations
- Mobile parity:
  - Not available
- Status: `Missing`

### K. Reports (`/dashboard/rsa_manager/reports`)
- Web actions:
  - date presets/range, refresh, trends/table links to lead detail
- Mobile parity:
  - Not available
- Status: `Missing`

### L. Settings (`/dashboard/rsa_manager/settings`)
- Web actions:
  - profile save
  - notifications/preferences toggles
  - reset defaults
  - open security links
- Mobile parity:
  - Not available
- Status: `Missing`

---

## Consolidated Gap Backlog (P0 / P1 / P2)

## P0 (Critical parity blockers)
- Telecaller RSA module on mobile:
  - `/dashboard/telecaller/rsa`
  - `/dashboard/telecaller/rsa-complaints/create`
  - `/dashboard/telecaller/rsa/complaints/[id]`
- RSA Manager missing major modules on mobile:
  - `create-complaint`
  - `payments`
  - `registered`

## P1 (High impact)
- RSA Manager:
  - `car-service-enquiry`
  - `reports`
  - `settings`
  - `rsa-sessions`
- Dashboard parity gap:
  - RSA manager `call_report` tab and its summary/audit/disposition actions

## P2 (Completeness / quality)
- `membership-customer` module for RSA Manager on mobile
- Normalize mobile-only extras (`TeamManagerView`, scripts placement) with web IA decisions
- Optional parity hardening:
  - align edge actions (finance/pincode edit subflows) in RSA lead detail if required by product

---

## Final Snapshot
- Telecaller parity: **Strong**, except complete RSA submodule missing on mobile.
- RSA Manager parity: **Core complaint + mechanics flow present**, but multiple web modules are still missing on mobile.
- To achieve "same to same" strictly, start with all `P0` items first.

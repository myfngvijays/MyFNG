 # Android vs Web Parity Audit (Post-Login)
 
 ## Scope
 - Android app vs Web app (post-login only).
 - Public pages excluded.
 - All roles from `shared/constants/roles.ts`.
 - Goal: mobile should match web functionality, but be app-friendly.
 
 ## Sources (repo)
 - Roles: `shared/constants/roles.ts`
 - Web role menus: `apps/web/src/components/DashboardLayout.tsx`
 - Web routes: `apps/web/src/app/dashboard/**/page.tsx`
 - Android role stacks: `apps/mobile/src/navigation/DashboardNavigator.tsx`
 - Android screens: `apps/mobile/src/screens/dashboard/**`
 
 ## Legend
 - Match: feature exists in both web and Android.
 - Partial: exists but incomplete or different coverage.
 - Missing: present on web but not on Android, or vice versa.
 
 ## Role Inventory (Canonical)
 SUPER_ADMIN, SUB_ADMIN, LEAD_MANAGER, RSA_MANAGER, HOME_SERVICE_MANAGER,
 TELECALLER, CUSTOMER_SERVICE_EXECUTIVE, AUDITOR, ACCOUNTS_TEAM,
 WORKSHOP_ADMIN, WORKSHOP_SUPERVISOR, WORKSHOP_MECHANIC, WORKSHOP_PICKUP_BOY,
 COMPANY_MECHANIC_RSA, COMPANY_VAN_TECHNICIAN, COMPANY_VAN_DRIVER,
 DIGITAL_MARKETING, DIGITAL_AUTHOR, CUSTOMER
 
 ---
 
 ## Role-wise Parity
 
 ### SUPER_ADMIN
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/super_admin` | `SuperAdminDashboard` | Match | Dashboard present. |
 | `/dashboard/super_admin/users` | `UserRoleManagement` | Match | User/role management. |
 | `/dashboard/super_admin/workshops` | `WorkshopManagement` | Match | Workshop management. |
 | `/dashboard/super_admin/reports` | `ReportsAnalytics` | Match | Reports & analytics. |
 | `/dashboard/super_admin/analytics` | `SuperAdminAnalytics` | Match | Analytics screen. |
 | `/dashboard/super_admin/settings` | `SystemSettings` | Match | System settings. |
 | `/dashboard/super_admin/leads` | `LeadsManagement` | Match | Leads management. |
 | `/dashboard/super_admin/finance` | `FinancePayout` | Partial | Mobile covers payouts; web includes broader finance. |
 | `/dashboard/super_admin/fraud` | `FraudDetection` | Match | Fraud detection. |
 | `/dashboard/super_admin/audit-logs` | `AuditLogs` | Match | Audit logs. |
 | `/dashboard/super_admin/security-events` | `SecurityEvents` | Match | Security events. |
 | `/dashboard/super_admin/config-changes` | `ConfigChanges` | Match | Config changes. |
 | `/dashboard/super_admin/compliance-reports` | `ComplianceReports` | Match | Compliance reports. |
 | `/dashboard/super_admin/brands` | `Brands` | Match | Brands. |
 | `/dashboard/super_admin/inventory/products` | `InventoryProducts` | Match | Inventory products. |
 | `/dashboard/super_admin/inventory/packages` | `InventoryPackages` | Match | Inventory packages. |
 | `/dashboard/super_admin/inventory/packages/[id]` | `InventoryPackageDetail` | Match | Package detail. |
 | `/dashboard/super_admin/inventory/zones` | `InventoryZones` | Match | Inventory zones. |
 | `/dashboard/super_admin/inventory/pricing` | `InventoryPricing` | Match | Inventory pricing. |
 | `/dashboard/super_admin/inventory/service-pricing` | `InventoryServicePricing` | Match | Service pricing. |
 | `/dashboard/super_admin/workshops/[id]/rates` | `WorkshopRates` | Match | Workshop rates. |
 | `/dashboard/super_admin/additional-jobs-master` | (none) | Missing | Mobile missing additional jobs master. |
 | `/dashboard/super_admin/workshops/public-pages` | (none) | Missing | Mobile missing public pages. |
 | `/dashboard/super_admin/coupons` | (none) | Missing | Mobile missing coupons. |
 | `/dashboard/super_admin/kb-manager` | (none) | Missing | Mobile missing KB manager. |
 | `/dashboard/super_admin/kb-questions` | (none) | Missing | Mobile missing KB questions. |
 | `/dashboard/super_admin/website-images` | (none) | Missing | Mobile missing website images. |
 | `/dashboard/super_admin/manual-invoices` | (none) | Missing | Mobile missing manual invoices. |
 | `/dashboard/super_admin/telecaller-distribution` | (none) | Missing | Mobile missing telecaller distribution. |
 | `/dashboard/super_admin/lead-history/[leadId]` | (none) | Missing | Mobile missing lead history view. |
 
 ### SUB_ADMIN
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/sub_admin` | `SubAdminDashboard` | Match | Dashboard. |
 | `/dashboard/sub_admin/team` | `SubAdminTeam` | Match | Team management. |
 | `/dashboard/sub_admin/leads` | `SubAdminLeads` | Match | Leads. |
 | `/dashboard/sub_admin/escalations` | `SubAdminEscalations` | Match | Escalations. |
 | `/dashboard/sub_admin/performance` | `SubAdminPerformance` | Match | Performance. |
 | `/dashboard/sub_admin/profile` | `SubAdminProfile` | Match | Profile. |
 | `/dashboard/sub_admin/telecaller` | (none) | Missing | Mobile has no telecaller subview under sub-admin. |
 | `/dashboard/sub_admin/cse` | (none) | Missing | Mobile has no CSE subview under sub-admin. |
 | `/dashboard/sub_admin/auditor` | (none) | Missing | Mobile has no auditor subview under sub-admin. |
 | (none) | `SubAdminTickets` | Partial | Mobile has tickets, not visible in web routes. |
 | (none) | `SubAdminCallbacks` | Partial | Mobile has callbacks, not visible in web routes. |
 | (none) | `SubAdminAudits` | Partial | Mobile has audits, not visible in web routes. |
 
 ### LEAD_MANAGER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/lead_manager` | `LeadManagerDashboard` | Match | Dashboard. |
 | `/dashboard/lead_manager/leads` | `LeadManagerLeads` | Match | Leads list. |
 | `/dashboard/lead_manager/leads/[id]` | `LeadManagerLeadDetail` | Match | Lead detail. |
 | `/dashboard/lead_manager/workshops` | `LeadManagerWorkshops` | Match | Workshops list. |
 | `/dashboard/lead_manager/workshops/[id]` | `LeadManagerWorkshopDetail` | Match | Workshop detail. |
 | `/dashboard/lead_manager/reports` | `LeadManagerReports` | Match | Reports. |
 | `/dashboard/lead_manager/escalations` | `LeadManagerEscalations` | Match | Escalations. |
 | (none) | `LeadManagerAssignWorkshop` | Partial | Assign workshop flow appears only on Android. |
 
 ### RSA_MANAGER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/rsa_manager` | `RSAManagerDashboard` | Match | Dashboard. |
 | `/dashboard/rsa_manager/leads` | `RSALeads` | Match | Leads list. |
 | `/dashboard/rsa_manager/leads/[id]` | `RSALeadDetail` | Match | Lead detail. |
 | `/dashboard/rsa_manager/mechanics` | `RSAMechanics` | Match | Mechanics list. |
 | `/dashboard/rsa_manager/mechanics/[id]` | `RSAMechanicDetail` | Match | Mechanic detail. |
 | (none) | `AddMechanic` | Partial | Add mechanic only on Android. |
 
 ### HOME_SERVICE_MANAGER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | (none) | `HSMDashboard` | Missing | Web has no home_service_manager routes. |
 | (none) | `HSMLeads` | Missing | Web missing. |
 | (none) | `HSMLeadDetail` | Missing | Web missing. |
 | (none) | `HSMVans` | Missing | Web missing. |
 | (none) | `HSMTechnicians` | Missing | Web missing. |
 | (none) | `HSMReports` | Missing | Web missing. |
 
 ### TELECALLER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/telecaller` | `TelecallerDashboard` | Match | Dashboard. |
 | `/dashboard/telecaller/enquiry-leads` | (none) | Missing | Android missing enquiry leads. |
 | `/dashboard/telecaller/leads` | `TelecallerLeads` | Match | Leads list. |
 | `/dashboard/telecaller/leads/[id]` | `TelecallerLeadDetail` | Match | Lead detail. |
 | `/dashboard/telecaller/leads/create` | `TelecallerCreateLead` | Match | Create lead. |
 | `/dashboard/telecaller/leads/[id]/edit` | `TelecallerEditLead` | Match | Edit lead. |
 | `/dashboard/telecaller/followups` | `TelecallerFollowUps` | Match | Follow-ups. |
 | `/dashboard/telecaller/profile` | `TelecallerProfile` | Match | Profile. |
 | (none) | `TelecallerScripts` | Partial | Android has scripts, web not listed. |
 | (none) | `TeamManagerView` | Partial | Android has team manager view, web not listed. |
 
 ### CUSTOMER_SERVICE_EXECUTIVE (CSE)
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/cse` | `CSEDashboard` | Match | Dashboard. |
 | `/dashboard/cse/call-panel` | `CSECallPanel` | Match | Call panel. |
 | `/dashboard/cse/tickets` | `CSETickets` | Match | Ticket list. |
 | `/dashboard/cse/tickets/create` | `CSECreateTicket` | Match | Create ticket. |
 | `/dashboard/cse/tickets/[id]` | `CSETicketDetail` | Match | Ticket detail. |
 | `/dashboard/cse/callbacks` | `CSECallbacks` | Match | Callbacks. |
 | `/dashboard/cse/ratings` | `CSERatings` | Match | Ratings. |
 | `/dashboard/cse/leads/[id]` | `CSELeadDetail` | Match | Lead detail. |
 | `/dashboard/cse/leads/[id]/follow-up` | `CSEFollowUps` | Match | Follow-ups. |
 | `/dashboard/cse/leads/[id]/close` | `CloseComplaint` | Partial | Android has close complaint screen. |
 | `/dashboard/cse/profile` | `CSEProfile` | Match | Profile. |
 | (none) | `ComplaintsManagement` | Partial | Android has complaints list; web not listed. |
 
 ### AUDITOR
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/auditor` | `AuditorDashboard` | Match | Dashboard. |
 | `/dashboard/auditor/audits` | `AuditQueue` | Match | Audit queue. |
 | `/dashboard/auditor/audits/[id]` | `LeadAuditDetail` | Match | Audit detail. |
 | `/dashboard/auditor/workshops` | `AuditorWorkshops` | Match | Workshops. |
 | `/dashboard/auditor/escalations` | `AuditorEscalations` | Match | Escalations. |
 | `/dashboard/auditor/performance` | `AuditorPerformance` | Match | Performance. |
 | `/dashboard/auditor/profile` | `AuditorProfile` | Match | Profile. |
 | (none) | `FraudDetection` (auditor) | Partial | Android has fraud detection; web auditor lacks. |
 
 ### ACCOUNTS_TEAM (Billing)
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/billing` | `BillingDashboard` | Match | Billing dashboard. |
 | `/dashboard/billing/invoices/review` | `InvoiceReview` | Match | Invoice review list. |
 | `/dashboard/billing/invoices/[id]` | `BillingInvoiceDetail` | Match | Invoice detail. |
 | `/dashboard/billing/leads/[id]/generate-invoice` | `GenerateInvoice` | Match | Generate invoice. |
 | `/dashboard/billing/invoices/[id]/payment` | `PaymentTracking` | Partial | Android has payment tracking; web uses payment route. |
 | `/dashboard/accounts/reconciliation` | (none) | Missing | Android missing reconciliation. |
 
 ### WORKSHOP_ADMIN
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/workshop_admin` | `WorkshopAdminDashboard` | Match | Dashboard. |
 | `/dashboard/workshop_admin/pending-leads` | `PendingLeads` | Match | Pending leads. |
 | `/dashboard/workshop_admin/leads` | `WorkshopAdminLeadsList` | Match | Leads list. |
 | `/dashboard/workshop_admin/leads/[id]` | `WorkshopAdminLeadDetail` | Match | Lead detail. |
 | `/dashboard/workshop_admin/leads/[id]/assign-team` | `WorkshopAdminJobAssignment` | Partial | Android uses job assignment. |
 | `/dashboard/workshop_admin/jobs` | `ActiveJobs` | Match | Active jobs. |
 | `/dashboard/workshop_admin/staff` | `WorkshopAdminStaffManagement` | Match | Staff management. |
 | `/dashboard/workshop_admin/pickup-tracking` | `WorkshopAdminPickupTracking` | Match | Pickup tracking. |
 | `/dashboard/workshop_admin/reports` | `WorkshopAdminReports` | Match | Reports. |
 | `/dashboard/workshop_admin/settings` | `WorkshopAdminSettings` | Match | Settings. |
 | `/dashboard/workshop_admin/public-page` | (none) | Missing | Android missing public page management. |
 | `/dashboard/workshop_admin/additional-jobs-master` | (none) | Missing | Android missing additional jobs master. |
 
 ### WORKSHOP_SUPERVISOR
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/workshop_supervisor` | `WorkshopSupervisorDashboard` | Match | Dashboard. |
 | `/dashboard/workshop_supervisor/pending-leads` | `PendingLeads` | Match | Pending leads. |
 | `/dashboard/workshop_supervisor/day-planning` | `DayPlanning` | Match | Day planning. |
 | `/dashboard/workshop_supervisor/jobs` | `SupervisorJobs` | Match | Jobs list. |
 | `/dashboard/workshop_supervisor/jobs/[id]` | `JobDetail` | Match | Job detail. |
 | `/dashboard/workshop_supervisor/jobs/[id]/review` | `QCReview` | Partial | Android has QC review screen. |
 | `/dashboard/workshop_supervisor/qc-queue` | `QCCheck` | Match | QC queue. |
 | `/dashboard/workshop_supervisor/extra-work` | `ExtraWorkApproval` | Match | Extra work approval. |
 | `/dashboard/workshop_supervisor/pickup-delivery` | `PickupDeliveryTracking` | Match | Pickup & delivery. |
 | `/dashboard/workshop_supervisor/additional-jobs-master` | (none) | Missing | Android missing additional jobs master. |
 | `/dashboard/workshop_supervisor/team-overview` | `TeamOverview` | Match | Team overview. |
 | `/dashboard/workshop_supervisor/team-performance` | `TeamPerformance` | Match | Team performance. |
 | `/dashboard/workshop_supervisor/daily-report` | `DailyReport` | Match | Daily report. |
 | `/dashboard/workshop_supervisor/analytics` | `SupervisorAnalytics` | Match | Analytics. |
 | `/dashboard/workshop_supervisor/performance` | `SupervisorPerformance` | Match | Performance. |
 | `/dashboard/workshop_supervisor/profile` | `SupervisorProfile` | Match | Profile. |
 | `/dashboard/workshop_supervisor/job-assignments` | `MechanicAssignment` | Partial | Android has mechanic assignment; confirm parity. |
 | (none) | `SupervisorMenu` | Partial | Android menu screen not in web. |
 | (none) | `JobMonitoring` | Partial | Android job monitoring not in web. |
 
 ### WORKSHOP_MECHANIC
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/workshop_mechanic` | `MechanicDashboard` | Match | Dashboard. |
 | `/dashboard/workshop_mechanic/jobs` | `MechanicJobsScreen` | Match | Jobs list. |
 | `/dashboard/workshop_mechanic/jobs/[id]` | `MechanicJobDetail` | Match | Job detail. |
 | `/dashboard/workshop_mechanic/jobs/[id]/manage` | (none) | Missing | Android has no explicit manage route. |
 | `/dashboard/workshop_mechanic/history` | `JobHistory` | Match | Job history. |
 | `/dashboard/workshop_mechanic/performance` | `Performance` | Match | Performance. |
 | `/dashboard/workshop_mechanic/profile` | `Profile` | Match | Profile. |
 | (none) | `BeforeInspection` | Partial | Android has before inspection. |
 | (none) | `AfterServicePhotos` | Partial | Android has after service photos. |
 | (none) | `LeadDetail` | Partial | Android includes lead detail screen. |
 
 ### WORKSHOP_PICKUP_BOY
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/workshop_pickup_boy` | `WorkshopPickupBoyDashboard` | Match | Dashboard. |
 | `/dashboard/workshop_pickup_boy/tasks` | `PickupTasks` | Match | Task list. |
 | `/dashboard/workshop_pickup_boy/tasks/[id]` | `PickupJobDetail` | Match | Task detail. |
 | `/dashboard/workshop_pickup_boy/history` | `TaskHistory` | Match | Task history. |
 | `/dashboard/workshop_pickup_boy/profile` | `PickupBoyProfile` | Match | Profile. |
 | (none) | `PickupOtp` | Partial | Android adds OTP verification. |
 | (none) | `PickupPhotoUpload` | Partial | Android adds photo upload flow. |
 | (none) | `PickupIncident` | Partial | Android adds incident report flow. |
 
 ### COMPANY_MECHANIC_RSA
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | (none) | `CMRSADashboard` | Missing | Web missing company mechanic RSA role. |
 | (none) | `CMRSATasks` | Missing | Web missing. |
 | (none) | `CMRSATaskDetail` | Missing | Web missing. |
 | (none) | `CMRSAHistory` | Missing | Web missing. |
 | (none) | `CMRSAProfile` | Missing | Web missing. |
 
 ### COMPANY_VAN_TECHNICIAN
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | (none) | `CVTDashboard` | Missing | Web missing company van technician. |
 | (none) | `CVTTasks` | Missing | Web missing. |
 | (none) | `CVTTaskDetail` | Missing | Web missing. |
 | (none) | `CVTHistory` | Missing | Web missing. |
 | (none) | `CVTProfile` | Missing | Web missing. |
 
 ### COMPANY_VAN_DRIVER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | (none) | `CVDDashboard` | Missing | Web missing company van driver. |
 | (none) | `CVDTasks` | Missing | Web missing. |
 | (none) | `CVDTaskDetail` | Missing | Web missing. |
 | (none) | `CVDHistory` | Missing | Web missing. |
 | (none) | `CVDProfile` | Missing | Web missing. |
 
 ### DIGITAL_MARKETING
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/digital_marketing` | `DigitalMarketingDashboard` | Match | Dashboard. |
 | `/dashboard/digital_marketing/campaigns` | `DMCampaigns` | Match | Campaigns. |
 | `/dashboard/digital_marketing/analytics` | `DMAnalytics` | Match | Analytics. |
 | `/dashboard/digital_marketing/leads` | `DMLeads` | Match | Leads. |
 | `/dashboard/digital_marketing/profile` | `DMProfile` | Match | Profile. |
 | `/dashboard/digital_marketing/blogs` | `DMContent` | Partial | Android has content, not full blog CRUD. |
 | `/dashboard/digital_marketing/blogs/create` | (none) | Missing | Android missing blog creation. |
 | `/dashboard/digital_marketing/blogs/[id]` | (none) | Missing | Android missing blog detail. |
 | `/dashboard/digital_marketing/blogs/[id]/edit` | (none) | Missing | Android missing blog editing. |
 | `/dashboard/digital_marketing/blogs/categories` | (none) | Missing | Android missing category mgmt. |
 
 ### DIGITAL_AUTHOR
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/digital_author` | (none) | Missing | Android has screens but not wired in navigator. |
 | `/dashboard/digital_author/blogs` | (none) | Missing | Android missing author blog list. |
 | `/dashboard/digital_author/blogs/create` | (none) | Missing | Android missing create flow. |
 | `/dashboard/digital_author/blogs/[id]` | (none) | Missing | Android missing blog detail. |
 | `/dashboard/digital_author/blogs/[id]/edit` | (none) | Missing | Android missing blog edit. |
 | `/dashboard/digital_author/profile` | (none) | Missing | Android missing profile for author. |
 
 ### CUSTOMER
 | Web (route) | Android (screen) | Status | Notes |
 | --- | --- | --- | --- |
 | `/dashboard/customer` | `CustomerDashboard` | Match | Dashboard. |
 | `/dashboard/customer/service-history` | `CustomerServiceHistory` | Match | Service history. |
 | (menu: bookings) | `BookService` | Partial | Web menu shows bookings but no route found. |
 | (menu: vehicles) | (none) | Missing | Web menu shows vehicles but no route found. |
 | `/dashboard/customer/support` | `CustomerSupport` | Partial | Web route not found; mobile has support. |
 | (none) | `TrackBooking` | Partial | Android has track booking, web route not found. |
 | (none) | `CustomerInvoices` | Partial | Android has invoices, web route not found. |
 | `/dashboard/customer/profile` | (none) | Missing | Web menu shows profile but no route found. |
 
 ---
 
 ## Cross-role Shared Functions (Post-Login)
 - Login/role redirect: web in `/login`, mobile in `App.tsx` + `DashboardNavigator.tsx`.
 - Notifications: web uses `NotificationBell` in dashboard header; mobile has `NotificationBell` and `NotificationsScreen`.
 - Profile access: web has profile routes for most roles; mobile has profile screens for most roles (missing for Digital Author in navigator).
 - Lead detail workflows: present across telecaller, lead manager, supervisor, mechanic, CSE, auditor; parity generally strong with some Android-only flows (photos, OTP, incident).
 - Media upload flows: Android has explicit photo upload and inspection screens; web has fewer direct routes for these flows.
 
 ## Mobile App-Friendliness Checklist (Apply per role)
 - Touch targets >= 44px and buttons reachable with one hand.
 - Long lists: use search + filters + pagination or infinite scroll.
 - Forms: auto-advance, numeric keyboards, inline validation.
 - Media: camera capture, offline retry, clear upload progress.
 - Navigation depth: keep critical tasks within 2-3 taps from dashboard.
 - Status updates: prominent CTA, minimal typing, tap-to-update.
 
 ## Gaps Summary (Priority)
 1. Missing on Android for Super Admin: public pages, coupons, KB, website images, manual invoices, telecaller distribution, lead history.
 2. Missing on Web for field roles: home_service_manager, company_mechanic_rsa, company_van_technician, company_van_driver.
 3. Digital Author not wired on Android (screens exist but no navigator role).
 4. Customer web routes not fully implemented (bookings, vehicles, support, profile vs menu).
 5. Workshop Additional Jobs Master missing on Android for admin/supervisor roles.

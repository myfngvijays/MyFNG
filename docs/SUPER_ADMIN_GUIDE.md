# Super Admin Guide - MyFNG Platform

This guide covers all Super Admin features and functionalities available in the MyFNG platform.

## Overview

The Super Admin role has complete access to the entire system and can manage all aspects of the platform including users, workshops, leads, reports, audit logs, and system settings.

## Dashboard Pages

### 1. Main Dashboard (`/dashboard/super_admin`)

The main dashboard provides an at-a-glance view of the entire system:

**Features:**
- **Real-time Statistics:**
  - Total active users count
  - Active leads count
  - Total workshops count
  - System status
  
- **Recent Activity Feed:**
  - Displays recent audit log entries
  - Shows user actions and system events
  - Automatically refreshed from database

- **Quick Actions:**
  - Direct links to all management pages
  - One-click access to key functions

---

### 2. User Management (`/dashboard/super_admin/users`)

Comprehensive user management system for all 17 role types in the platform.

**Features:**
- **User List View:**
  - Display all users with their roles and status
  - Shows user profile information
  - Workshop assignment (if applicable)
  - Contact details (email, phone)
  - Last login timestamp

- **Search & Filters:**
  - Search by name, email, or phone
  - Filter by role type
  - Filter by status (active/inactive)

- **User Actions:**
  - Toggle user active/inactive status
  - Edit user details (placeholder for form)
  - View user profile
  - Export user list

- **Statistics:**
  - Total users count
  - Active users count
  - Inactive users count
  - Total roles available

**User Status Management:**
- Click on the status badge to toggle between active/inactive
- Changes are immediately reflected in the database
- Status changes affect user login permissions

---

### 3. Workshop Management (`/dashboard/super_admin/workshops`)

Complete workshop management system with verification and performance tracking.

**Features:**
- **Workshop Grid View:**
  - Visual card-based layout
  - Workshop details (name, address, contact)
  - Verification status
  - Audit score (star rating out of 5)

- **Workshop Metrics:**
  - Staff count (linked users)
  - Active leads count
  - Completed leads count

- **Search & Filters:**
  - Search by name, city, or contact person
  - Filter by verification status
  - View all, verified only, or unverified only

- **Workshop Actions:**
  - Verify/Unverify workshop
  - Edit workshop details (placeholder)
  - View workshop performance

- **Statistics:**
  - Total workshops count
  - Verified workshops count
  - Pending verification count
  - Average audit score across all workshops

**Verification System:**
- One-click verification toggle
- Verified workshops get priority in lead assignment
- Audit scores (0-5 stars) track performance

---

### 4. Leads Overview (`/dashboard/super_admin/leads`)

System-wide lead monitoring across all three lead types (NORMAL, RSA, HOME_SERVICE).

**Features:**
- **Comprehensive Lead View:**
  - Lead number and service type
  - Customer information (name, phone, email)
  - Vehicle details (number, make, model, year)
  - Location information
  - Workshop assignment
  - Assigned personnel
  - Estimated and actual amounts
  - Current status with color coding

- **Lead Statistics:**
  - Total leads count
  - Normal leads count
  - RSA leads count
  - Home Service leads count
  - Active leads count
  - Completed leads count

- **Search & Filters:**
  - Search by lead number, customer, vehicle, or phone
  - Filter by lead type (NORMAL/RSA/HOME_SERVICE)
  - Filter by status (NEW, ASSIGNED, ACCEPTED, IN_PROGRESS, COMPLETED, REJECTED, CANCELLED)
  - Export functionality

- **Status Color Coding:**
  - NEW: Blue
  - ASSIGNED: Purple
  - ACCEPTED: Green
  - IN_PROGRESS: Yellow
  - COMPLETED: Green
  - REJECTED: Red
  - CANCELLED: Gray

---

### 5. Reports & Analytics (`/dashboard/super_admin/reports`)

Business intelligence and performance metrics dashboard.

**Features:**
- **Revenue Overview:**
  - Total revenue with trend percentage
  - Revenue breakdown by service type
    - Normal services revenue
    - RSA services revenue
    - Home services revenue
  - Trend comparison vs previous period

- **Leads Performance:**
  - Total leads in period
  - Completed leads count
  - Cancelled leads count
  - Conversion rate (completion percentage)

- **User Analytics:**
  - Total active users
  - Breakdown by role type
  - Shows distribution across 17 roles

- **Top Performing Workshops:**
  - Ranked table of workshops
  - Metrics: completed leads and revenue
  - Shows top 5 performers
  - Location information

- **Date Range Selection:**
  - Last 7 days
  - Last 30 days (default)
  - Last 90 days
  - Last 365 days (full year)

- **Export Functionality:**
  - Export reports to CSV/PDF (placeholder)

---

### 6. Audit Logs (`/dashboard/super_admin/audit-logs`)

GDPR-compliant system activity monitoring.

**Features:**
- **Log Display:**
  - Action type (CREATE, UPDATE, DELETE, etc.)
  - Table name affected
  - User who performed action
  - Timestamp of action
  - IP address
  - User agent
  - Record ID affected

- **Data Change Tracking:**
  - View old data (before change)
  - View new data (after change)
  - Expandable details view
  - JSON format for technical review

- **Search & Filters:**
  - Search by action, table, or user
  - Filter by action type
  - Filter by table name

- **Statistics:**
  - Total logs count
  - Today's activity count
  - Unique users count
  - Tables monitored count

- **Pagination:**
  - 50 logs per page
  - Previous/Next navigation
  - Current page indicator

**Compliance:**
- Supports GDPR audit requirements
- Tracks all data modifications
- Immutable log records
- Configurable retention period

---

### 7. System Settings (`/dashboard/super_admin/settings`)

Complete system configuration management.

**Settings Categories:**

#### A. General Settings
- Application name configuration
- Support email address
- Support phone number
- Timezone selection (IST/UTC/EST)
- Date format preferences (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)

#### B. Notification Settings
- **Email Notifications:** Toggle system-wide email alerts
- **SMS Notifications:** Enable/disable SMS for critical updates
- **Push Notifications:** Mobile push notification settings
- **Lead Assignment Notifications:** Alert when leads are assigned
- **Status Change Notifications:** Notify on lead status updates
- **Daily Reports:** Enable automatic daily summary emails

#### C. Security Settings
- **Session Timeout:** Configure automatic logout (minutes)
- **Password Requirements:** Minimum password length
- **Login Attempts:** Maximum failed attempts before lockout
- **Email Verification:** Require email verification before login
- **Two-Factor Authentication:** Enforce 2FA system-wide

#### D. GDPR & Compliance Settings
- **Data Retention Period:** Days to retain user data after deletion
- **Audit Log Retention:** Days to keep audit logs
- **User Data Export:** Allow users to request their data
- **User Data Deletion:** Right to be forgotten functionality
- **Consent Required:** Enforce user consent for data processing

**Save Functionality:**
- Save changes button at bottom of each section
- Settings persist across system
- Changes apply immediately

---

## Database Integration

All Super Admin pages are connected to real Supabase database:

### Tables Used:
1. **users_login** - User management
2. **roles** - Role definitions
3. **workshops** - Workshop data
4. **service_leads** - All lead types
5. **audit_logs** - Activity tracking
6. **pickup_delivery_tasks** - Task management

### Real-time Features:
- Live data fetching with React useEffect
- Automatic updates on actions
- Loading states during data fetch
- Error handling and fallbacks

---

## Access Control

**Route Protection:**
- All `/dashboard/super_admin/*` routes require Super Admin role
- Authentication checked via Supabase Auth
- Automatic redirect to login if unauthorized

**Data Security:**
- Role-based data filtering
- Secure API calls through Supabase client
- Environment variables for sensitive config
- GDPR-compliant data handling

---

## Navigation

**Quick Access:**
From the main Super Admin dashboard, click any quick action card:
- 👥 Manage Users → User management page
- 🏢 Manage Workshops → Workshop management page
- 📄 View Leads → Leads overview page
- 📊 Reports → Reports & analytics page
- 🛡️ Audit Logs → Audit logs viewer
- ⚙️ Settings → System settings page

**Breadcrumbs:**
Use browser back button or dashboard navigation to return to main dashboard.

---

## Key Features Summary

✅ **Complete User Management** - CRUD operations for all users  
✅ **Workshop Verification** - Approve and manage partner workshops  
✅ **Lead Monitoring** - View all leads across the platform  
✅ **Business Analytics** - Revenue and performance reports  
✅ **Audit Logging** - GDPR-compliant activity tracking  
✅ **System Configuration** - Complete settings management  
✅ **Real-time Data** - Live database integration  
✅ **Responsive Design** - Works on desktop, tablet, and mobile  
✅ **Search & Filters** - Easy data discovery  
✅ **Export Functionality** - Download reports and data  

---

## Technical Stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript
- **Backend:** Supabase (PostgreSQL, Auth, Real-time)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React Hooks (useState, useEffect)

---

## Future Enhancements

Planned features for future releases:

1. **User Forms:** Complete create/edit user modals
2. **Workshop Forms:** Complete create/edit workshop modals
3. **Bulk Operations:** Multi-select and bulk actions
4. **Advanced Filters:** Date ranges, complex queries
5. **Chart Visualizations:** Graphs and charts in reports
6. **Email Templates:** Customizable notification templates
7. **Role Permissions Editor:** Visual permission management
8. **Data Import/Export:** CSV/Excel bulk operations
9. **Real-time Notifications:** WebSocket-based alerts
10. **Mobile App:** Dedicated mobile application

---

## Support

For technical support or feature requests, contact the development team or refer to the main project documentation.

---

**Last Updated:** November 2024  
**Version:** 1.0.0  
**Platform:** MyFNG - Vehicle Service Management System


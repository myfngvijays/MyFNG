# 📊 SUB_ADMIN Schema Analysis

## ✅ EXISTING TABLES (Can be used as-is)

### 1. User Management
- ✅ `users_login` - Has `department` field (needs constraint)
- ✅ `users_login` - Has `assigned_manager_id` field (can be used for team relationships)

### 2. Customer Service (CSE)
- ✅ `customer_complaints` - For CSE tickets/complaints
  - Fields: `status`, `assigned_to`, `escalated_to_level`, `escalated_at`, `refund_requested`, `refund_issued`
- ✅ `support_tickets` - Alternative ticket system
  - Fields: `status`, `assigned_to`, `escalated`, `escalated_to`, `escalated_at`
- ✅ `cse_followups` - CSE follow-up tracking
- ✅ `cse_performance_metrics` - CSE performance tracking
- ✅ `refund_requests` - Refund management (for CSE Sub Admin approvals)

### 3. Telecaller
- ✅ `telecaller_follow_ups` - Follow-up tracking
- ✅ `telecaller_call_logs` - Call logs
- ✅ `telecaller_performance_metrics` - Performance metrics
- ✅ `service_leads` - Has telecaller fields:
  - `assigned_telecaller_id`, `is_incomplete`, `incomplete_reason`, `follow_up_required`, `next_follow_up_at`

### 4. Auditor
- ✅ `workshop_audits` - Audit management
  - Fields: `audit_status`, `approved_by`, `approved_at`, `rejection_reason`
- ✅ `audit_checklist_items` - Audit checklist
- ✅ `audit_action_items` - Action items from audits
- ✅ `auditor_performance_metrics` - Performance metrics
- ✅ `audit_media` - Audit photos/media

### 5. Common Tables
- ✅ `notifications` - For Sub Admin notifications
- ✅ `lead_activities` - Activity tracking
- ✅ `lead_status_history` - Status change history
- ✅ `service_leads` - Main leads table (used by all departments)

---

## 🆕 NEW TABLES TO CREATE

### 1. Team Management
**Table:** `subadmin_team_assignments`
- Purpose: Link Sub Admin to their team members (CSE, Telecaller, Auditor)
- File: `database/69_create_subadmin_team_management.sql`

### 2. Actions Log
**Table:** `subadmin_actions`
- Purpose: Audit trail of all Sub Admin actions
- File: `database/70_create_subadmin_actions.sql`

### 3. SLA Monitoring
**Table:** `subadmin_sla_monitoring`
- Purpose: Track SLA deadlines and breaches for each department
- File: `database/71_create_sla_monitoring.sql`

### 4. Escalations
**Table:** `escalations`
- Purpose: Central escalation management
- File: `database/72_create_escalation_management.sql`

---

## 🔧 MIGRATIONS TO RUN

### Migration Order:
1. ✅ `68_add_subadmin_department_constraint.sql` - Add constraint to existing `department` field
2. ✅ `69_create_subadmin_team_management.sql` - Create team assignments table
3. ✅ `70_create_subadmin_actions.sql` - Create actions log table
4. ✅ `71_create_sla_monitoring.sql` - Create SLA monitoring table
5. ✅ `72_create_escalation_management.sql` - Create escalations table

---

## 📋 TABLE RELATIONSHIPS

### CSE Sub Admin Workflow:
```
subadmin_team_assignments (CSE team)
  ↓
customer_complaints / support_tickets
  ↓
escalations (if escalated)
  ↓
refund_requests (if refund needed)
```

### Telecaller Sub Admin Workflow:
```
subadmin_team_assignments (Telecaller team)
  ↓
service_leads (incomplete/duplicate leads)
  ↓
telecaller_follow_ups
  ↓
escalations (if escalated to Lead Manager)
```

### Auditor Sub Admin Workflow:
```
subadmin_team_assignments (Auditor team)
  ↓
workshop_audits
  ↓
audit_action_items
  ↓
escalations (if quality issues found)
```

---

## 🎯 KEY POINTS

1. **Department Field**: Already exists, just needs constraint
2. **Team Management**: Can use `assigned_manager_id` OR create new `subadmin_team_assignments` table (we're creating new table for flexibility)
3. **Tickets**: Use `customer_complaints` for CSE (has all needed fields)
4. **Audits**: Use `workshop_audits` (has approval fields)
5. **Leads**: Use `service_leads` (has telecaller fields)
6. **Performance**: Use existing metrics tables (`cse_performance_metrics`, `telecaller_performance_metrics`, `auditor_performance_metrics`)

---

## ✅ NEXT STEPS

1. Run all 5 migrations in order
2. Create RLS policies for new tables
3. Implement API endpoints
4. Build frontend components


# MyFNG API Documentation

## Base URL
```
Supabase: https://your-project.supabase.co
```

## Authentication

All requests require authentication via Supabase Auth:

```typescript
// Get session token
const { data: { session } } = await supabase.auth.getSession();
const token = session?.access_token;
```

## Database Tables

### 1. users_login

User profiles and authentication.

**Columns:**
- `id` (uuid) - Primary key, matches Supabase Auth user
- `email` (string) - User email
- `phone` (string) - Phone number
- `full_name` (string) - Full name
- `role_id` (uuid) - Foreign key to roles table
- `workshop_id` (uuid) - Foreign key to workshops (optional)
- `is_active` (boolean) - Account status
- `created_at` (timestamp)
- `updated_at` (timestamp)

**Query Examples:**

```typescript
// Get current user profile
const { data } = await supabase
  .from('users_login')
  .select(`
    *,
    role:roles(role_code, role_name),
    workshop:workshops(*)
  `)
  .eq('id', userId)
  .single();

// Update profile
await supabase
  .from('users_login')
  .update({ full_name: 'New Name' })
  .eq('id', userId);
```

### 2. service_leads

Service requests and bookings.

**Columns:**
- `id` (uuid) - Primary key
- `lead_number` (string) - Auto-generated (LN000123, RSA000045, HS000067)
- `lead_type` (enum) - NORMAL | RSA | HOME_SERVICE
- `customer_name`, `customer_phone`, `vehicle_number`
- `status` (enum) - NEW | ASSIGNED | ACCEPTED | REJECTED | IN_PROGRESS | COMPLETED | CANCELLED
- `priority` (enum) - LOW | MEDIUM | HIGH | URGENT
- `assigned_to_id` (uuid) - Workshop or mechanic
- `workshop_id` (uuid) - Workshop handling the lead

**Query Examples:**

```typescript
// Get leads for workshop admin
const { data } = await supabase
  .from('service_leads')
  .select('*')
  .eq('workshop_id', workshopId)
  .eq('status', 'PENDING');

// Accept lead (Workshop Admin)
await supabase
  .from('service_leads')
  .update({ 
    status: 'ACCEPTED',
    accepted_at: new Date().toISOString()
  })
  .eq('id', leadId);

// Reject lead (Workshop Admin)
await supabase
  .from('service_leads')
  .update({ 
    status: 'REJECTED',
    declined_at: new Date().toISOString()
  })
  .eq('id', leadId);
```

### 3. pickup_delivery_tasks

Pickup and delivery tasks.

**Columns:**
- `id` (uuid)
- `task_number` (string) - Auto-generated
- `task_type` (enum) - PICKUP | DELIVERY | BOTH
- `status` (enum) - PENDING | ASSIGNED | IN_TRANSIT | COMPLETED | CANCELLED
- `customer_name`, `vehicle_number`, `pickup_address`
- `assigned_to_id` (uuid) - Pickup boy

**Query Examples:**

```typescript
// Get tasks for pickup boy
const { data } = await supabase
  .from('pickup_delivery_tasks')
  .select('*')
  .eq('assigned_to_id', userId)
  .in('status', ['PENDING', 'IN_TRANSIT']);

// Update task status
await supabase
  .from('pickup_delivery_tasks')
  .update({ status: 'IN_TRANSIT' })
  .eq('id', taskId);
```

### 4. media_files

Photos and documents.

**Columns:**
- `id` (uuid)
- `related_table` (string) - Table name
- `related_id` (uuid) - Record ID
- `file_type` (string) - before_photo, after_photo, pickup_photo, etc.
- `file_url` (string) - Supabase Storage URL
- `uploaded_by` (uuid)

**Query Examples:**

```typescript
// Upload photo
const file = selectedFile;
const filePath = `photos/${Date.now()}-${file.name}`;

const { data: uploadData } = await supabase.storage
  .from('media')
  .upload(filePath, file);

const { data: { publicUrl } } = supabase.storage
  .from('media')
  .getPublicUrl(filePath);

// Save metadata
await supabase.from('media_files').insert({
  related_table: 'service_leads',
  related_id: leadId,
  file_type: 'before_photo',
  file_url: publicUrl,
  uploaded_by: userId
});

// Get photos for lead
const { data } = await supabase
  .from('media_files')
  .select('*')
  .eq('related_table', 'service_leads')
  .eq('related_id', leadId);
```

## Database Functions

### generate_lead_number()

Auto-generates lead numbers based on type.

**Trigger:** Automatically called on INSERT

**Format:**
- Normal: LN000001, LN000002...
- RSA: RSA000001, RSA000002...
- Home Service: HS000001, HS000002...

### log_audit_event()

Logs actions for GDPR compliance.

```typescript
// Called automatically via triggers, or manually:
await supabase.rpc('log_audit_event', {
  p_user_id: userId,
  p_action: 'UPDATE',
  p_table_name: 'service_leads',
  p_record_id: leadId,
  p_old_data: oldData,
  p_new_data: newData,
  p_ip_address: ipAddress,
  p_user_agent: userAgent
});
```

### process_data_deletion()

Processes GDPR data deletion requests.

```typescript
// Called by admin
await supabase.rpc('process_data_deletion', {
  p_request_id: requestId,
  p_processed_by: adminId
});
```

## Row Level Security (RLS)

All tables have RLS policies based on user roles:

```sql
-- Example: Workshop Admin can only see their workshop's leads
CREATE POLICY "workshop_admin_leads" ON service_leads
  FOR SELECT
  USING (
    workshop_id = (SELECT workshop_id FROM users_login WHERE id = auth.uid())
  );
```

## Real-time Subscriptions

Subscribe to real-time changes:

```typescript
// Subscribe to new leads
const subscription = supabase
  .channel('leads')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'service_leads',
    filter: `workshop_id=eq.${workshopId}`
  }, (payload) => {
    console.log('New lead:', payload.new);
  })
  .subscribe();

// Unsubscribe when done
subscription.unsubscribe();
```

## Error Handling

```typescript
try {
  const { data, error } = await supabase
    .from('service_leads')
    .select('*');
    
  if (error) throw error;
  
  return data;
} catch (error) {
  console.error('Error:', error.message);
  // Handle error appropriately
}
```

## Best Practices

1. **Always use transactions** for multi-step operations
2. **Check user permissions** before operations
3. **Log important actions** for audit trail
4. **Handle errors gracefully**
5. **Use indexes** for frequently queried columns
6. **Paginate** large result sets
7. **Subscribe selectively** to avoid performance issues

## Rate Limits

Supabase free tier limits:
- 500 MB database
- 1 GB file storage
- 2 GB bandwidth
- No real-time connection limit

## Support

For API issues:
- Check Supabase Dashboard logs
- Review RLS policies
- Verify user permissions
- Check network connectivity

---

*For more information, visit [Supabase Documentation](https://supabase.com/docs)*


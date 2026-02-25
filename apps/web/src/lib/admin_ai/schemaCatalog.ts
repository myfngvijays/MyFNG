type TableSchemaInfo = {
  description: string;
  columns: Record<string, { purpose: string; dataType: string } | string>;
};

const schemaCatalog: Record<string, TableSchemaInfo> = {
  sarv_calls: {
    description: 'Inbound/outbound call records from SARV integration.',
    columns: {
      callid: 'External SARV call identifier.',
      cnumber: 'Customer mobile number associated with the call.',
      talkduration: 'Agent-customer talk time in seconds.',
      recording_url: 'Audio recording URL for call playback/download.',
      summary: 'AI-generated summary of the call.',
      disposition: 'Primary call outcome selected by agent/system.',
      disposition_category: 'Categorized bucket of the disposition.',
      assigned_user_id: 'Internal user assigned to this call.',
      assigned_role: 'Role of assignee (e.g., TELECALLER, RSA_MANAGER).',
      created_at: 'Server-side row creation timestamp.',
    },
  },
  sarv_call_audits: {
    description: 'Quality audit records for SARV calls.',
    columns: {
      sarv_call_id: 'Linked sarv_calls.id value.',
      audit_status: 'Audit outcome status.',
      audit_score: 'Audit score value.',
      feedback: 'Auditor remarks.',
      audited_at: 'Timestamp when audit was performed.',
    },
  },
  rsa_leads: {
    description: 'Roadside assistance lead records and resolution lifecycle.',
    columns: {
      lead_status: 'Current RSA lead status.',
      complaint_status: 'Complaint progression status.',
      lead_registered_at: 'Lead registration timestamp.',
      requested_at: 'Requested service timestamp.',
      customer_quoted_amount: 'Amount quoted to customer.',
      payment_received: 'Amount received from customer.',
      payment_to_mechanic: 'Mechanic payout amount.',
      address: 'Customer/service address.',
      pincode: 'Customer/service pincode.',
      contact_number: 'Primary customer contact number.',
      alternate_number: 'Alternate customer contact number.',
    },
  },
  service_leads: {
    description: 'Primary service booking pipeline table.',
    columns: {
      lead_number: 'Human-readable lead number.',
      lead_type: 'Lead classification (NORMAL, RSA, HOME_SERVICE).',
      status: 'Lead workflow status.',
      workshop_id: 'Assigned workshop ID.',
      assigned_telecaller_id: 'Telecaller assignment ID.',
      city: 'Lead city value at booking time.',
      pincode: 'Lead pincode value.',
      customer_satisfaction_score: 'Customer feedback rating score.',
      created_at: 'Lead creation timestamp.',
      completed_at: 'Lead completion timestamp.',
    },
  },
  workshops: {
    description: 'Workshop master and profile data.',
    columns: {
      name: 'Workshop display name.',
      city: 'Workshop city.',
      state: 'Workshop state.',
      pincode: 'Workshop pincode.',
      is_verified: 'Verification flag.',
      is_active: 'Active/inactive status.',
      phone: 'Primary workshop contact number.',
      map_link: 'Google map or location URL.',
    },
  },
  invoices: {
    description: 'Invoice and payment state records.',
    columns: {
      invoice_number: 'Generated invoice number.',
      final_amount: 'Total invoice amount after taxes/discount.',
      payment_status: 'Invoice payment state.',
      paid_amount: 'Amount paid by customer.',
      paid_at: 'Payment completion timestamp.',
      lead_id: 'Linked service lead ID.',
    },
  },
  manual_invoices: {
    description: 'Manual invoice entries uploaded or created by ops.',
    columns: {
      invoice_number: 'Manual invoice reference number.',
      amount: 'Invoice amount value.',
      customer_phone: 'Customer phone reference.',
      status: 'Manual invoice processing status.',
      created_at: 'Creation timestamp.',
    },
  },
  users_login: {
    description: 'Internal user accounts table.',
    columns: {
      email: 'User email address.',
      phone: 'User phone number.',
      full_name: 'User full name.',
      role_id: 'Role reference.',
      is_active: 'User active flag.',
      department: 'Department assignment.',
      workshop_id: 'Linked workshop ID if applicable.',
    },
  },
  roles: {
    description: 'System role definitions and permissions.',
    columns: {
      role_code: 'Programmatic role code (e.g., SUPER_ADMIN).',
      role_name: 'Human-readable role name.',
      permissions: 'Permission JSON payload.',
      is_active: 'Role enabled/disabled flag.',
    },
  },
  customer_complaints: {
    description: 'Customer complaints and issue tracking.',
    columns: {
      status: 'Complaint status.',
      created_at: 'Complaint creation timestamp.',
      lead_id: 'Linked service lead ID if available.',
    },
  },
  workshop_payouts: {
    description: 'Workshop payout requests and settlement status.',
    columns: {
      workshop_id: 'Linked workshop.',
      amount: 'Payout amount.',
      status: 'Payout status.',
      created_at: 'Payout entry timestamp.',
    },
  },
  refund_requests: {
    description: 'Refund requests and lifecycle states.',
    columns: {
      amount: 'Requested refund amount.',
      status: 'Refund status.',
      lead_id: 'Linked service lead.',
      created_at: 'Request creation timestamp.',
    },
  },
  audit_logs: {
    description: 'System audit trail for admin and critical actions.',
    columns: {
      action: 'Action identifier.',
      table_name: 'Impacted table name.',
      record_id: 'Impacted record ID.',
      action_category: 'Audit category (SECURITY/CONFIG/DATA/etc).',
      severity: 'Severity level.',
      error_message: 'Captured error details when present.',
      created_at: 'Event timestamp.',
    },
  },
};

function withTypes(input: Record<string, string>): Record<string, { purpose: string; dataType: string }> {
  const out: Record<string, { purpose: string; dataType: string }> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = { purpose: v, dataType: 'unknown' };
  }
  return out;
}

for (const key of Object.keys(schemaCatalog)) {
  const item = schemaCatalog[key];
  const values = Object.values(item.columns as any);
  if (values.length > 0 && typeof values[0] === 'string') {
    (item as any).columns = withTypes(item.columns as any);
  }
}

const tableDescriptions: Record<string, string> = {
  cities: 'City master and pincode association data.',
  zones: 'Zone mapping for pricing and operations.',
  car_models: 'Car model master with class segmentation.',
  service_types: 'Service catalog and category mapping.',
  workshop_service_pricing: 'Service pricing overrides by workshop/city/class.',
  pincode_city_state: 'Pincode to district/state mapping.',
};

export function listKnownTables() {
  return Array.from(new Set([...Object.keys(schemaCatalog), ...Object.keys(tableDescriptions)])).sort((a, b) =>
    a.localeCompare(b)
  );
}

export function describeTableSchema(table: string) {
  const key = String(table || '').trim();
  if (!key) return null;
  const fromDetailed = schemaCatalog[key];
  if (fromDetailed) return fromDetailed;
  const fallbackDesc = tableDescriptions[key];
  if (!fallbackDesc) return null;
  return { description: fallbackDesc, columns: {} as Record<string, { purpose: string; dataType: string }> };
}

export function describeColumn(table: string, column: string) {
  const t = String(table || '').trim();
  const c = String(column || '').trim();
  if (!t || !c) return null;
  const tableInfo = schemaCatalog[t];
  if (!tableInfo) return null;
  const val = tableInfo.columns[c];
  if (!val) return null;
  if (typeof val === 'string') return { purpose: val, dataType: 'unknown' };
  return val;
}


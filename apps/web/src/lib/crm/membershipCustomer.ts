function phoneKey(phone: unknown): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

/** Active membership phones for the leads on this page. */
export async function attachMembershipFlags<T extends Record<string, any>>(
  db: any,
  leads: T[],
): Promise<T[]> {
  const phones = Array.from(new Set(leads.map((lead) => phoneKey(lead.customer_phone)).filter(Boolean)));
  const members = new Set<string>();
  if (!phones.length) return leads.map((lead) => ({ ...lead, has_membership: false }));

  try {
    const idByPhone = new Map<string, string>();
    for (let i = 0; i < phones.length; i += 40) {
      const chunk = phones.slice(i, i + 40);
      const or = chunk.map((p) => `phone.eq.${p},phone.eq.91${p},phone.ilike.%${p}`).join(',');
      const { data, error } = await db.from('customers').select('id, phone').or(or).limit(200);
      if (error) throw error;
      for (const row of data || []) {
        const key = phoneKey(row.phone);
        if (key && chunk.includes(key)) idByPhone.set(key, String(row.id));
      }
    }

    const ids = Array.from(new Set(idByPhone.values()));
    if (ids.length) {
      const now = new Date().toISOString();
      const { data: mems, error } = await db
        .from('customer_memberships')
        .select('customer_id')
        .in('customer_id', ids)
        .eq('status', 'ACTIVE')
        .gt('ends_at', now);
      if (error) throw error;
      const active = new Set((mems || []).map((row: { customer_id?: string }) => String(row.customer_id || '')));
      for (const [phone, id] of idByPhone) {
        if (active.has(id)) members.add(phone);
      }
    }
  } catch (err) {
    console.warn('[membership] lookup skipped', err);
  }

  return leads.map((lead) => ({
    ...lead,
    has_membership: members.has(phoneKey(lead.customer_phone)),
  }));
}

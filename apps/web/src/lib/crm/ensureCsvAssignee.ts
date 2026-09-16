import { randomBytes } from 'crypto';

function slugName(name: string): string {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
}

function isUsableEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function ensureCsvAssigneeUserId(
  writer: any,
  input: { name?: string | null; email?: string | null },
): Promise<{ id: string | null; created: boolean; name: string; email?: string }> {
  const name = String(input.name || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  if (!name && !email) return { id: null, created: false, name: '' };

  const { data: roleRow } = await writer
    .from('roles')
    .select('id')
    .eq('role_code', 'TELECALLER')
    .maybeSingle();
  const telecallerRoleId = roleRow?.id ? String(roleRow.id) : null;

  if (name.length >= 2) {
    const { data } = await writer
      .from('users_login')
      .select('id, full_name, email')
      .ilike('full_name', name)
      .limit(5);
    const exact = (data || []).find(
      (row: any) => String(row.full_name || '').trim().toLowerCase() === name.toLowerCase(),
    );
    if (exact?.id) {
      return {
        id: String(exact.id),
        created: false,
        name: String(exact.full_name || name),
        email: exact.email ? String(exact.email) : undefined,
      };
    }
  }

  if (email) {
    const { data } = await writer
      .from('users_login')
      .select('id, full_name, email')
      .ilike('email', email)
      .limit(1)
      .maybeSingle();
    const existingName = String(data?.full_name || '').trim().toLowerCase();
    const nameMatches =
      !name ||
      !existingName ||
      existingName === name.toLowerCase() ||
      existingName.includes(name.toLowerCase());
    if (data?.id && nameMatches) {
      return {
        id: String(data.id),
        created: false,
        name: String(data.full_name || name),
        email: String(data.email || email),
      };
    }
  }

  if (!telecallerRoleId) return { id: null, created: false, name };

  const generatedEmail = `telecrm.${slugName(name) || 'agent'}.${randomBytes(3).toString('hex')}@myfng.co.in`;
  let fallbackEmail = isUsableEmail(email) ? email : generatedEmail;

  const { data: existingEmail } = await writer
    .from('users_login')
    .select('id, full_name, email')
    .ilike('email', fallbackEmail)
    .limit(1)
    .maybeSingle();
  if (existingEmail?.id) {
    const existingName = String(existingEmail.full_name || '').trim().toLowerCase();
    if (!name || existingName === name.toLowerCase()) {
      return {
        id: String(existingEmail.id),
        created: false,
        name: String(existingEmail.full_name || name),
        email: String(existingEmail.email || fallbackEmail),
      };
    }
    fallbackEmail = generatedEmail;
  }

  const password = `MyFNG#${randomBytes(8).toString('hex')}`;
  const { data: authUser, error: authError } = await writer.auth.admin.createUser({
    email: fallbackEmail,
    password,
    email_confirm: true,
    user_metadata: { full_name: name || fallbackEmail, imported_from: 'telecrm_csv' },
  });

  if (authError || !authUser?.user?.id) {
    if (/already|registered|exists/i.test(String(authError?.message || ''))) {
      const { data } = await writer
        .from('users_login')
        .select('id, full_name, email')
        .ilike('email', fallbackEmail)
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        return {
          id: String(data.id),
          created: false,
          name: String(data.full_name || name),
          email: String(data.email || fallbackEmail),
        };
      }
    }
    console.warn('[csv-assignee] create auth user failed', authError?.message || authError);
    return { id: null, created: false, name };
  }

  const { data: userData, error: insertError } = await writer
    .from('users_login')
    .insert([
      {
        id: authUser.user.id,
        full_name: name || fallbackEmail,
        email: fallbackEmail,
        phone: null,
        role_id: telecallerRoleId,
        is_active: true,
      },
    ])
    .select('id, full_name, email')
    .maybeSingle();

  if (insertError || !userData?.id) {
    console.warn('[csv-assignee] users_login insert failed', insertError?.message || insertError);
    try {
      await writer.auth.admin.deleteUser(authUser.user.id);
    } catch {
      /* ignore */
    }
    return { id: null, created: false, name };
  }

  return {
    id: String(userData.id),
    created: true,
    name: String(userData.full_name || name),
    email: String(userData.email || fallbackEmail),
  };
}

export function workshopKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function matchWorkshopId(
  name: string,
  workshops: Array<{ id?: string; name?: string | null; workshop_name?: string | null; workshop_area?: string | null; city?: string | null }>,
): string | null {
  const want = workshopKey(name);
  if (!want || !workshops?.length) return null;
  const scored = workshops
    .map((w) => {
      const labels = [w.name, w.workshop_name, w.workshop_area, w.city]
        .map((v) => workshopKey(String(v || '')))
        .filter(Boolean);
      const exact = labels.some((label) => label === want);
      const partial = labels.some((label) => label.includes(want) || want.includes(label));
      return { id: w.id ? String(w.id) : '', exact, partial };
    })
    .filter((row) => row.id && (row.exact || row.partial));
  return scored.find((row) => row.exact)?.id || scored[0]?.id || null;
}

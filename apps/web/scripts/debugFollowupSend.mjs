import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '../.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const phone = String(process.argv[2] || '9167456023').replace(/\D/g, '').slice(-10);

  const { data: inst } = await db
    .from('whatsapp_agent_instances')
    .select('id,phone,status,end_reason,updated_at,metadata')
    .eq('phone', phone)
    .eq('agent_type', 'FOLLOWUP')
    .order('updated_at', { ascending: false })
    .limit(3);

  const ids = (inst || []).map((i) => i.id);
  const { data: actions } = ids.length
    ? await db
        .from('whatsapp_agent_actions')
        .select('instance_id,execution_status,validated_action,message_sent,block_reason,created_at,event_type')
        .in('instance_id', ids)
        .order('created_at', { ascending: false })
        .limit(8)
    : { data: [] };

  const normalized = phone.startsWith('91') ? phone : `91${phone}`;
  const { data: msgs } = await db
    .from('whatsapp_messages')
    .select('direction,text_body,created_at,status,error_message,sender_phone,recipient_phone')
    .or(`sender_phone.eq.${normalized},recipient_phone.eq.${normalized},sender_phone.eq.${phone},recipient_phone.eq.${phone}`)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: inbound } = await db
    .from('whatsapp_messages')
    .select('created_at,direction,sender_phone')
    .eq('direction', 'INBOUND')
    .eq('sender_phone', normalized)
    .order('created_at', { ascending: false })
    .limit(1);

  console.log(JSON.stringify({ phone, normalized, lastInbound: inbound?.[0] || null, instances: inst, actions, msgs }, null, 2));
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

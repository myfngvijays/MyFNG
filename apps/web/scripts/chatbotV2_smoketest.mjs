/**
 * Chatbot v2 smoke test
 * Usage (while `npm run dev` is running):
 *   node scripts/chatbotV2_smoketest.mjs
 */

import http from 'node:http';

function postJson(path, payload) {
  const body = Buffer.from(JSON.stringify(payload));
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port: Number(process.env.PORT || 3000),
        path,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, json: { raw: data } });
          }
        });
      }
    );
    req.on('error', (e) => resolve({ status: 0, json: { error: e.message } }));
    req.write(body);
    req.end();
  });
}

async function runCase(title, message, context = {}) {
  const payload = { message, context };
  const res = await postJson('/api/chatbot/v2', payload);
  console.log('\n==', title, '==');
  console.log('status:', res.status);
  console.log(JSON.stringify(res.json, null, 2));
  return res.json;
}

async function main() {
  // Provide location (as website would) so workshop flow can show live data
  let ctx = { locationLat: 19.1197, locationLng: 72.8468, locationLabel: 'Andheri West, Mumbai' };

  const merge = (resp) => {
    const patch = resp?.data?.contextPatch || null;
    if (patch && typeof patch === 'object') ctx = { ...ctx, ...patch };
  };

  merge(await runCase('FAQ paraphrase (EN)', 'So what exactly is MY FNG and how do you work?', ctx));
  merge(await runCase('FAQ (HI Devanagari)', 'MY FNG क्या है?', ctx));
  merge(await runCase('Workshop near me', 'Nearest workshop?', ctx));
  merge(await runCase('Pricing', 'Periodic service ka price kitna hai?', ctx));

  // Booking + payment (will ask for missing fields in steps)
  merge(await runCase('Booking start', 'Book my car service', ctx));
  merge(await runCase('Provide model', 'Hyundai i20', ctx));
  merge(await runCase('Confirm area', 'Yes', ctx));
  merge(await runCase('Provide pickup', 'Pickup', ctx));
  merge(await runCase('Provide phone', '9876543210', ctx));
  merge(await runCase('Provide vehicle number', 'MH12AB1234', ctx));
  merge(await runCase('Ask payment link', 'Payment link bhej do', ctx));
}

main().catch((e) => {
  console.error('smoke test failed:', e?.message || e);
  process.exit(1);
});



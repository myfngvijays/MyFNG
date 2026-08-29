# DPDP Act, 2023 — progress log

Branch: `compliance/dpdp` (do not push unless asked).  
Date: 26 August 2026.

This file records **what already existed**, **decisions**, **what we built**, **lawyer review**, and **open items**.

---

## Decision log

| Decision | Why |
| --- | --- |
| Keep `/privacy-policy` and add `/privacy-notice` | Policy is long existing copy. Notice is the DPDP-facing summary (what / why / retention / third parties / rights / grievance). |
| Do **not** rename `WORKSHOP_SUPERVISOR` or mix advisor-URL WIP | Advisor work is stashed on `main` as `wip-advisor-rename`. This branch is compliance-only. |
| New tables `dpdp_consent_records` + `data_rights_requests` | Old `user_consents` / `data_deletion_requests` are GDPR-shaped and tied to `users_login`. Public web visitors often have no login. |
| Cookie banner default = **reject** analytics + ads | DPDP needs free, specific, informed, unambiguous consent. Prod used to load GA4, GTM, Meta Pixel for everyone. |
| Service consent required (still **unticked**) at book / contact / register | Contractual service needs a clear tick; marketing stays optional. |
| Legal copy marked `[LEGAL REVIEW]` | Engineering draft only. Not legal advice. |
| Grievance contact reused from existing policy | Nitish Jha, cs-reply@myfng.in, Thane address — already on `/privacy-policy`. |

---

## 1) Audit — what was already there

### Personal data collection (website / app)

- **Book service** (`/book-service`): phone + WhatsApp OTP, vehicle, address, location, UTM.
- **MISA AI**, **RSA / car-loan**, **workshop locator**, **refer links**, **footer phone** prefill.
- **Customer register / login**, staff login, telecaller CRM, WhatsApp inbox, click-to-call recordings.
- **Payments**: Razorpay (cards not stored by MY FNG per policy).
- **Pickup / maps / geofence**: location; mobile has a separate background-location consent modal.
- **Admin dashboards**: full lead, call, invoice, staff PII.

### Trackers (were loading in production with **no** opt-in)

In `apps/web/src/app/(public)/layout.tsx` (before this work):

- Meta Pixel `845395791020784`
- GA4 `G-S493ENTH9Z`
- GTM `GTM-N2N59TBR`
- Short-link landings can inject extra Meta / GA pixels
- Product analytics hub also documents **Microsoft Clarity** (mobile + GTM)

### Third-party services (processors / tools)

Supabase, Vercel, Razorpay, WhatsApp/Meta, Firebase (FCM/Auth), Google Maps, SARV / Tata Smartflo, OpenAI (MISA / Call IQ), Microsoft Clarity, Google Analytics / GTM.

### Existing legal / compliance UI

- `/privacy-policy` — DPDP rights text, grievance officer, cookies (browser-settings only, not a banner).
- `/terms-and-conditions` — User Data section; **no dedicated DPDP clause** before this work.
- Mobile `LEGAL_SECTIONS` mirrors privacy/terms.
- Tables `user_consents`, `data_deletion_requests` + Super Admin compliance report (admin-only).
- Contact form **did not submit** anywhere (preventDefault only).
- No public data-rights form. Deletion pointed at `/contact-us`.
- No `BREACH_RUNBOOK.md`.

---

## 2) What we built on this branch

1. **Privacy Notice** — `/privacy-notice` (what, why, retention, third parties, rights, grievance). `[LEGAL REVIEW]`.
2. **Opt-in checkboxes** (unticked, per-purpose) on book-service, contact-us, customer register. Stored via `POST /api/public/dpdp/consent` → `dpdp_consent_records`.
3. **Cookie / tracker banner** — necessary always on; analytics + advertising off until opt-in. Gates GA/GTM/Meta in public layout.
4. **Grievance** in footer + notice + privacy policy (same officer).
5. **Data-rights form** — `/data-rights` → `POST /api/public/dpdp/rights` → `data_rights_requests` (access / correct / erase / withdraw / nominate / grievance). Withdraw also logs marketing consent = false.
6. **Terms** — new accordion **Data Protection (DPDP Act, 2023)**.
7. **`BREACH_RUNBOOK.md`** — 72h Board notice + user notice templates.
8. **SQL** — `database/353_dpdp_consent_and_rights.sql`.
9. **System Monitor** — `DPDP consent & rights` check (tables exist).
10. Contact form now records consent + stores the message as a grievance/inquiry row.

---

## 3) Lawyer review (must)

- All `[LEGAL REVIEW]` banners and the new Terms DPDP clause.
- Whether “browse-wrap” language on the old Privacy Policy (“by accessing you consent”) must be removed — it conflicts with unticked opt-in.
- Retention periods (90-day deletion vs tax/call-recording retention).
- Cross-border transfers (US/EU processors: Supabase, Meta, Google, OpenAI).
- Whether call recordings + AI transcripts need a **separate** purpose.
- Children’s data (policy says 18+; app stores may allow other ages).
- Board notice clock and “significant harm” once DPDP Rules are final.
- Grievance officer appointment letter vs website name/email.
- Processor contracts (DPA) with workshops and vendors.

---

## 4) Security gaps (flagged, not all fixed)

| Gap | Status |
| --- | --- |
| Non-essential trackers loaded without consent | **Fixed** on public layout (prod only). Short-link / Clarity-in-GTM may still fire if GTM container injects tags after analytics opt-in. |
| Contact / book / register: **no server-side CAPTCHA** | Open. OTP exists on booking; contact and rights forms have **no** bot proof. Comment in send-otp mentions Firebase Recaptcha on client, not verified here as a server check. |
| `NEXT_PUBLIC_APP_URL` often falls back to `http://localhost:3000` | Open. Production site itself is HTTPS (System Monitor SSL check). Internal links must not ship http:// in prod emails. |
| Fail-open encryption | No app-wide AES helper found. Admin UI *claims* Firebase private keys are AES-256; no `createCipher` implementation located in `apps/web/src`. Treat as **unverified encryption** — if keys are stored in DB without a key, that is fail-open. Needs a dedicated crypto review. |
| Service-role key in server | Expected for admin; leak = full PII. Rotate on suspicion (see runbook). |
| Public APIs `/api/public/dpdp/*` | Rate-limit / CAPTCHA not added. Can be spammed. |
| Footer phone field still collects a number with no checkbox | Open. |

---

## 5) Open items

- Run `353_dpdp_consent_and_rights.sql` on production Supabase.
- Wire MISA AI, car-loan, footer phone, WhatsApp first-touch, telecaller “create lead” with the same checkboxes where the **customer** is the principal (staff processing may be employment/legitimate use — counsel).
- Admin inbox for `data_rights_requests` (today: table + System Monitor counts only).
- Mobile cookie/SDK gate (Clarity / Firebase Analytics) behind the same purposes.
- Remove or qualify “by using the Platform you consent” in privacy intro after counsel says so.
- Processor inventory + DPAs.
- Do not merge this branch with the stashed Workshop Advisor rename.

---

## 6) How to test locally

1. Apply SQL 353.
2. Open `/` — cookie banner; Reject → no GA/Meta in prod; localhost has no prod scripts anyway.
3. `/privacy-notice`, `/data-rights`, footer grievance block.
4. `/book-service` — OTP disabled until service consent ticked.
5. `/contact-us` and `/customer/register` — same.
6. Super Admin → System Monitor → Compliance.

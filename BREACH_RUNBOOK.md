# Personal data breach runbook (DPDP Act, 2023)

[LEGAL REVIEW] Internal playbook. Confirm Board notice clock, templates, and “significant harm” tests with counsel before an incident.

**Clock:** Treat **72 hours from becoming aware** of a personal data breach as the target to notify the Data Protection Board of India, unless counsel says a different clock applies under the then-current DPDP Rules.

## 1. Detect and contain (hour 0)

1. Isolate affected systems (revoke keys, rotate tokens, block IPs, disable the leaking endpoint).
2. Preserve logs. Do not wipe evidence.
3. Open a war-room: engineering lead, Super Admin, Grievance Officer (Nitish Jha, cs-reply@myfng.in), counsel.
4. Record: what data, whose data, how many principals, when started, when stopped, how discovered.

## 2. Classify

| Class | Examples | Board notice | User notice |
| --- | --- | --- | --- |
| Confirmed personal data exposed | Phones, names, vehicle numbers, addresses, call recordings | Yes (target 72h) | Yes if risk of harm |
| Credential / key leak | Service-role key, Razorpay secret, WhatsApp token | Yes if used to access personal data | If accounts or payments at risk |
| Encrypted backup lost, key safe | Disk image without keys | Counsel decides | Usually no |
| Suspected, not confirmed | Anomalous query, no export proven | Document; update if confirmed | Wait unless users must reset passwords |

## 3. Board notice (72 hours) — draft

Send via the Board’s prescribed channel once live. Keep a copy in the incident ticket.

```
To: Data Protection Board of India
From: MY FNG Autocare Private Limited
Grievance / DPO: Nitish Jha <cs-reply@myfng.in>
Address: A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate,
Thane (West), Maharashtra 400604, India

1. Date/time we became aware: [IST]
2. Nature of breach: [unauthorised access / disclosure / loss / alteration]
3. Categories of personal data: [name, phone, email, vehicle, location, call audio, …]
4. Approximate number of Data Principals: [n]
5. Likely consequences: [spam calls, financial fraud, identity misuse, …]
6. Measures taken: [containment, rotation, patch]
7. Measures proposed: [further hardening, user notice]
8. Contact for Board queries: [name, phone, email]
```

## 4. User notice — draft

Use clear language. Email / in-app / SMS as appropriate. Do not ask users to click unknown links.

```
Subject: Important: information about a data incident at MY FNG

Dear [Name],

On [date] we learned of unauthorised access that may have included your
[phone / email / vehicle number / address]. We contained the issue on [date].

What you should do:
- Be cautious of unexpected calls or OTPs claiming to be MY FNG.
- If we ask you to reset a password, we will say so only inside the official app or myfng.in.

Questions: cs-reply@myfng.in or +91-9152307030 (Grievance Officer: Nitish Jha).
You may also use https://myfng.in/data-rights

MY FNG Autocare Private Limited
```

## 5. After-action

- Root cause + patch list
- Whether processors (Supabase, Meta, Razorpay, telephony) must be notified under contract
- Update this runbook and `DPDP_PROGRESS.md`
- Counsel confirms whether a follow-up Board filing is required

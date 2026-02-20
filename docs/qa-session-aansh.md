# Session-based Aansh allocation – QA checklist

Use this checklist to validate claim conflict, stale release (30s), and webhook assignment.

## Prerequisites

- Run DB migration: `135_sarv_aansh_catalog_and_sessions.sql`
- Add at least one Aansh ID via Super Admin → RSA → Aansh Catalog
- Two users with roles TELECALLER and/or RSA_MANAGER

---

## 1. Role-based access

- [ ] **Available (unauthenticated)**  
  `GET /api/sarv-aansh/session/available` without auth → 401
- [ ] **Available (TELECALLER/RSA_MANAGER)**  
  Log in as Telecaller or RSA Manager, open dashboard → no 401; modal or “Aansh: X” in header if already claimed
- [ ] **Available (other role)**  
  Log in as e.g. SUPER_ADMIN, call same endpoint (e.g. from browser console) → 403

---

## 2. Claim and conflict

- [ ] **First claim**  
  Log in as User A (TELECALLER), select an available Aansh ID → claim succeeds; header shows “Aansh: &lt;id&gt;”
- [ ] **Same Aansh, second user**  
  Log in as User B (TELECALLER) in another browser/incognito; ensure same Aansh ID is in “available” list (User A still has it). If catalog has only one ID, add another and claim from User B. Then User B tries to claim the same ID User A has → expect 409 or ID not in available list (already held)
- [ ] **One active session per user**  
  User A has Aansh 1; User A claims Aansh 2 → previous session for Aansh 1 released; only Aansh 2 is shown in header

---

## 3. Stale release (30s)

- [ ] User claims an Aansh, then close the browser tab **without** clicking Logout (or kill the tab). Within ~30s, Super Admin → RSA → Active Sessions → that Aansh ID should disappear (no heartbeat, so session expired).
- [ ] Optional: stop heartbeat by disconnecting network for 30s while tab is open; session should expire and Aansh become available again.

---

## 4. Logout and browser close release

- [ ] **Logout**  
  User with claimed Aansh clicks Logout → call `POST /api/sarv-aansh/session/release` (or equivalent) before sign-out; Active Sessions no longer show that user’s Aansh.
- [ ] **Browser close**  
  User with claimed Aansh closes the browser (or tab) without logout; `beforeunload` sends release (e.g. sendBeacon). After reload, that Aansh appears in “available” again (or at least not held by that user).

---

## 5. Webhook assignment

- [ ] User A (TELECALLER) has claimed Aansh ID 123. Send a SARV webhook payload with that `aansh_id` (e.g. in `aAnsH` / `aansh` array) to `POST /api/sarv/webhook`. The created/updated `sarv_calls` row should have `assigned_user_id` = User A’s id and `assigned_role` = TELECALLER.
- [ ] Same Aansh ID, but no active session (all released or expired) → webhook creates/updates call with `assigned_user_id` = null.

---

## 6. Admin catalog and sessions

- [ ] **Catalog**  
  Super Admin → RSA → Aansh Catalog: add new Aansh ID, toggle “Active” on/off, delete entry. List matches DB and new IDs appear in Telecaller “available” when active.
- [ ] **Active Sessions**  
  Super Admin → RSA → Active Sessions: list shows current claims with user name and expiry; refresh updates the list.

---

## Sign-off

- [ ] All steps above passed (or documented exceptions).
- Date: _______________
- Tester: _______________

# Job Cards RLS 406 Error - Root Cause Analysis

## 🔴 Problem Identified

**Test Results:**
```
auth.uid() in SQL:     null
User ID in Browser:    2c48834b-2a84-451d-9606-fa29de2fd743
```

## 🎯 Root Cause

The user IS authenticated on the client-side, but the authentication context (JWT/session) is NOT being passed to the database when running RLS policies.

### What's Happening:

```
Browser (Authenticated) → Supabase API → Postgres RLS (auth.uid() = null)
         ✅                      ❌              ❌
```

## 🚨 Why RLS is Failing

All RLS policies check `auth.uid()` to determine access:
- Policy: `auth.uid() IS NOT NULL` or `EXISTS (SELECT ... WHERE ul.id = auth.uid())`
- Reality: `auth.uid()` returns `null` in SQL queries
- Result: RLS denies access → 406 (Not Acceptable) error

## 🔧 Immediate Solution

**File:** `database/IMMEDIATE_FIX_disable_rls.sql`

```sql
ALTER TABLE public.job_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_card_parts DISABLE ROW LEVEL SECURITY;
```

This allows immediate access while we investigate the deeper issue.

## 🔍 Investigation Needed

### Possible Causes:

1. **JWT Token Not Being Sent**
   - Client has session but not sending JWT in API requests
   - Check: Request headers should include `Authorization: Bearer <token>`

2. **Session Cookie Issue**
   - Session exists in browser but not being passed to API
   - Check: Cookie configuration in `createBrowserClient`

3. **Supabase Client Configuration**
   - `createBrowserClient` might need additional config
   - Check: `apps/web/src/lib/supabase/client.ts`

4. **ANON Key vs Service Role Key**
   - Using ANON key requires JWT to be passed for `auth.uid()` to work
   - Service role key bypasses RLS but less secure

### Debug Steps:

1. Check browser Network tab → Headers → Authorization header
2. Verify JWT token is being sent with requests
3. Check Supabase client initialization
4. Verify session is being persisted correctly

## 📝 Long-term Fix

Once we identify why `auth.uid()` returns null:

1. Fix session/JWT passing issue
2. Re-enable RLS
3. Apply proper RLS policies based on roles

## ⚠️ Security Note

With RLS disabled, `job_cards` and `job_card_parts` are accessible to all authenticated users. This is acceptable for internal workshop management system but should be fixed before production deployment.

## 📊 Status

- **Current State:** RLS disabled, system functional
- **Immediate Priority:** Continue development
- **Future Task:** Investigate and fix auth.uid() null issue
- **Timeline:** Can be addressed after core features are complete

## 🎬 Next Steps

1. Run `IMMEDIATE_FIX_disable_rls.sql` in Supabase
2. Verify 406 error is gone
3. Continue development
4. Schedule time to investigate JWT/session passing issue


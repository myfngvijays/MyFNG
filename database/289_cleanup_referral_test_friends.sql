-- 289_cleanup_referral_test_friends.sql
-- Removes dummy "Test Friend" customers created by Refer & Rise simulate-invite.
-- No TEMP tables (Supabase SQL editor drops them between statements).
-- Does NOT reverse wallet credits already given to real referrers.

WITH test_friends AS (
  SELECT c.id
  FROM public.customers c
  WHERE lower(trim(coalesce(c.full_name, ''))) = 'test friend'
    AND coalesce(c.phone_verified, false) = false
    AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') LIKE '90%'
),
test_event_referees AS (
  SELECT DISTINCT re.referee_customer_id AS id
  FROM public.referral_events re
  WHERE re.anti_fraud_flags @> '["test_simulate"]'::jsonb
    AND re.referee_customer_id IS NOT NULL
),
dummy_ids AS (
  SELECT id FROM test_friends
  UNION
  SELECT id FROM test_event_referees
),
event_ids AS (
  SELECT re.id
  FROM public.referral_events re
  WHERE re.referee_customer_id IN (SELECT id FROM dummy_ids)
     OR re.anti_fraud_flags @> '["test_simulate"]'::jsonb
),
del_rewards AS (
  DELETE FROM public.referral_rewards
  WHERE referral_event_id IN (SELECT id FROM event_ids)
  RETURNING id
),
del_events AS (
  DELETE FROM public.referral_events
  WHERE id IN (SELECT id FROM event_ids)
  RETURNING id
),
del_sessions AS (
  DELETE FROM public.customer_sessions
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_prefs AS (
  DELETE FROM public.customer_notification_preferences
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_devices AS (
  DELETE FROM public.notification_devices
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_wallet_tx AS (
  DELETE FROM public.wallet_transactions
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_wallets AS (
  DELETE FROM public.wallet_accounts
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_analytics AS (
  DELETE FROM public.customer_analytics_events
  WHERE customer_id IN (SELECT id FROM dummy_ids)
  RETURNING id
),
del_customers AS (
  DELETE FROM public.customers
  WHERE id IN (SELECT id FROM dummy_ids)
  RETURNING id
)
SELECT
  (SELECT count(*) FROM del_customers) AS deleted_customers,
  (SELECT count(*) FROM del_events) AS deleted_referral_events;

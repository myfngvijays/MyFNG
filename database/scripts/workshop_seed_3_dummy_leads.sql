-- 3 fresh dummy leads for end-to-end workshop flow testing.
-- Workshop: c248e9cc-359f-4131-a4ec-4cd4837dcb54
-- Start state: ACCEPTED, pickup required, pickup boy NOT assigned (advisor assigns first).
--
-- Flow: Advisor → Pickup & Delivery → assign pickup boy → pickup OTP/photos → workshop
--       → Advisor Assign Mechanic → mechanic work → extra work approval → QC

BEGIN;

INSERT INTO service_leads (
  lead_number,
  lead_type,
  status,
  workshop_id,
  customer_name,
  customer_phone,
  customer_email,
  customer_address,
  address,
  city,
  state,
  vehicle_number,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  service_type,
  problem_description,
  pickup_required,
  pickup_status,
  pickup_address,
  pickup_otp,
  assigned_pickup_boy_id,
  assigned_mechanic_id,
  assigned_supervisor_id,
  qc_status,
  accepted_at,
  created_from,
  created_at,
  updated_at
)
VALUES
  (
    'L-DUM2609011',
    'NORMAL',
    'ACCEPTED',
    'c248e9cc-359f-4131-a4ec-4cd4837dcb54',
    'Rahul Dummy',
    '9999900101',
    'rahul.dummy@test.myfng.in',
    'Thane West, Maharashtra',
    'Thane West, Maharashtra',
    'Thane',
    'Maharashtra',
    'MH12DUM201',
    'Maruti',
    'WAGON R',
    2020,
    'General Service',
    'Dummy lead — full flow test (oil service + inspection)',
    true,
    'NOT_ASSIGNED',
    'Thane West, Maharashtra',
    '111111',
    NULL,
    NULL,
    NULL,
    'PENDING',
    now(),
    'DUMMY_SEED',
    now(),
    now()
  ),
  (
    'L-DUM2609012',
    'NORMAL',
    'ACCEPTED',
    'c248e9cc-359f-4131-a4ec-4cd4837dcb54',
    'Priya Dummy',
    '9999900102',
    'priya.dummy@test.myfng.in',
    'Andheri East, Mumbai',
    'Andheri East, Mumbai',
    'Mumbai',
    'Maharashtra',
    'GJ01DUM202',
    'Hyundai',
    'Creta',
    2021,
    'General Service',
    'Dummy lead — full flow test (AC service + brake check)',
    true,
    'NOT_ASSIGNED',
    'Andheri East, Mumbai',
    '222222',
    NULL,
    NULL,
    NULL,
    'PENDING',
    now(),
    'DUMMY_SEED',
    now(),
    now()
  ),
  (
    'L-DUM2609013',
    'NORMAL',
    'ACCEPTED',
    'c248e9cc-359f-4131-a4ec-4cd4837dcb54',
    'Arjun Dummy',
    '9999900103',
    'arjun.dummy@test.myfng.in',
    'Borivali West, Mumbai',
    'Borivali West, Mumbai',
    'Mumbai',
    'Maharashtra',
    'DL8CDUM203',
    'Honda',
    'City',
    2019,
    'General Service',
    'Dummy lead — full flow test (full service + wheel alignment)',
    true,
    'NOT_ASSIGNED',
    'Borivali West, Mumbai',
    '333333',
    NULL,
    NULL,
    NULL,
    'PENDING',
    now(),
    'DUMMY_SEED',
    now(),
    now()
  )
ON CONFLICT (lead_number) DO NOTHING;

COMMIT;

SELECT
  lead_number,
  customer_name,
  vehicle_number,
  status,
  pickup_status,
  pickup_otp,
  assigned_pickup_boy_id
FROM service_leads
WHERE lead_number IN ('L-DUM2609011', 'L-DUM2609012', 'L-DUM2609013')
ORDER BY lead_number;

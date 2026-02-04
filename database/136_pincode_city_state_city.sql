-- =====================================================
-- Migration: Add city to pincode_city_state
-- Purpose: Store city name for free-text suggestions
-- =====================================================

alter table public.pincode_city_state
  add column if not exists city text;

create index if not exists pincode_city_state_city_idx
  on public.pincode_city_state (city);

do $$
begin
  raise notice '✅ pincode_city_state.city added';
end $$;

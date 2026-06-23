-- Allow mobile app (anon key) + public API to read active membership promo cards
ALTER TABLE public.membership_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read active membership cards" ON public.membership_cards;
CREATE POLICY "Public can read active membership cards"
  ON public.membership_cards
  FOR SELECT
  USING (active = true);

COMMENT ON POLICY "Public can read active membership cards" ON public.membership_cards IS
  'Mobile app reads cards via Supabase anon key when API fallback is used';

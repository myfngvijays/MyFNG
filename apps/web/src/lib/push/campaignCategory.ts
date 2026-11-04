export type CampaignCategory = 'festival' | 'normal';

const FESTIVAL_RE =
  /diwali|deepavali|दिवाळी|दिवाली|navratri|नवरात्र|garba|durga|dasara|dussehra|दसर|होली|\bholi\b|christmas|eid|ramzan|ramadan|ganesh|गणेश|ganpati|pongal|onam|baisakhi|rakhi|raksha|janmashtami|festiv|new year|नववर्ष/i;

export function campaignCategory(input: {
  name?: string | null;
  payload?: { title?: string; message?: string; category?: string } | null;
}): CampaignCategory {
  const explicit = String(input.payload?.category || '').toLowerCase();
  if (explicit === 'festival' || explicit === 'normal') return explicit;
  const text = `${input.name || ''} ${input.payload?.title || ''} ${input.payload?.message || ''}`;
  return FESTIVAL_RE.test(text) ? 'festival' : 'normal';
}

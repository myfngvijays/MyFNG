export type UserLanguageStyle = 'english' | 'hinglish';

const HINGLISH_WORD_RE =
  /\b(yaar|bhai|kaisa|kaise|kaisi|hai|hain|ho|meri|mera|mere|gaadi|gadi|chahiye|chahie|karna|karenge|karra|kar raha|kar rahi|nahi|nahin|nhi|kya|batao|bata|thik|theek|acha|accha|abhi|kal|aaj|karo|karein|zarurat|jaankari|ke liye|ke baare|mein|mai|aur|yeh|ye|woh|wo|koi|kitna|kitne|kab|kahan|kaha|samjha|samjhe|aara|aa raha|araha|dikha|dikhe|batao|btao|chahenge|chahte)\b/i;

const DEVANAGARI_RE = /[\u0900-\u097F]/;

export function detectUserLanguageStyle(text: string): UserLanguageStyle {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 'english';

  if (DEVANAGARI_RE.test(trimmed) || HINGLISH_WORD_RE.test(trimmed)) {
    return 'hinglish';
  }

  return 'english';
}

export function buildLanguageStyleHint(style: UserLanguageStyle): string {
  if (style === 'hinglish') {
    return `[LANGUAGE: User is writing in Hinglish (Roman Hindi + English). Reply in the same natural Hinglish style — mix Hindi and English like Indian chat, e.g. "Thik hai!", "aapki gaadi", "service book karna chahenge?". Do NOT reply in pure English when the user uses Hinglish.]`;
  }

  return `[LANGUAGE: User is writing in English. Reply ONLY in English. Do not use Hindi or Hinglish words unless the user switches language.]`;
}

export function isRsaRelatedMessage(message: string): boolean {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;

  return (
    /\b(rsa|roadside|breakdown|tow|towing|towting|towed|flat\s*tyre|flat\s*tire|battery\s*dead|jump\s*start|out\s*of\s*fuel|fuel\s*delivery|key\s*lockout|immobiliz|stuck\s*on\s*road)\b/i.test(
      text,
    ) ||
    /\bcar\s+tow/i.test(text) ||
    /\bneed\s+(a\s+)?tow/i.test(text) ||
    /\bemergency\b/i.test(text)
  );
}

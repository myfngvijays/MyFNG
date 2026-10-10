const NOT_AUTOMOBILE = /\b(protest|protesters?|activist|activists|detains?|detained|police|arrested|arrests?|riot|riots|murder|killed|lynch|election|politician|parliament|cricket|ipl|bollywood|celebrity|war\b|gaza|israel|ukraine)\b/i;

const AUTOMOBILE = /\b(cars?|suvs?|sedans?|hatchbacks?|mpv|muv|vehicles?|electric vehicle|electric scooter|electric bike|e-scooter|scooters?|motorcycles?|motorbikes?|bikes?|petrol|diesel|cng|fastag|rto|automobile|automaker|showroom|dealership|facelift|mileage|maruti|hyundai|tata motors|\btata\b|mahindra|honda|toyota|kia|\bmg\b|skoda|volkswagen|bmw|mercedes|audi|ather|ola electric|\bjsw\b|\btvs\b|bajaj|hero motocorp|royal enfield|creta|nexon|xuv|punch|venue|brezza|swift|elevate|innova|harrier|safari|scorpio|thar|curvv|syros|exter|alcazar|seltos|sonet|kushaq|taigun|virtus|slavia|amaze|jimny|invicto|fortuner|glanza|baleno|fronx|hyryder|byd|vinfast|chetak|iqube|bs6|bs-vi|ev sales|auto expo)\b/i;

const STORY_STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'over', 'after', 'before',
  'across', 'india', 'indian', 'new', 'its', 'their', 'has', 'have', 'been', 'will', 'via',
  'our', 'are', 'was', 'were', 'but', 'not', 'set', 'make', 'makes', 'made', 'ahead',
  'during', 'through', 'first', 'more', 'than', 'about', 'what', 'how', 'why',
  'sales', 'car', 'cars', 'suv', 'suvs', 'priced', 'price', 'prices', 'lakh', 'buyers',
  'buyer', 'mumbai', 'pune', 'delhi', 'thane', 'navi', 'should', 'check', 'market',
  'launch', 'launched', 'unveils', 'unveil', 'growth', 'significant', 'sees', 'impact',
  'september', 'october', 'november', 'december',
]);

export function storyTokens(title: string) {
  return String(title || '')
    .toLowerCase()
    .replace(/\s+-\s+[^-]{2,50}$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2 && !STORY_STOP.has(word));
}

/** Same car event written with a different headline. */
export function isSameAutomobileStory(left: string, right: string) {
  const a = new Set(storyTokens(left));
  const b = new Set(storyTokens(right));
  if (a.size < 2 || b.size < 2) return false;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  const union = a.size + b.size - shared;
  return shared >= 3 && shared / union >= 0.3;
}

/** True only for car, bike, EV, fuel, RTO, or auto-industry headlines. */
export function isAutomobileIndustryHeadline(title: string) {
  const text = String(title || '').replace(/\s+/g, ' ').trim();
  if (text.length < 12) return false;
  if (NOT_AUTOMOBILE.test(text)) return false;
  return AUTOMOBILE.test(text);
}

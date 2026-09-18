export type SeoCheckSeverity = 'error' | 'warning' | 'info';

export type SeoCheck = {
  id: string;
  label: string;
  passed: boolean;
  severity: SeoCheckSeverity;
  weight: number;
  fix: string;
};

export type SeoScoreResult = {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passed: number;
  total: number;
  missing: SeoCheck[];
  checks: SeoCheck[];
};

export type PageSeoScoreInput = {
  title?: string;
  description?: string;
  keywords?: string;
  keyphrase?: string;
  canonical_path?: string;
  og_image?: string;
  city?: string;
  noindex?: boolean;
  active?: boolean;
  page_path?: string;
};

export type BlogSeoScoreInput = {
  slug?: string;
  title?: string;
  description?: string;
  keywords?: string;
  keyphrase?: string;
  canonical_url?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  featured_image_alt?: string;
  author_name?: string;
  local_city?: string;
  local_areas?: string;
  search_intent?: string;
  robots_index?: boolean;
  schema_blogposting?: boolean;
  schema_faq?: boolean;
  faqs?: Array<{ question?: string; answer?: string }>;
};

function gradeForScore(score: number): SeoScoreResult['grade'] {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function finalize(checks: SeoCheck[]): SeoScoreResult {
  const totalWeight = checks.reduce((sum, check) => sum + check.weight, 0) || 1;
  const earned = checks.reduce((sum, check) => {
    if (check.passed) return sum + check.weight;
    if (check.severity === 'info') return sum + check.weight * 0.7;
    if (check.severity === 'warning') return sum + check.weight * 0.25;
    return sum;
  }, 0);
  const score = Math.max(0, Math.min(100, Math.round((earned / totalWeight) * 100)));
  const missing = checks.filter((check) => !check.passed);
  return {
    score,
    grade: gradeForScore(score),
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
    missing,
    checks,
  };
}

function present(value: unknown): boolean {
  return Boolean(String(value || '').trim());
}

function charCount(value: unknown): number {
  return String(value || '').trim().length;
}

function keywordCount(value: unknown): number {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function isCityPath(path?: string): boolean {
  const value = String(path || '');
  return value.startsWith('/car-service-in-') || value.startsWith('/car-service-in/');
}

export function scoreSeoPage(input: PageSeoScoreInput): SeoScoreResult {
  const titleLen = charCount(input.title);
  const descLen = charCount(input.description);
  const checks: SeoCheck[] = [
    {
      id: 'title',
      label: 'Meta title is set',
      passed: present(input.title),
      severity: 'error',
      weight: 16,
      fix: 'Add a meta title with the main keyword near the start.',
    },
    {
      id: 'title_length',
      label: 'Meta title is 50–60 characters',
      passed: titleLen >= 50 && titleLen <= 60,
      severity: 'warning',
      weight: 8,
      fix: titleLen > 60 ? 'Shorten the meta title to 60 characters or less.' : 'Lengthen the meta title to 50–60 characters.',
    },
    {
      id: 'description',
      label: 'Meta description is set',
      passed: present(input.description),
      severity: 'error',
      weight: 16,
      fix: 'Add a meta description that says what the page offers and who it is for.',
    },
    {
      id: 'description_length',
      label: 'Meta description is 120–160 characters',
      passed: descLen >= 120 && descLen <= 160,
      severity: 'warning',
      weight: 8,
      fix: descLen > 160 ? 'Trim the meta description to 160 characters.' : 'Write 120–160 characters so Google can show a full snippet.',
    },
    {
      id: 'keywords',
      label: 'Keywords added',
      passed: keywordCount(input.keywords) >= 3,
      severity: 'warning',
      weight: 8,
      fix: 'Add at least 3 comma-separated keywords, including city or service terms.',
    },
    {
      id: 'keyphrase',
      label: 'Focus keyphrase set',
      passed: present(input.keyphrase),
      severity: 'warning',
      weight: 8,
      fix: 'Set one focus keyphrase, e.g. “car service in Thane”.',
    },
    {
      id: 'canonical',
      label: 'Canonical path set',
      passed: present(input.canonical_path),
      severity: 'error',
      weight: 10,
      fix: 'Set the live canonical path so Google does not treat this as a duplicate.',
    },
    {
      id: 'og_image',
      label: 'OG image set',
      passed: present(input.og_image),
      severity: 'warning',
      weight: 5,
      fix: 'Add an OG image URL for social and search previews.',
    },
    {
      id: 'indexable',
      label: 'Page is indexable',
      passed: input.active !== false && input.noindex !== true,
      severity: 'info',
      weight: 6,
      fix: 'Turn off Noindex and keep the page Active if this URL should rank.',
    },
  ];

  if (isCityPath(input.page_path)) {
    checks.push({
      id: 'city',
      label: 'City set for local landing page',
      passed: present(input.city),
      severity: 'warning',
      weight: 6,
      fix: 'Add the target city so local meta and schema stay correct.',
    });
  }

  return finalize(checks);
}

export function scoreSeoBlog(input: BlogSeoScoreInput): SeoScoreResult {
  const titleLen = charCount(input.title);
  const descLen = charCount(input.description);
  const faqCount = (input.faqs || []).filter(
    (faq) => present(faq.question) && present(faq.answer),
  ).length;

  const checks: SeoCheck[] = [
    {
      id: 'slug',
      label: 'URL slug is set',
      passed: present(input.slug),
      severity: 'error',
      weight: 8,
      fix: 'Set a short hyphenated slug that matches the focus keyphrase.',
    },
    {
      id: 'title',
      label: 'Meta title is set',
      passed: present(input.title),
      severity: 'error',
      weight: 12,
      fix: 'Add a meta title with the keyphrase and city if it is a local post.',
    },
    {
      id: 'title_length',
      label: 'Meta title is 50–60 characters',
      passed: titleLen >= 50 && titleLen <= 60,
      severity: 'warning',
      weight: 6,
      fix: titleLen > 60 ? 'Shorten the meta title to 60 characters.' : 'Expand the meta title to 50–60 characters.',
    },
    {
      id: 'description',
      label: 'Meta description is set',
      passed: present(input.description),
      severity: 'error',
      weight: 12,
      fix: 'Add a meta description that answers the search intent in one sentence.',
    },
    {
      id: 'description_length',
      label: 'Meta description is 120–155 characters',
      passed: descLen >= 120 && descLen <= 155,
      severity: 'warning',
      weight: 6,
      fix: descLen > 155 ? 'Trim the meta description to 155 characters.' : 'Write 120–155 characters for a full SERP snippet.',
    },
    {
      id: 'keywords',
      label: 'Keywords added',
      passed: keywordCount(input.keywords) >= 3,
      severity: 'warning',
      weight: 6,
      fix: 'Add at least 3 keywords, including the city and service terms.',
    },
    {
      id: 'keyphrase',
      label: 'Focus keyphrase set',
      passed: present(input.keyphrase),
      severity: 'warning',
      weight: 6,
      fix: 'Set the one phrase this post should rank for.',
    },
    {
      id: 'canonical',
      label: 'Canonical URL set',
      passed: present(input.canonical_url),
      severity: 'warning',
      weight: 5,
      fix: 'Set https://myfng.in/blogs/your-slug as the canonical URL.',
    },
    {
      id: 'og_title',
      label: 'OG title set',
      passed: present(input.og_title),
      severity: 'warning',
      weight: 3,
      fix: 'Add an OG title for social sharing.',
    },
    {
      id: 'og_description',
      label: 'OG description set',
      passed: present(input.og_description),
      severity: 'warning',
      weight: 3,
      fix: 'Add an OG description for WhatsApp and social previews.',
    },
    {
      id: 'og_image',
      label: 'OG / featured image set',
      passed: present(input.og_image),
      severity: 'warning',
      weight: 4,
      fix: 'Add the featured / OG image URL.',
    },
    {
      id: 'featured_alt',
      label: 'Featured image ALT set',
      passed: present(input.featured_image_alt),
      severity: 'warning',
      weight: 5,
      fix: 'Add ALT text (max 125 characters) that includes the keyphrase.',
    },
    {
      id: 'author',
      label: 'Author name set',
      passed: present(input.author_name),
      severity: 'warning',
      weight: 4,
      fix: 'Set the public author, e.g. Nikhil Yelligetti.',
    },
    {
      id: 'local_city',
      label: 'Target city set',
      passed: present(input.local_city),
      severity: 'warning',
      weight: 5,
      fix: 'Add the local city so schema and local SEO stay aligned.',
    },
    {
      id: 'faqs',
      label: 'At least 5 FAQs for FAQ schema',
      passed: faqCount >= 5,
      severity: 'warning',
      weight: 6,
      fix: `Add ${Math.max(0, 5 - faqCount)} more FAQ Q&As in the schema builder.`,
    },
    {
      id: 'schema_faq',
      label: 'FAQ schema enabled when FAQs exist',
      passed: faqCount === 0 || input.schema_faq !== false,
      severity: 'warning',
      weight: 3,
      fix: 'Turn on FAQ schema so the Q&As output FAQPage JSON-LD.',
    },
    {
      id: 'schema_blogposting',
      label: 'BlogPosting schema enabled',
      passed: input.schema_blogposting !== false,
      severity: 'warning',
      weight: 3,
      fix: 'Turn on BlogPosting schema for Google rich results.',
    },
    {
      id: 'indexable',
      label: 'Blog is indexable',
      passed: input.robots_index !== false,
      severity: 'info',
      weight: 4,
      fix: 'Allow search indexing if this post should appear in Google.',
    },
    {
      id: 'search_intent',
      label: 'Search intent set',
      passed: present(input.search_intent),
      severity: 'info',
      weight: 2,
      fix: 'Set search intent (Informational, Commercial, Transactional, or Navigational).',
    },
  ];

  return finalize(checks);
}

export function averageSeoScore(scores: number[]): number {
  if (!scores.length) return 0;
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

export function seoScoreTone(score: number): 'good' | 'mid' | 'bad' {
  if (score >= 80) return 'good';
  if (score >= 60) return 'mid';
  return 'bad';
}

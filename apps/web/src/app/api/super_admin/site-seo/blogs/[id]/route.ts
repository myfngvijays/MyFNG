import {
  blogSeoToSummary,
  normalizeBlogFaqs,
  parseBlogSeoData,
  sanitizeBlogSlug,
} from '@/lib/blog/seo';
import { normalizeBlogSeoData } from '@/lib/blog/normalizeBlogMedia';
import { revalidateBlogSeo } from '@/lib/seo/revalidate';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { createClient } from '@/lib/supabase/server';
import { requireSiteSeoAccess } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSiteSeoAccess(supabase);
    if (!auth.ok) return auth.res;

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const { data: existing, error: existingError } = await supabaseAdmin
      .from('blogs')
      .select('id, slug, title, excerpt, status, updated_at, published_at, seo_data, faqs:blog_faqs(question, answer, sort_order)')
      .eq('id', id)
      .maybeSingle();

    if (existingError || !existing) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    const current = parseBlogSeoData(existing.seo_data);
    const currentFaqs = normalizeBlogFaqs((existing as { faqs?: unknown }).faqs ?? current.faqs);
    const faqs = body.faqs === undefined ? currentFaqs : normalizeBlogFaqs(body.faqs);
    if (Array.isArray(body.faqs)) {
      const shortQuestion = faqs.find((faq) => faq.question.length < 3);
      if (shortQuestion) {
        return NextResponse.json({ error: 'Each FAQ question must be at least 3 characters' }, { status: 400 });
      }
    }
    const nextSlug = sanitizeBlogSlug(String(body.slug ?? existing.slug ?? ''));
    if (!nextSlug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    if (nextSlug !== existing.slug) {
      const { data: slugExists } = await supabaseAdmin
        .from('blogs')
        .select('id')
        .eq('slug', nextSlug)
        .neq('id', id)
        .maybeSingle();
      if (slugExists) {
        return NextResponse.json({ error: 'Blog with this slug already exists' }, { status: 400 });
      }
    }

    const oldCanonical = String(body.canonical_url ?? current.canonical_url ?? '').trim();
    const oldSlugUrl = `https://myfng.in/blogs/${existing.slug}`;
    const nextCanonical =
      !oldCanonical || oldCanonical === oldSlugUrl ? `https://myfng.in/blogs/${nextSlug}` : oldCanonical;

    const next = {
      ...current,
      meta_title: String(body.title ?? body.meta_title ?? current.meta_title ?? existing.title ?? '').trim(),
      meta_description: String(body.description ?? body.meta_description ?? current.meta_description ?? '').trim(),
      keywords: String(body.keywords ?? current.keywords ?? '').trim(),
      keyphrase: String(body.keyphrase ?? current.keyphrase ?? '').trim(),
      canonical_url: nextCanonical,
      og_title: String(body.og_title ?? current.og_title ?? '').trim(),
      og_description: String(body.og_description ?? current.og_description ?? '').trim(),
      og_image: String(body.og_image ?? current.og_image ?? '').trim(),
      featured_image_alt: String(body.featured_image_alt ?? current.featured_image_alt ?? '').trim(),
      search_intent: String(body.search_intent ?? current.search_intent ?? 'Informational').trim(),
      local_city: String(body.local_city ?? current.local_city ?? '').trim(),
      local_areas: stringList(body.local_areas ?? current.local_areas),
      author_name: String(body.author_name ?? current.author_name ?? '').trim(),
      author_role: String(body.author_role ?? current.author_role ?? '').trim(),
      robots_index: body.robots_index === undefined ? current.robots_index !== false : body.robots_index !== false,
      robots_follow: body.robots_follow === undefined ? current.robots_follow !== false : body.robots_follow !== false,
      schema_blogposting:
        body.schema_blogposting === undefined ? current.schema_blogposting !== false : body.schema_blogposting !== false,
      schema_faq: body.schema_faq === undefined ? faqs.length > 0 || current.schema_faq !== false : body.schema_faq !== false,
      eligible_ai_overview:
        body.eligible_ai_overview === undefined
          ? current.eligible_ai_overview !== false
          : body.eligible_ai_overview !== false,
      faqs,
    };

    if (!next.meta_title) {
      return NextResponse.json({ error: 'Meta title is required' }, { status: 400 });
    }
    if (!next.meta_description) {
      return NextResponse.json({ error: 'Meta description is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('blogs')
      .update({
        slug: nextSlug,
        seo_data: normalizeBlogSeoData(next as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, slug, title, excerpt, status, updated_at, published_at, seo_data')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || 'Failed to save blog SEO' }, { status: 500 });
    }

    const delFaq = await supabaseAdmin.from('blog_faqs').delete().eq('blog_id', id);
    if (delFaq.error) {
      return NextResponse.json({ error: 'Failed to update FAQs', details: delFaq.error.message }, { status: 500 });
    }
    if (faqs.length) {
      const insFaq = await supabaseAdmin.from('blog_faqs').insert(
        faqs.map((faq, idx) => ({
          blog_id: id,
          question: faq.question,
          answer: faq.answer,
          sort_order: idx,
        })),
      );
      if (insFaq.error) {
        return NextResponse.json({ error: 'Failed to update FAQs', details: insFaq.error.message }, { status: 500 });
      }
    }

    if (existing.slug !== nextSlug) {
      revalidateBlogSeo(String(existing.slug));
    }
    revalidateBlogSeo(String(data.slug));
    return NextResponse.json({ data: blogSeoToSummary({ ...data, faqs }) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

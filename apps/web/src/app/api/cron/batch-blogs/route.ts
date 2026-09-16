import { NextRequest, NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron/assertCronAuth';
import { BATCH_BLOG_TOPICS } from '@/lib/blog/batchBlogTopics';
import { RSA_BLOG_TOPICS } from '@/lib/blog/rsaBlogTopics';
import { deleteNewsCarBlogs, refreshBatchCoverAt, runBatchBlogPost, runRsaBatchBlogPost } from '@/lib/blog/runBatchBlogPost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * One-shot batch publisher. Call once per index (0-49).
 * GET /api/cron/batch-blogs?index=0
 */
async function handle(request: NextRequest) {
  const authError = await assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (request.nextUrl.searchParams.get('delete_news') === '1') {
    const result = await deleteNewsCarBlogs();
    return NextResponse.json(
      { ...result, timestamp: new Date().toISOString() },
      { status: result.success ? 200 : 500 },
    );
  }

  if (request.nextUrl.searchParams.get('refresh_covers') === '1') {
    const result = await refreshBatchCoverAt({
      offset: Number(request.nextUrl.searchParams.get('offset') || 0),
    });
    return NextResponse.json(
      { ...result, timestamp: new Date().toISOString(), total: BATCH_BLOG_TOPICS.length },
      { status: result.success ? 200 : 500 },
    );
  }

  const raw = request.nextUrl.searchParams.get('index');
  if (raw == null || raw === '') {
    return NextResponse.json({
      error: 'index, delete_news, or refresh_covers required',
      total: BATCH_BLOG_TOPICS.length,
      rsa_total: RSA_BLOG_TOPICS.length,
    }, { status: 400 });
  }

  const result = request.nextUrl.searchParams.get('rsa') === '1'
    ? await runRsaBatchBlogPost({ index: Number(raw) })
    : await runBatchBlogPost({ index: Number(raw) });
  return NextResponse.json(
    {
      ...result,
      timestamp: new Date().toISOString(),
      total: request.nextUrl.searchParams.get('rsa') === '1' ? RSA_BLOG_TOPICS.length : BATCH_BLOG_TOPICS.length,
    },
    { status: result.success ? 200 : 500 },
  );
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}

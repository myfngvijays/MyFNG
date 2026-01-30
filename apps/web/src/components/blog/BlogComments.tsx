'use client';

import { useMemo, useState } from 'react';

type CommentRow = {
  id: string;
  blog_id: string;
  user_name: string | null;
  comment: string;
  parent_comment_id: string | null;
  status: number | null;
  created_at: string;
};

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function BlogComments({
  blogId,
  initialComments,
}: {
  blogId: string;
  initialComments: CommentRow[];
}) {
  const [comments, setComments] = useState<CommentRow[]>(initialComments || []);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [text, setText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);

  const byParent = useMemo(() => {
    const map = new Map<string | null, CommentRow[]>();
    for (const c of comments) {
      const k = c.parent_comment_id || null;
      map.set(k, [...(map.get(k) || []), c]);
    }
    return map;
  }, [comments]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/blogs/comments?blog_id=${encodeURIComponent(blogId)}`, { cache: 'no-store' as any });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load comments');
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setPosting(true);
    setError(null);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blog_id: blogId,
          user_name: name,
          user_email: email,
          comment: text,
          parent_comment_id: replyToId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to post comment');

      setText('');
      setReplyToId(null);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  }

  const roots = byParent.get(null) || [];

  return (
    <section className="mt-10 sm:mt-12 md:mt-14">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">Comments</h2>
        <button
          type="button"
          onClick={refresh}
          className="text-xs sm:text-sm font-semibold text-brand-primary hover:underline"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error ? <div className="mb-4 text-sm text-red-600">{error}</div> : null}

      <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>

        {replyToId ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="text-gray-600">Replying to a comment</div>
            <button
              type="button"
              onClick={() => setReplyToId(null)}
              className="text-brand-primary font-semibold hover:underline"
            >
              Cancel reply
            </button>
          </div>
        ) : null}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment…"
          rows={4}
          className="w-full mt-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />

        <div className="mt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={posting || text.trim().length === 0}
            className="btn btn-primary text-sm px-4 py-2 disabled:opacity-60"
          >
            {posting ? 'Posting…' : 'Post Comment'}
          </button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {roots.length === 0 ? (
          <div className="text-sm text-gray-600">No comments yet.</div>
        ) : (
          roots.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{c.user_name || 'Anonymous'}</div>
                  <div className="text-xs text-gray-500">{fmt(c.created_at)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyToId(c.id)}
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  Reply
                </button>
              </div>
              <div className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{c.comment}</div>

              {(byParent.get(c.id) || []).length ? (
                <div className="mt-4 pl-4 border-l border-gray-200 space-y-3">
                  {(byParent.get(c.id) || []).map((r) => (
                    <div key={r.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="font-semibold text-gray-900 text-sm">{r.user_name || 'Anonymous'}</div>
                      <div className="text-xs text-gray-500">{fmt(r.created_at)}</div>
                      <div className="mt-1 text-sm text-gray-800 whitespace-pre-wrap">{r.comment}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}


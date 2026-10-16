'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import DashboardLayout from '@/components/DashboardLayout';
import { Check, MessageCircle, Search, Trash2, EyeOff, Eye, Reply, Pencil } from 'lucide-react';
import CommentBody from '@/components/blog/CommentBody';

type CommentRow = {
  id: string;
  blog_id: string;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  parent_comment_id: string | null;
  status: number | null;
  created_at: string;
  blog?: { id?: string; title?: string; slug?: string } | { id?: string; title?: string; slug?: string }[] | null;
};

type Filter = 'pending' | 'approved' | 'all';

function blogOf(row: CommentRow) {
  const blog = Array.isArray(row.blog) ? row.blog[0] : row.blog;
  return {
    title: blog?.title || 'Untitled blog',
    slug: blog?.slug || '',
  };
}

function fmt(dt: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(dt));
  } catch {
    return '';
  }
}

export default function DigitalMarketingBlogCommentsPage() {
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0 });
  const [filter, setFilter] = useState<Filter>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async (nextFilter: Filter) => {
    setLoading(true);
    try {
      const status = nextFilter === 'pending' ? '0' : nextFilter === 'approved' ? '1' : '';
      const qs = status ? `&status=${status}` : '';
      const res = await fetch(`/api/blogs/comments?manage=1${qs}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load comments');
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      setSelected([]);
      setCounts({
        total: Number(data?.counts?.total || 0),
        pending: Number(data?.counts?.pending || 0),
        approved: Number(data?.counts?.approved || 0),
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('status');
    const initial: Filter = status === 'approved' || status === 'all' ? status : 'pending';
    setFilter(initial);
    void load(initial);
  }, [load]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter((c) => {
      const blog = blogOf(c);
      const hay = `${c.user_name || ''} ${c.user_email || ''} ${c.comment || ''} ${blog.title} ${blog.slug}`.toLowerCase();
      return hay.includes(q);
    });
  }, [comments, searchTerm]);

  const { roots, repliesByParent } = useMemo(() => {
    const ids = new Set(filtered.map((row) => row.id));
    const grouped = new Map<string, CommentRow[]>();
    for (const row of filtered) {
      const parentId = row.parent_comment_id;
      if (parentId && ids.has(parentId)) {
        const list = grouped.get(parentId) || [];
        list.push(row);
        grouped.set(parentId, list);
      }
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    const top = filtered.filter((row) => !(row.parent_comment_id && ids.has(row.parent_comment_id)));
    return { roots: top, repliesByParent: grouped };
  }, [filtered]);

  const selectedRows = filtered.filter((row) => selected.includes(row.id));
  const allVisibleSelected = filtered.length > 0 && selectedRows.length === filtered.length;

  function toggleOne(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllVisible() {
    const visibleIds = filtered.map((row) => row.id);
    setSelected((prev) => {
      if (visibleIds.every((id) => prev.includes(id))) {
        return prev.filter((id) => !visibleIds.includes(id));
      }
      return [...new Set([...prev, ...visibleIds])];
    });
  }

  async function bulkUpdate(status: 0 | 1) {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_ids: ids, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update comments');
      toast.success(status === 1 ? `${ids.length} comments approved` : `${ids.length} comments hidden`);
      setSelected([]);
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update comments');
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkDelete() {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} comment${ids.length === 1 ? '' : 's'}? Replies on those comments are removed too.`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_ids: ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete comments');
      toast.success(`${ids.length} comments deleted`);
      setSelected([]);
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete comments');
    } finally {
      setBulkBusy(false);
    }
  }

  async function setStatus(row: CommentRow, status: 0 | 1) {
    setBusyId(row.id);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: row.id, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update comment');
      toast.success(status === 1 ? 'Comment approved' : 'Comment hidden');
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update comment');
    } finally {
      setBusyId(null);
    }
  }

  async function saveEdit(row: CommentRow) {
    const text = editText.replace(/^\s+|\s+$/g, '');
    if (!text) return;
    setBusyId(row.id);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: row.id, comment: editText }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save comment');
      toast.success('Comment updated');
      setEditId(null);
      setEditText('');
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save comment');
    } finally {
      setBusyId(null);
    }
  }

  function startEdit(row: CommentRow) {
    setReplyTo(null);
    setReplyText('');
    setEditId(row.id);
    setEditText(row.comment || '');
  }

  async function sendReply(row: CommentRow) {
    const text = replyText.trim();
    if (!text) return;
    setBusyId(row.id);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          as_admin: true,
          blog_id: row.blog_id,
          parent_comment_id: row.id,
          comment: text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to post reply');
      toast.success(Number(row.status) === 1 ? 'Reply posted on the blog' : 'Reply posted and comment approved');
      setReplyTo(null);
      setReplyText('');
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to post reply');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row: CommentRow) {
    const blog = blogOf(row);
    if (!confirm(`Delete this comment on “${blog.title}”?`)) return;
    setBusyId(row.id);
    try {
      const res = await fetch('/api/blogs/comments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: row.id, blog_id: row.blog_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete comment');
      toast.success('Comment deleted');
      await load(filter);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete comment');
    } finally {
      setBusyId(null);
    }
  }

  const tabs: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'all', label: 'All', count: counts.total },
  ];

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#023D95]">Blog Comments</h1>
          <p className="text-sm text-slate-500 mt-1">
            New comments stay hidden until you approve them. Approve or delete comments from every blog here.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id);
                void load(tab.id);
              }}
              className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${
                filter === tab.id
                  ? 'bg-[#023D95] text-white border-[#023D95]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-[#023D95]/40'
              }`}
            >
              {tab.label}
              <span className={`ml-2 text-xs ${filter === tab.id ? 'text-white/80' : 'text-slate-400'}`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by blog, name, email, or comment…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
            />
          </div>
          <button type="button" className="btn btn-outline w-full sm:w-auto" onClick={() => void load(filter)} disabled={loading || bulkBusy}>
            Refresh
          </button>
        </div>

        {!loading && filtered.length > 0 ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                className="h-4 w-4 rounded border-slate-300 text-[#023D95] focus:ring-[#004AAD]"
              />
              {allVisibleSelected ? 'Clear selection' : `Select all (${filtered.length})`}
            </label>
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs font-semibold text-slate-500">{selectedRows.length} selected</span>
              <button
                type="button"
                disabled={bulkBusy || selectedRows.length === 0}
                onClick={() => void bulkUpdate(1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Approve
              </button>
              <button
                type="button"
                disabled={bulkBusy || selectedRows.length === 0}
                onClick={() => void bulkUpdate(0)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                <EyeOff className="w-4 h-4" />
                Hide
              </button>
              <button
                type="button"
                disabled={bulkBusy || selectedRows.length === 0}
                onClick={() => void bulkDelete()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-16 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-[#004AAD]" />
            <p className="mt-3 text-sm text-slate-500">Loading comments…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-white py-14 text-center">
            <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-[#023D95]">No comments</h3>
            <p className="text-sm text-slate-500">
              {filter === 'pending' ? 'Nothing is waiting for approval.' : 'No comments match this view.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {roots.map((row) => {
              const blog = blogOf(row);
              const approved = Number(row.status) === 1;
              const busy = busyId === row.id;
              const checked = selected.includes(row.id);
              const replies = repliesByParent.get(row.id) || [];
              return (
                <article key={row.id} className={`rounded-2xl border bg-white p-4 shadow-sm ${checked ? 'border-[#023D95]' : 'border-slate-200'}`}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(row.id)}
                        aria-label="Select comment"
                        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-[#023D95] focus:ring-[#004AAD]"
                      />
                      <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            approved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {approved ? 'Approved' : 'Pending'}
                        </span>
                        {row.parent_comment_id ? (
                          <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                            Reply
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#023D95]">
                        {blog.slug ? (
                          <Link href={`/blogs/${blog.slug}`} target="_blank" className="hover:underline">
                            {blog.title}
                          </Link>
                        ) : (
                          blog.title
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {row.user_name || 'Anonymous'}
                        {row.user_email ? ` · ${row.user_email}` : ''} · {fmt(row.created_at)}
                      </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                      {approved ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(row, 0)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          <EyeOff className="w-4 h-4" />
                          Hide
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void setStatus(row, 1)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Check className="w-4 h-4" />
                          Approve
                        </button>
                      )}
                      {blog.slug ? (
                        <Link
                          href={`/blogs/${blog.slug}#blog-comments`}
                          target="_blank"
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => startEdit(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Pencil className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditId(null);
                          setEditText('');
                          setReplyTo(replyTo === row.id ? null : row.id);
                          setReplyText('');
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#023D95]/20 text-sm font-semibold text-[#023D95] hover:bg-blue-50 disabled:opacity-60"
                      >
                        <Reply className="w-4 h-4" />
                        Reply
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove(row)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                  {editId === row.id ? (
                    <div className="mt-3 ml-7">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button type="button" className="px-3 py-2 text-sm font-semibold text-slate-600" onClick={() => { setEditId(null); setEditText(''); }}>
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy || editText.trim().length === 0}
                          onClick={() => void saveEdit(row)}
                          className="px-3 py-2 rounded-lg bg-[#023D95] text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {busy ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CommentBody text={row.comment} compact className="mt-3 ml-7 text-sm text-slate-800" />
                  )}
                  {replyTo === row.id ? (
                    <div className="mt-3 ml-7 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={3}
                        placeholder="Write a reply. It will show on the blog right away."
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-3 py-2 text-sm font-semibold text-slate-600"
                          onClick={() => {
                            setReplyTo(null);
                            setReplyText('');
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={busy || replyText.trim().length === 0}
                          onClick={() => void sendReply(row)}
                          className="px-3 py-2 rounded-lg bg-[#023D95] text-white text-sm font-semibold disabled:opacity-60"
                        >
                          {busy ? 'Posting…' : 'Post reply'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {replies.length ? (
                    <div className="mt-4 ml-7 space-y-3 border-l-2 border-[#023D95]/20 pl-3">
                      {replies.map((reply) => {
                        const replyApproved = Number(reply.status) === 1;
                        const replyBusy = busyId === reply.id;
                        return (
                          <div key={reply.id} className="rounded-xl bg-slate-50 p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#023D95]/10 text-[#023D95]">
                                    Reply
                                  </span>
                                  <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${replyApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                    {replyApproved ? 'Approved' : 'Pending'}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                  {reply.user_name || 'Anonymous'}
                                  {reply.user_email ? ` · ${reply.user_email}` : ''} · {fmt(reply.created_at)}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={replyBusy} onClick={() => startEdit(reply)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-60">
                                  <Pencil className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                                <button type="button" disabled={replyBusy} onClick={() => void setStatus(reply, replyApproved ? 0 : 1)} className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-60">
                                  {replyApproved ? 'Hide' : 'Approve'}
                                </button>
                                <button type="button" disabled={replyBusy} onClick={() => void remove(reply)} className="px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-600 disabled:opacity-60">
                                  Delete
                                </button>
                              </div>
                            </div>
                            {editId === reply.id ? (
                              <div className="mt-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={6}
                                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <button type="button" className="px-3 py-2 text-sm font-semibold text-slate-600" onClick={() => { setEditId(null); setEditText(''); }}>
                                    Cancel
                                  </button>
                                  <button type="button" disabled={replyBusy || editText.trim().length === 0} onClick={() => void saveEdit(reply)} className="px-3 py-2 rounded-lg bg-[#023D95] text-white text-sm font-semibold disabled:opacity-60">
                                    {replyBusy ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <CommentBody text={reply.comment} compact className="mt-2 text-sm text-slate-800" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

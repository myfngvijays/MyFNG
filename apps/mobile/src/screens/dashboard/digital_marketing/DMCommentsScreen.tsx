import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DashboardHeader from '../../../components/DashboardHeader';
import BottomNav from '../../../components/BottomNav';
import { apiFetch } from '../../../lib/api';
import { ENV } from '../../../config/environment';
import { COLORS, SPACING } from '../../../constants/theme';

type CommentRow = {
  id: string;
  blog_id: string;
  user_name: string | null;
  user_email: string | null;
  comment: string;
  parent_comment_id: string | null;
  status: number | null;
  created_at: string;
  blog?: { title?: string; slug?: string } | { title?: string; slug?: string }[] | null;
};

type Filter = 'pending' | 'approved' | 'all';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: 'home' },
  { id: 'DMContent', label: 'Blogs', icon: 'document' },
  { id: 'DMComments', label: 'Comments', icon: 'comment' },
  { id: 'DMCategories', label: 'Categories', icon: 'tag' },
  { id: 'DMProfile', label: 'Profile', icon: 'account' },
];

function blogOf(row: CommentRow) {
  const blog = Array.isArray(row.blog) ? row.blog[0] : row.blog;
  return { title: blog?.title || 'Untitled blog', slug: blog?.slug || '' };
}

function fmt(dt: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(dt));
  } catch {
    return '';
  }
}

function CommentBodyText({ text, style }: { text: string; style?: object }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 180 || text.split('\n').length > 3;
  const parts: React.ReactNode[] = [];
  const re = /https?:\/\/[^\s<]+/g;
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const trailing = match[0].match(/^(.*?)([),.!?:;]+)$/);
    const href = trailing ? trailing[1] : match[0];
    const rest = trailing ? trailing[2] : '';
    parts.push(
      <Text
        key={`link-${index}`}
        style={styles.link}
        onPress={() => void Linking.openURL(href)}
      >
        {href}
      </Text>,
    );
    if (rest) parts.push(rest);
    last = start + match[0].length;
    index += 1;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <View>
      <Text style={style} numberOfLines={long && !open ? 3 : undefined}>
        {parts}
      </Text>
      {long ? (
        <TouchableOpacity onPress={() => setOpen((value) => !value)}>
          <Text style={styles.more}>{open ? 'Show less' : 'Show more'}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function DMCommentsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('pending');
  const [search, setSearch] = useState('');
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [counts, setCounts] = useState({ total: 0, pending: 0, approved: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async (nextFilter: Filter) => {
    try {
      const status = nextFilter === 'pending' ? '0' : nextFilter === 'approved' ? '1' : '';
      const qs = status ? `&status=${status}` : '';
      const data = await apiFetch<any>(`/api/blogs/comments?manage=1${qs}`);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
      setSelected([]);
      setCounts({
        total: Number(data?.counts?.total || 0),
        pending: Number(data?.counts?.pending || 0),
        approved: Number(data?.counts?.approved || 0),
      });
    } catch (e: any) {
      Alert.alert('Comments', e?.message || 'Failed to load comments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('pending');
  }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? comments.filter((c) => {
        const blog = blogOf(c);
        return `${c.user_name || ''} ${c.user_email || ''} ${c.comment || ''} ${blog.title}`.toLowerCase().includes(q);
      })
    : comments;

  const ids = new Set(filtered.map((row) => row.id));
  const repliesByParent = new Map<string, CommentRow[]>();
  for (const row of filtered) {
    if (row.parent_comment_id && ids.has(row.parent_comment_id)) {
      const list = repliesByParent.get(row.parent_comment_id) || [];
      list.push(row);
      repliesByParent.set(row.parent_comment_id, list);
    }
  }
  for (const list of repliesByParent.values()) {
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }
  const roots = filtered.filter((row) => !(row.parent_comment_id && ids.has(row.parent_comment_id)));

  const selectedRows = filtered.filter((row) => selected.includes(row.id));
  const allVisibleSelected = filtered.length > 0 && selectedRows.length === filtered.length;

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    const visibleIds = filtered.map((row) => row.id);
    setSelected((prev) => {
      if (visibleIds.every((id) => prev.includes(id))) return prev.filter((id) => !visibleIds.includes(id));
      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const bulkUpdate = async (status: 0 | 1) => {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      await apiFetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_ids: ids, status }),
      });
      setSelected([]);
      await load(filter);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update comments');
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkDelete = () => {
    const ids = selectedRows.map((row) => row.id);
    if (!ids.length) return;
    Alert.alert('Delete comments?', `${ids.length} comment${ids.length === 1 ? '' : 's'} will be removed, including their replies.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBulkBusy(true);
          try {
            await apiFetch('/api/blogs/comments', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ comment_ids: ids }),
            });
            setSelected([]);
            await load(filter);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete comments');
          } finally {
            setBulkBusy(false);
          }
        },
      },
    ]);
  };

  const saveEdit = async (row: CommentRow) => {
    if (!editText.trim()) return;
    setBusyId(row.id);
    try {
      await apiFetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: row.id, comment: editText }),
      });
      setEditId(null);
      setEditText('');
      await load(filter);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not update comment');
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (row: CommentRow, status: 0 | 1) => {
    setBusyId(row.id);
    try {
      await apiFetch('/api/blogs/comments', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment_id: row.id, status }),
      });
      await load(filter);
    } catch (e: any) {
      Alert.alert('Update failed', e?.message || 'Could not update comment');
    } finally {
      setBusyId(null);
    }
  };

  const sendReply = async (row: CommentRow) => {
    const text = replyText.trim();
    if (!text) return;
    setBusyId(row.id);
    try {
      await apiFetch('/api/blogs/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          as_admin: true,
          blog_id: row.blog_id,
          parent_comment_id: row.id,
          comment: text,
        }),
      });
      setReplyTo(null);
      setReplyText('');
      Alert.alert('Reply posted', Number(row.status) === 1 ? 'It is live on the blog.' : 'The comment is approved and your reply is live.');
      await load(filter);
    } catch (e: any) {
      Alert.alert('Reply failed', e?.message || 'Could not post reply');
    } finally {
      setBusyId(null);
    }
  };

  const remove = (row: CommentRow) => {
    Alert.alert('Delete comment?', blogOf(row).title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(row.id);
          try {
            await apiFetch('/api/blogs/comments', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ comment_id: row.id, blog_id: row.blog_id }),
            });
            await load(filter);
          } catch (e: any) {
            Alert.alert('Delete failed', e?.message || 'Could not delete comment');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const chips: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'approved', label: 'Approved', count: counts.approved },
    { id: 'all', label: 'All', count: counts.total },
  ];

  return (
    <View style={styles.container}>
      <DashboardHeader title="Blog Comments" onBack={() => navigation.goBack()} />
      <View style={styles.filters}>
        {chips.map((chip) => (
          <TouchableOpacity
            key={chip.id}
            style={[styles.chip, filter === chip.id && styles.chipOn]}
            onPress={() => {
              setFilter(chip.id);
              setLoading(true);
              void load(chip.id);
            }}
          >
            <Text style={[styles.chipText, filter === chip.id && styles.chipTextOn]}>
              {chip.label} {chip.count}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.searchWrap}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search blog, name, or comment…"
          placeholderTextColor={COLORS.textSecondary}
          style={styles.search}
        />
      </View>
      {!loading && filtered.length > 0 ? (
        <View style={styles.bulkBar}>
          <TouchableOpacity onPress={toggleAllVisible}>
            <Text style={styles.bulkSelect}>{allVisibleSelected ? 'Clear' : `Select all (${filtered.length})`}</Text>
          </TouchableOpacity>
          <Text style={styles.bulkCount}>{selectedRows.length} selected</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity style={styles.approveBtn} disabled={bulkBusy || !selectedRows.length} onPress={() => void bulkUpdate(1)}>
              <Text style={styles.approveText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hideBtn} disabled={bulkBusy || !selectedRows.length} onPress={() => void bulkUpdate(0)}>
              <Text style={styles.hideText}>Hide</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteBtn} disabled={bulkBusy || !selectedRows.length} onPress={bulkDelete}>
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(filter);
              }}
            />
          }
        >
          {            filtered.length === 0 ? (
            <Text style={styles.empty}>
              {filter === 'pending' ? 'Nothing is waiting for approval.' : 'No comments in this view.'}
            </Text>
          ) : (
            roots.map((row) => {
              const blog = blogOf(row);
              const approved = Number(row.status) === 1;
              const busy = busyId === row.id || bulkBusy;
              const checked = selected.includes(row.id);
              const replies = repliesByParent.get(row.id) || [];
              return (
                <View key={row.id} style={[styles.card, checked && styles.cardOn]}>
                  <View style={styles.cardHead}>
                    <TouchableOpacity
                      style={[styles.check, checked && styles.checkOn]}
                      onPress={() => toggleOne(row.id)}
                      accessibilityLabel="Select comment"
                    >
                      {checked ? <Text style={styles.checkMark}>✓</Text> : null}
                    </TouchableOpacity>
                    <Text style={[styles.badge, approved ? styles.badgeOk : styles.badgeWait]}>
                      {approved ? 'Approved' : 'Pending'}
                      {row.parent_comment_id ? ' · Reply' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={!blog.slug}
                    onPress={() => {
                      if (blog.slug) void Linking.openURL(`${ENV.API_URL}/blogs/${blog.slug}`);
                    }}
                  >
                    <Text style={styles.blogTitle}>{blog.title}</Text>
                  </TouchableOpacity>
                  <Text style={styles.meta}>
                    {row.user_name || 'Anonymous'}
                    {row.user_email ? ` · ${row.user_email}` : ''} · {fmt(row.created_at)}
                  </Text>
                  {editId === row.id ? (
                    <View style={styles.replyBox}>
                      <TextInput value={editText} onChangeText={setEditText} multiline style={styles.replyInput} />
                      <TouchableOpacity style={styles.approveBtn} disabled={busy || !editText.trim()} onPress={() => void saveEdit(row)}>
                        <Text style={styles.approveText}>{busy ? '…' : 'Save'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <CommentBodyText text={row.comment} style={styles.body} />
                  )}
                  <View style={styles.actions}>
                    {approved ? (
                      <TouchableOpacity style={styles.hideBtn} disabled={busy} onPress={() => void setStatus(row, 0)}>
                        <Text style={styles.hideText}>Hide</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity style={styles.approveBtn} disabled={busy} onPress={() => void setStatus(row, 1)}>
                        <Text style={styles.approveText}>{busy ? '…' : 'Approve'}</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.replyBtn}
                      disabled={!blog.slug}
                      onPress={() => {
                        if (blog.slug) void Linking.openURL(`${ENV.API_URL}/blogs/${blog.slug}#blog-comments`);
                      }}
                    >
                      <Text style={styles.replyTextBtn}>View</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replyBtn}
                      disabled={busy}
                      onPress={() => {
                        setReplyTo(null);
                        setReplyText('');
                        setEditId(row.id);
                        setEditText(row.comment || '');
                      }}
                    >
                      <Text style={styles.replyTextBtn}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.replyBtn}
                      disabled={busy}
                      onPress={() => {
                        setEditId(null);
                        setEditText('');
                        setReplyTo(replyTo === row.id ? null : row.id);
                        setReplyText('');
                      }}
                    >
                      <Text style={styles.replyTextBtn}>Reply</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} disabled={busy} onPress={() => remove(row)}>
                      <Text style={styles.deleteText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                  {replyTo === row.id ? (
                    <View style={styles.replyBox}>
                      <TextInput
                        value={replyText}
                        onChangeText={setReplyText}
                        placeholder="Write a reply…"
                        placeholderTextColor={COLORS.textSecondary}
                        multiline
                        style={styles.replyInput}
                      />
                      <TouchableOpacity
                        style={[styles.approveBtn, !replyText.trim() && styles.disabled]}
                        disabled={busy || !replyText.trim()}
                        onPress={() => void sendReply(row)}
                      >
                        <Text style={styles.approveText}>{busy ? '…' : 'Post reply'}</Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}
                  {replies.map((reply) => {
                    const replyBusy = busyId === reply.id || bulkBusy;
                    return (
                      <View key={reply.id} style={styles.nested}>
                        <Text style={styles.badgeOk}>Reply · {reply.user_name || 'Anonymous'}</Text>
                        {editId === reply.id ? (
                          <View style={styles.replyBox}>
                            <TextInput value={editText} onChangeText={setEditText} multiline style={styles.replyInput} />
                            <TouchableOpacity style={styles.approveBtn} disabled={replyBusy || !editText.trim()} onPress={() => void saveEdit(reply)}>
                              <Text style={styles.approveText}>{replyBusy ? '…' : 'Save'}</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <CommentBodyText text={reply.comment} style={styles.body} />
                        )}
                        <View style={styles.actions}>
                          <TouchableOpacity style={styles.replyBtn} disabled={replyBusy} onPress={() => { setEditId(reply.id); setEditText(reply.comment || ''); }}>
                            <Text style={styles.replyTextBtn}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.deleteBtn} disabled={replyBusy} onPress={() => remove(reply)}>
                            <Text style={styles.deleteText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
      <BottomNav
        activeTab="DMComments"
        onTabChange={(screen) => {
          if (screen === 'DMComments') return;
          navigation.navigate(screen as never);
        }}
        tabs={TABS}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    backgroundColor: COLORS.white,
  },
  chipOn: { backgroundColor: '#023D95', borderColor: '#023D95' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  chipTextOn: { color: '#fff' },
  searchWrap: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  search: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: SPACING.md, gap: 10, paddingBottom: 24 },
  empty: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 40 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  cardOn: { borderColor: '#023D95' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: '#023D95', borderColor: '#023D95' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  bulkBar: { paddingHorizontal: SPACING.md, paddingTop: 8, gap: 8 },
  bulkSelect: { color: '#023D95', fontWeight: '700', fontSize: 13 },
  bulkCount: { color: COLORS.textSecondary, fontSize: 12 },
  bulkActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  badgeWait: { backgroundColor: '#FEF3C7', color: '#B45309' },
  badgeOk: { backgroundColor: '#D1FAE5', color: '#047857' },
  blogTitle: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#023D95' },
  meta: { marginTop: 2, fontSize: 12, color: COLORS.textSecondary },
  body: { marginTop: 8, fontSize: 14, color: '#1E293B' },
  link: { color: '#023D95', textDecorationLine: 'underline' },
  more: { marginTop: 4, color: '#023D95', fontSize: 12, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approveBtn: { backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hideBtn: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  hideText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  replyBtn: { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  replyTextBtn: { color: '#023D95', fontWeight: '700', fontSize: 13 },
  deleteBtn: { borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  deleteText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  replyBox: { marginTop: 10, gap: 8 },
  nested: { marginTop: 10, marginLeft: 12, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: '#BFDBFE' },
  replyInput: {
    minHeight: 72,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  disabled: { opacity: 0.5 },
});

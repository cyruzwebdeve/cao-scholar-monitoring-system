import Notification from './components/Notification';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  ExternalLink,
  FilePenLine,
  ImagePlus,
  Megaphone,
  Plus,
  Search,
  Send,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import { toManilaDateTimeInput, fromManilaDateTimeInput, announcementDisplayStatus } from './utils/announcementTime';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';

const audienceLabels = {
  all: 'Everyone',
  applicants: 'Applicants',
  scholars: 'Scholars',
  applicants_scholars: 'Applicants & Scholars',
  admins: 'Administrators',
};

const emptyForm = () => ({
  title: '',
  content: '',
  audience: 'all',
  priority: 'normal',
  status: 'draft',
  publishAt: '',
  expiresAt: '',
  imageName: '',
  imageType: '',
  imageData: '',
  externalUrl: '',
});

const formatAnnouncementDate = (value, fallback = 'Not set') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' PHT';
};

export default function AnnouncementsManagement({ token }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [audienceFilter, setAudienceFilter] = useState('any');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingRevision, setEditingRevision] = useState(null);
  const [editingDates, setEditingDates] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(null);

  const loadAnnouncements = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/announcements/management`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load announcements.');
      setAnnouncements(body.announcements || []);
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof TypeError ? 'Unable to reach the announcement service.' : error.message || 'Unable to load announcements.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadAnnouncements({ showLoader: true }), 0);
    const stopRefreshing = subscribeToVisibleRefresh(loadAnnouncements, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { window.clearTimeout(initialLoad); stopRefreshing(); };
  }, [loadAnnouncements]);

  useEffect(() => {
    if (!editorOpen) return undefined;
    const close = (event) => { if (event.key === 'Escape' && !saving) setEditorOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [editorOpen, saving]);

  const metrics = useMemo(() => ({
    total: announcements.length,
    published: announcements.filter(({ status }) => status === 'published').length,
    scheduled: announcements.filter(({ status }) => status === 'scheduled').length,
    drafts: announcements.filter(({ status }) => status === 'draft').length,
  }), [announcements]);

  const filtered = useMemo(() => announcements.filter((announcement) => {
    const search = `${announcement.title} ${announcement.content} ${announcement.externalUrl || ''}`.toLowerCase();
    return search.includes(query.trim().toLowerCase())
      && (statusFilter === 'all' || announcementDisplayStatus(announcement) === statusFilter)
      && (audienceFilter === 'any' || announcement.audience === audienceFilter)
      && (priorityFilter === 'all' || announcement.priority === priorityFilter);
  }), [announcements, query, statusFilter, audienceFilter, priorityFilter]);

  const openCreate = () => {
    setEditingId(null);
    setEditingRevision(null);
    setEditingDates(null);
    setForm(emptyForm());
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (announcement) => {
    setEditingId(announcement.id);
    setEditingRevision(announcement.updatedAt);
    setEditingDates({ publishAt: announcement.publishAt || null, expiresAt: announcement.expiresAt || null });
    setForm({
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      priority: announcement.priority,
      status: announcement.status,
      publishAt: toManilaDateTimeInput(announcement.publishAt),
      expiresAt: toManilaDateTimeInput(announcement.expiresAt),
      imageName: announcement.imageName || '',
      imageType: announcement.imageType || '',
      imageData: announcement.imageData || '',
      externalUrl: announcement.externalUrl || '',
    });
    setFormError('');
    setEditorOpen(true);
  };

  const saveAnnouncement = async (event) => {
    event.preventDefault();
    if (saving) return;
    const action = event.nativeEvent?.submitter?.value || 'save';
    const nextStatus = action === 'post-now' ? 'published' : action === 'draft' ? 'draft' : action === 'schedule' ? 'scheduled' : form.status;
    if (nextStatus === 'scheduled' && !form.publishAt) {
      setFormError('Choose when this scheduled announcement should be published.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const response = await fetch(`${API_BASE}/announcements${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PUT' : 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          status: nextStatus,
          ...(action === 'post-now' ? { action } : {}),
          ...(editingId ? { updatedAt: editingRevision } : {}),
          publishAt: action === 'post-now' ? null : editingId && form.publishAt === toManilaDateTimeInput(editingDates?.publishAt) ? editingDates.publishAt : fromManilaDateTimeInput(form.publishAt),
          expiresAt: editingId && form.expiresAt === toManilaDateTimeInput(editingDates?.expiresAt) ? editingDates.expiresAt : fromManilaDateTimeInput(form.expiresAt),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save the announcement.');
      if (!body.announcement?.id || !body.announcement.updatedAt) throw new Error('We could not confirm the saved announcement. Keep this editor open and reload the directory before trying again.');
      setEditorOpen(false);
      setNotice({ tone: 'success', text: `${body.message}${form.audience !== 'admins' && ['published', 'scheduled'].includes(body.announcement.status) ? ' Email notifications are automatic after publication. Existing recipient deliveries are not repeated.' : ''}` });
      await loadAnnouncements();
    } catch (error) {
      setFormError(error.message || 'Unable to save the announcement.');
    } finally {
      setSaving(false);
    }
  };

  const reloadEditor = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_BASE}/announcements/management`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to reload announcements.');
      const current = body.announcements?.find((item) => item.id === editingId);
      if (!current) throw new Error('The announcement is no longer available.');
      setAnnouncements(body.announcements);
      openEdit(current);
    } catch (error) { setFormError(error.message || 'Unable to reload the saved announcement.'); }
    finally { setSaving(false); }
  };

  const selectAnnouncementImage = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setFormError('Choose a JPG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFormError('Announcement image must be smaller than 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, imageName: file.name, imageType: file.type, imageData: String(reader.result || '') }));
      setFormError('');
    };
    reader.onerror = () => setFormError('Unable to read the selected image.');
    reader.readAsDataURL(file);
  };

  const hasFilters = Boolean(query || statusFilter !== 'all' || audienceFilter !== 'any' || priorityFilter !== 'all');
  const clearFilters = () => { setQuery(''); setStatusFilter('all'); setAudienceFilter('any'); setPriorityFilter('all'); };

  return <>
    <div className="announcement-management">
      <header className="announcement-heading">
        <div><span>COMMUNICATION HUB</span><h2>Announcement Management</h2><p>Create, schedule, and publish notices for applicants, scholars, and administrators.</p></div>
        <button type="button" onClick={openCreate}><Plus size={16} />New announcement</button>
      </header>

      <section className="announcement-metrics">
        <article className="green"><div><span>Total announcements</span><strong>{loading || (loadError && !announcements.length) ? '—' : metrics.total}</strong><small>All communication records</small></div><i><Megaphone size={20} /></i></article>
        <article className="blue"><div><span>Published records</span><strong>{loading || (loadError && !announcements.length) ? '—' : metrics.published}</strong><small>Includes expired published records</small></div><i><Send size={20} /></i></article>
        <article className="orange"><div><span>Scheduled</span><strong>{loading || (loadError && !announcements.length) ? '—' : metrics.scheduled}</strong><small>Waiting for publication</small></div><i><CalendarClock size={20} /></i></article>
        <article className="violet"><div><span>Drafts</span><strong>{loading || (loadError && !announcements.length) ? '—' : metrics.drafts}</strong><small>Unpublished working copies</small></div><i><FilePenLine size={20} /></i></article>
      </section>

      {notice && <Notification tone={notice.tone} title={notice.tone === 'error' ? 'Announcement needs attention' : 'Announcement updated'} onDismiss={() => setNotice(null)}>{notice.text}</Notification>}
      {loadError && <Notification tone="error" title="Unable to load announcements" action={<button type="button" onClick={() => loadAnnouncements({ showLoader: true })}>Retry</button>}>{loadError}</Notification>}

      <section className="announcement-directory">
        <div className="announcement-directory-heading"><div><i><Megaphone size={16} /></i><span><strong>Announcement directory</strong><small>Search and manage the complete publishing history.</small></span></div><em>{loadError && !announcements.length ? 'Records unavailable' : <>{filtered.length} records</>}</em></div>
        <div className="announcement-filters">
          <label className="announcement-search"><span>Search</span><div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or message" /></div></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="expired">Expired</option></select></label>
          <label><span>Audience</span><select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}><option value="any">All audiences</option>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select></label>
          {hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear</button>}
        </div>

        <div className="announcement-table">
          <div className="announcement-table-head"><span>Announcement</span><span>Audience</span><span>Priority</span><span>Status</span><span>Publish date</span><span>Updated</span><span>Action</span></div>
          <div className="announcement-table-body">
            {loading && !announcements.length && <div className="announcement-empty"><span className="scholars-spinner" />Loading announcements…</div>}
            {!loading && !loadError && !filtered.length && <div className="announcement-empty"><Megaphone size={22} /><strong>No announcements found</strong><span>{hasFilters ? 'Clear or adjust the filters.' : 'Create the first announcement to begin publishing notices.'}</span>{!hasFilters && <button type="button" onClick={openCreate}>Create announcement</button>}</div>}
            {filtered.map((announcement) => <article className="announcement-row" key={announcement.id}>
              <button type="button" className="announcement-title" onClick={() => openEdit(announcement)}>{announcement.imageData && <img src={announcement.imageData} alt="" />}<span><strong>{announcement.title}</strong><small>{announcement.content}</small></span></button>
              <span><UsersRound size={12} />{audienceLabels[announcement.audience] || announcement.audience}<small>{announcement.emailQueuedAt ? `Email: ${announcement.emailDeliveries?.sent || 0} sent, ${announcement.emailDeliveries?.pending || 0} pending, ${announcement.emailDeliveries?.failed || 0} failed, ${announcement.emailDeliveries?.sending || 0} sending, ${announcement.emailDeliveries?.cancelled || 0} cancelled` : announcement.audience === 'admins' ? 'Administrator portal notice' : announcement.notifyEmail ? 'Automatic email: awaiting publication/queue' : 'Historical notice: no retrospective email'}</small></span>
              <span className={`announcement-priority ${announcement.priority}`}>{announcement.priority}</span>
              <span className={`announcement-status ${announcementDisplayStatus(announcement)}`}>{announcementDisplayStatus(announcement)}</span>
              <span>{announcement.status === 'draft' ? 'Not scheduled' : formatAnnouncementDate(announcement.publishAt || announcement.publishedAt)}</span>
              <span>{formatAnnouncementDate(announcement.updatedAt)}</span>
              <button type="button" className="announcement-edit" onClick={() => openEdit(announcement)}><FilePenLine size={13} />Edit</button>
            </article>)}
          </div>
        </div>
      </section>
    </div>

    {editorOpen && <div className="announcement-editor-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditorOpen(false); }}>
      <form className="announcement-editor" role="dialog" aria-modal="true" aria-labelledby="announcement-editor-title" onSubmit={saveAnnouncement}>
        <header><div><span><Megaphone size={18} /></span><div><small>ANNOUNCEMENT EDITOR</small><h3 id="announcement-editor-title">{editingId ? 'Edit announcement' : 'Create announcement'}</h3></div></div><button type="button" onClick={() => setEditorOpen(false)} disabled={saving} aria-label="Close editor"><X size={19} /></button></header>
        <div className="announcement-editor-body">
          <section><h4>Message</h4><label><span>Title</span><input required maxLength={200} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter a clear announcement title" /></label><label><span>Content</span><textarea required maxLength={5000} rows={7} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Write the announcement message…" /><small>{form.content.length} / 5,000</small></label><label><span>Official Facebook post <small>(optional)</small></span><input type="url" inputMode="url" maxLength={2048} value={form.externalUrl} onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))} placeholder="https://www.facebook.com/..." /><small>Paste the exact official CAO Facebook post URL.</small></label><div className="announcement-image-field"><span>Image <small>(optional)</small></span>{form.imageData ? <div className="announcement-image-selected"><img src={form.imageData} alt="Announcement preview" /><span><strong>{form.imageName}</strong><small>{form.imageType}</small></span><button type="button" onClick={() => setForm((current) => ({ ...current, imageName: '', imageType: '', imageData: '' }))}><Trash2 size={14} />Remove</button></div> : <label className="announcement-image-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAnnouncementImage} /><ImagePlus size={18} /><span><strong>Add announcement image</strong><small>JPG, PNG, WEBP, or GIF · Maximum 3 MB</small></span></label>}</div></section>
          <section><h4>Delivery</h4><p>All announcement dates use Philippine Standard Time (UTC+8). Publishing automatically emails the selected applicants and/or scholars; no extra switch is required. Drafts and administrator-only notices do not send email. Routine edits do not resend notifications.</p><div className="announcement-editor-grid"><label><span>Audience</span><select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label><span>Publish date (PHT · UTC+8)</span><input type="datetime-local" value={form.publishAt} onChange={(event) => setForm((current) => ({ ...current, publishAt: event.target.value }))} /></label><label><span>Expires (PHT · UTC+8) <small>(optional)</small></span><input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label></div></section>
          <aside className={`announcement-preview ${form.priority}`}>{form.imageData && <img src={form.imageData} alt="" />}<div><span>PREVIEW · {audienceLabels[form.audience]}</span><strong>{form.title || 'Announcement title'}</strong><p>{form.content || 'Your announcement message will appear here.'}</p>{form.externalUrl && <em className="announcement-preview-link"><ExternalLink size={13} /> View official Facebook post</em>}</div></aside>
          {formError && <Notification tone="error" title="Unable to save announcement" action={editingId && <button type="button" disabled={saving} onClick={reloadEditor}>Reload saved version (replaces unsaved edits)</button>}>{formError}</Notification>}
        </div>
        <footer><button type="button" className="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button>{editingId && <button type="submit" name="action" value="save" className="secondary" disabled={saving}>Save changes</button>}<button type="submit" name="action" value="draft" className="secondary" disabled={saving}>Save Draft</button><button type="submit" name="action" value="schedule" className="secondary" disabled={saving}>Schedule</button><button type="submit" name="action" value="post-now" className="primary" disabled={saving}>{saving ? 'Saving…' : 'Post Now'}</button></footer>
      </form>
    </div>}
  </>;
}

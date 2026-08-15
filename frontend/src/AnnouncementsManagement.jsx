import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  FilePenLine,
  ImagePlus,
  Megaphone,
  Plus,
  Search,
  Send,
  TriangleAlert,
  Trash2,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';

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
});

const toDateTimeInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formatAnnouncementDate = (value, fallback = 'Not set') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
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
    const timer = window.setInterval(loadAnnouncements, 30000);
    const refresh = () => loadAnnouncements();
    window.addEventListener('focus', refresh);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); window.removeEventListener('focus', refresh); };
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
    const search = `${announcement.title} ${announcement.content}`.toLowerCase();
    return search.includes(query.trim().toLowerCase())
      && (statusFilter === 'all' || announcement.status === statusFilter)
      && (audienceFilter === 'any' || announcement.audience === audienceFilter)
      && (priorityFilter === 'all' || announcement.priority === priorityFilter);
  }), [announcements, query, statusFilter, audienceFilter, priorityFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (announcement) => {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      audience: announcement.audience,
      priority: announcement.priority,
      status: announcement.status,
      publishAt: toDateTimeInput(announcement.publishAt),
      expiresAt: toDateTimeInput(announcement.expiresAt),
      imageName: announcement.imageName || '',
      imageType: announcement.imageType || '',
      imageData: announcement.imageData || '',
    });
    setFormError('');
    setEditorOpen(true);
  };

  const saveAnnouncement = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (form.status === 'scheduled' && !form.publishAt) {
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
          publishAt: form.publishAt ? new Date(form.publishAt).toISOString() : null,
          expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save the announcement.');
      setEditorOpen(false);
      setNotice({ tone: 'success', text: body.message });
      await loadAnnouncements();
    } catch (error) {
      setFormError(error.message || 'Unable to save the announcement.');
    } finally {
      setSaving(false);
    }
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
        <article className="green"><div><span>Total announcements</span><strong>{loading ? '—' : metrics.total}</strong><small>All communication records</small></div><i><Megaphone size={20} /></i></article>
        <article className="blue"><div><span>Published</span><strong>{loading ? '—' : metrics.published}</strong><small>Currently visible notices</small></div><i><Send size={20} /></i></article>
        <article className="orange"><div><span>Scheduled</span><strong>{loading ? '—' : metrics.scheduled}</strong><small>Waiting for publication</small></div><i><CalendarClock size={20} /></i></article>
        <article className="violet"><div><span>Drafts</span><strong>{loading ? '—' : metrics.drafts}</strong><small>Unpublished working copies</small></div><i><FilePenLine size={20} /></i></article>
      </section>

      {notice && <div className={`announcement-notice ${notice.tone}`} role="status"><span>{notice.text}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}
      {loadError && <div className="announcement-notice error"><TriangleAlert size={16} /><span>{loadError}</span><button type="button" onClick={() => loadAnnouncements({ showLoader: true })}>Retry</button></div>}

      <section className="announcement-directory">
        <div className="announcement-directory-heading"><div><i><Megaphone size={16} /></i><span><strong>Announcement directory</strong><small>Search and manage the complete publishing history.</small></span></div><em>{filtered.length} records</em></div>
        <div className="announcement-filters">
          <label className="announcement-search"><span>Search</span><div><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title or message" /></div></label>
          <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option><option value="published">Published</option><option value="scheduled">Scheduled</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
          <label><span>Audience</span><select value={audienceFilter} onChange={(event) => setAudienceFilter(event.target.value)}><option value="any">All audiences</option>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Priority</span><select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}><option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select></label>
          {hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear</button>}
        </div>

        <div className="announcement-table">
          <div className="announcement-table-head"><span>Announcement</span><span>Audience</span><span>Priority</span><span>Status</span><span>Publish date</span><span>Updated</span><span>Action</span></div>
          <div className="announcement-table-body">
            {loading && !announcements.length && <div className="announcement-empty"><span className="scholars-spinner" />Loading announcements…</div>}
            {!loading && !filtered.length && <div className="announcement-empty"><Megaphone size={22} /><strong>No announcements found</strong><span>{hasFilters ? 'Clear or adjust the filters.' : 'Create the first announcement to begin publishing notices.'}</span>{!hasFilters && <button type="button" onClick={openCreate}>Create announcement</button>}</div>}
            {filtered.map((announcement) => <article className="announcement-row" key={announcement.id}>
              <button type="button" className="announcement-title" onClick={() => openEdit(announcement)}>{announcement.imageData && <img src={announcement.imageData} alt="" />}<span><strong>{announcement.title}</strong><small>{announcement.content}</small></span></button>
              <span><UsersRound size={12} />{audienceLabels[announcement.audience] || announcement.audience}</span>
              <span className={`announcement-priority ${announcement.priority}`}>{announcement.priority}</span>
              <span className={`announcement-status ${announcement.status}`}>{announcement.status}</span>
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
          <section><h4>Message</h4><label><span>Title</span><input required maxLength={200} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Enter a clear announcement title" /></label><label><span>Content</span><textarea required maxLength={5000} rows={7} value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} placeholder="Write the announcement message…" /><small>{form.content.length} / 5,000</small></label><div className="announcement-image-field"><span>Image <small>(optional)</small></span>{form.imageData ? <div className="announcement-image-selected"><img src={form.imageData} alt="Announcement preview" /><span><strong>{form.imageName}</strong><small>{form.imageType}</small></span><button type="button" onClick={() => setForm((current) => ({ ...current, imageName: '', imageType: '', imageData: '' }))}><Trash2 size={14} />Remove</button></div> : <label className="announcement-image-upload"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={selectAnnouncementImage} /><ImagePlus size={18} /><span><strong>Add announcement image</strong><small>JPG, PNG, WEBP, or GIF · Maximum 3 MB</small></span></label>}</div></section>
          <section><h4>Delivery</h4><div className="announcement-editor-grid"><label><span>Audience</span><select value={form.audience} onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))}>{Object.entries(audienceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span>Priority</span><select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></select></label><label><span>Publish date</span><input type="datetime-local" required={form.status === 'scheduled'} value={form.publishAt} onChange={(event) => setForm((current) => ({ ...current, publishAt: event.target.value }))} /></label><label><span>Expires <small>(optional)</small></span><input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label></div></section>
          <aside className={`announcement-preview ${form.priority}`}>{form.imageData && <img src={form.imageData} alt="" />}<div><span>PREVIEW · {audienceLabels[form.audience]}</span><strong>{form.title || 'Announcement title'}</strong><p>{form.content || 'Your announcement message will appear here.'}</p></div></aside>
          {formError && <div className="announcement-form-error"><TriangleAlert size={15} />{formError}</div>}
        </div>
        <footer><button type="button" className="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save changes' : form.status === 'published' ? 'Publish announcement' : 'Save announcement'}</button></footer>
      </form>
    </div>}
  </>;
}

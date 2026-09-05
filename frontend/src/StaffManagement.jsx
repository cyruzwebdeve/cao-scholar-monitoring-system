import {
  Eye,
  EyeOff,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  UserRoundCog,
  UsersRound,
  UserX,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
import './styles/staff-management.css';

const emptyData = {
  stats: { total: 0, active: 0, inactive: 0, superAdmins: 0 },
  staff: [],
};

const roleOptions = [
  ['RegularAdmin', 'Administrator'],
  ['BillingPayrollAdmin', 'Billing / Payroll Admin'],
  ['Moderator', 'Content Moderator'],
  ['SuperAdmin', 'Super Administrator'],
];

const sectionOptions = [
  ['dashboard', 'Dashboard'],
  ['applicants', 'Applicants'],
  ['examination', 'Examination & Results'],
  ['scholars', 'Scholars'],
  ['billing', 'Billing'],
  ['payroll', 'Payroll'],
  ['announcements', 'Announcements'],
  ['reports', 'Reports'],
  ['settings', 'Settings'],
  ['documentReviews', 'Document Reviews'],
];

const roleSectionDefaults = {
  SuperAdmin: sectionOptions.map(([key]) => key),
  RegularAdmin: ['dashboard', 'applicants', 'examination', 'scholars', 'billing', 'payroll', 'announcements', 'reports', 'settings'],
  BillingPayrollAdmin: ['dashboard', 'applicants', 'examination', 'scholars', 'billing', 'payroll', 'announcements', 'reports', 'settings'],
  Moderator: ['documentReviews', 'announcements', 'settings'],
};

const emptyForm = {
  fullName: '',
  email: '',
  role: 'RegularAdmin',
  isActive: true,
  password: '',
  confirmPassword: '',
  sectionAccess: roleSectionDefaults.RegularAdmin,
};

const formatDate = (value, fallback = 'Never') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const isStrongPassword = (value) => value.length >= 12
  && value.length <= 128
  && /[a-z]/.test(value)
  && /[A-Z]/.test(value)
  && /\d/.test(value);

function ModalShell({ children, title, eyebrow, onClose, size = '' }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="staff-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`staff-modal ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <header>
          <div><span>{eyebrow}</span><h3>{title}</h3></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={19} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PasswordField({ label, value, onChange, placeholder, autoComplete }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="staff-field">
      <span>{label}</span>
      <div className="staff-password-field">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </label>
  );
}

function StaffManagement({ token, onLogout }) {
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [passwordTarget, setPasswordTarget] = useState(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [saving, setSaving] = useState(false);
  const [reauthenticate, setReauthenticate] = useState(false);

  const fetchStaff = useCallback(async () => {
    const response = await fetch(`${API_BASE}/staff/management`, { headers: authHeaders(token) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to load staff accounts.');
    return payload;
  }, [token]);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchStaff();
      setData(payload);
      setError('');
    } catch (loadError) {
      console.warn('Unable to load staff accounts:', loadError);
      setError(loadError.message || 'Staff accounts could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [fetchStaff]);

  useEffect(() => {
    let active = true;
    fetchStaff()
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setError('');
      })
      .catch((loadError) => {
        console.warn('Unable to load staff accounts:', loadError);
        if (active) setError(loadError.message || 'Staff accounts could not be loaded.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [fetchStaff]);

  const visibleStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.staff.filter((member) => {
      const matchesSearch = !query || member.fullName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query);
      const matchesRole = !roleFilter || member.role === roleFilter;
      const matchesStatus = !statusFilter || (statusFilter === 'active' ? member.isActive : !member.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [data.staff, roleFilter, search, statusFilter]);

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setPendingUpdate(null);
    setFormError('');
  };

  const openCreate = () => {
    setForm(emptyForm);
    setFormError('');
    setEditor({ mode: 'create', member: null });
  };

  const openEdit = (member) => {
    setForm({
      fullName: member.fullName,
      email: member.email,
      role: member.role,
      isActive: member.isActive,
      password: '',
      confirmPassword: '',
      sectionAccess: member.sectionAccess || roleSectionDefaults[member.role],
    });
    setFormError('');
    setEditor({ mode: 'edit', member });
  };

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateRole = (role) => setForm((current) => ({ ...current, role, sectionAccess: [...roleSectionDefaults[role]] }));
  const toggleSection = (section) => setForm((current) => ({
    ...current,
    sectionAccess: current.sectionAccess.includes(section)
      ? current.sectionAccess.filter((item) => item !== section)
      : [...current.sectionAccess, section],
  }));

  const saveStaff = async (payload = form) => {
    setSaving(true);
    setFormError('');
    try {
      const isCreate = editor.mode === 'create';
      const endpoint = isCreate ? `${API_BASE}/staff` : `${API_BASE}/staff/${editor.member.id}`;
      const body = isCreate
        ? { fullName: payload.fullName, email: payload.email, role: payload.role, password: payload.password, sectionAccess: payload.sectionAccess }
        : { fullName: payload.fullName, email: payload.email, role: payload.role, isActive: payload.isActive, sectionAccess: payload.sectionAccess };
      const response = await fetch(endpoint, {
        method: isCreate ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to save the staff account.');
      setNotice({ tone: 'success', message: result.message });
      setEditor(null);
      setPendingUpdate(null);
      await loadStaff();
    } catch (saveError) {
      setPendingUpdate(null);
      setFormError(saveError.message || 'Unable to save the staff account.');
    } finally {
      setSaving(false);
    }
  };

  const submitEditor = (event) => {
    event.preventDefault();
    const normalized = { ...form, fullName: form.fullName.trim(), email: form.email.trim() };
    if (!normalized.fullName || !normalized.email) return setFormError('Full name and email address are required.');
    if (editor.mode === 'create') {
      if (!isStrongPassword(normalized.password)) return setFormError('Password must be 12-128 characters and include uppercase, lowercase, and a number.');
      if (normalized.password !== normalized.confirmPassword) return setFormError('The password confirmation does not match.');
      saveStaff(normalized);
      return undefined;
    }
    const accessChanged = normalized.role !== editor.member.role
      || normalized.isActive !== editor.member.isActive
      || JSON.stringify([...normalized.sectionAccess].sort()) !== JSON.stringify([...(editor.member.sectionAccess || [])].sort());
    if (accessChanged) {
      setPendingUpdate(normalized);
      return undefined;
    }
    saveStaff(normalized);
    return undefined;
  };

  const openPassword = (member) => {
    setPasswordTarget(member);
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
  };

  const submitPassword = async (event) => {
    event.preventDefault();
    if (!isStrongPassword(passwordForm.newPassword)) return setPasswordError('New password must be 12-128 characters and include uppercase, lowercase, and a number.');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) return setPasswordError('The password confirmation does not match.');
    setSaving(true);
    setPasswordError('');
    try {
      const response = await fetch(`${API_BASE}/staff/${passwordTarget.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Unable to change the staff password.');
      setPasswordTarget(null);
      setNotice({ tone: 'success', message: result.message });
      if (result.requiresReauthentication) setReauthenticate(true);
    } catch (saveError) {
      setPasswordError(saveError.message || 'Unable to change the staff password.');
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  const metrics = [
    ['Staff accounts', data.stats.total, UsersRound, 'green', 'All administrator accounts'],
    ['Active staff', data.stats.active, UserCheck, 'blue', 'Accounts with portal access'],
    ['Inactive staff', data.stats.inactive, UserX, 'orange', 'Access currently disabled'],
    ['Super admins', data.stats.superAdmins, ShieldCheck, 'violet', 'Active full-access accounts'],
  ];

  return (
    <div className="staff-management">
      <header className="staff-heading">
        <div><span>ACCESS MANAGEMENT</span><h2>Staff Management</h2><p>Create staff accounts and manage administrator access securely.</p></div>
        <div className="staff-heading-actions">
          <button type="button" className="staff-refresh" onClick={loadStaff} disabled={loading}><RefreshCw size={16} className={loading ? 'spinning' : ''} />Refresh</button>
          <button type="button" className="staff-primary" onClick={openCreate}><Plus size={17} />Add staff</button>
        </div>
      </header>

      <div className="staff-metrics">
        {metrics.map(([label, value, Icon, tone, helper]) => (
          <article className={tone} key={label}><div><span>{label}</span><strong>{value}</strong><small>{helper}</small></div><i><Icon size={21} /></i></article>
        ))}
      </div>

      {notice && <div className={`staff-notice ${notice.tone}`} role="status"><ShieldCheck size={18} /><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={16} /></button></div>}
      {error && <div className="staff-notice error" role="status"><TriangleAlert size={18} /><span>{error}</span><button type="button" onClick={loadStaff}>Retry</button></div>}

      <section className="staff-directory">
        <div className="staff-directory-heading">
          <div className="staff-directory-title"><i><UserRoundCog size={19} /></i><div><h3>Staff directory</h3><p>{visibleStaff.length} of {data.staff.length} accounts shown</p></div></div>
          <div className="staff-filters">
            <label className="staff-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" /></label>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by staff role">
              <option value="">All roles</option>
              {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by account status">
              <option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>Staff member</th><th>Role</th><th>Status</th><th>Last login</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {loading && !data.staff.length && <tr className="staff-empty"><td colSpan="6"><span className="staff-loader" />Loading staff accounts...</td></tr>}
              {!loading && !visibleStaff.length && <tr className="staff-empty"><td colSpan="6"><UsersRound size={25} /><strong>No staff accounts found</strong><span>Adjust the filters or create a new staff account.</span></td></tr>}
              {visibleStaff.map((member) => (
                <tr key={member.id} className={!member.isActive ? 'is-inactive' : ''}>
                  <td data-label="Staff member"><strong>{member.fullName}{member.isCurrentUser && <em>You</em>}</strong><small>{member.email}</small></td>
                  <td data-label="Role"><span className={`staff-role ${member.role}`}>{member.roleLabel}</span></td>
                  <td data-label="Status"><span className={`staff-status ${member.isActive ? 'active' : 'inactive'}`}><i />{member.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td data-label="Last login"><span>{formatDate(member.lastLoginAt)}</span></td>
                  <td data-label="Created"><span>{formatDate(member.createdAt, 'Unavailable')}</span></td>
                  <td data-label="Actions"><div className="staff-row-actions"><button type="button" onClick={() => openEdit(member)}><Pencil size={14} />Edit</button><button type="button" onClick={() => openPassword(member)}><KeyRound size={14} />Password</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editor && (
        <ModalShell eyebrow={editor.mode === 'create' ? 'NEW STAFF ACCOUNT' : 'ACCOUNT SETTINGS'} title={editor.mode === 'create' ? 'Add staff member' : `Edit ${editor.member.fullName}`} onClose={closeEditor} size="wide">
          <form className="staff-modal-form" onSubmit={submitEditor}>
            <div className="staff-form-section"><div><span>01</span><section><h4>Account information</h4><p>The staff member will use this email address to sign in.</p></section></div><div className="staff-form-grid"><label className="staff-field"><span>Full name</span><input value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} maxLength="150" required /></label><label className="staff-field"><span>Email address</span><input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} maxLength="150" required /></label></div></div>
            <div className="staff-form-section"><div><span>02</span><section><h4>Access and role</h4><p>Assign only the access needed for this member&apos;s responsibilities.</p></section></div><div className="staff-form-grid"><label className="staff-field"><span>Staff role</span><select value={form.role} onChange={(event) => updateRole(event.target.value)} disabled={editor.mode === 'edit' && editor.member.isCurrentUser}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{editor.mode === 'edit' && <label className="staff-field"><span>Account status</span><select value={form.isActive ? 'active' : 'inactive'} onChange={(event) => updateForm('isActive', event.target.value === 'active')} disabled={editor.member.isCurrentUser}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>}</div></div>
            <div className="staff-form-section"><div><span>03</span><section><h4>Section access</h4><p>Choose the sidebar sections this account can open. Role security rules still apply.</p></section></div><div className="staff-permission-grid">{sectionOptions.filter(([key]) => roleSectionDefaults[form.role].includes(key)).map(([key, label]) => <label key={key} className="staff-permission"><input type="checkbox" checked={form.sectionAccess.includes(key)} disabled={form.role === 'SuperAdmin' || (editor.mode === 'edit' && editor.member.isCurrentUser)} onChange={() => toggleSection(key)} /><span><b>{label}</b><small>{form.sectionAccess.includes(key) ? 'Access allowed' : 'Access blocked'}</small></span></label>)}</div></div>
            {editor.mode === 'create' && <div className="staff-form-section"><div><span>04</span><section><h4>Temporary password</h4><p>Share it privately. The password can be replaced later but never viewed.</p></section></div><div className="staff-form-grid"><PasswordField label="Temporary password" value={form.password} onChange={(value) => updateForm('password', value)} autoComplete="new-password" /><PasswordField label="Confirm password" value={form.confirmPassword} onChange={(value) => updateForm('confirmPassword', value)} autoComplete="new-password" /></div><small className="staff-password-hint">Use at least 12 characters with uppercase, lowercase, and a number.</small></div>}
            {formError && <div className="staff-form-error"><TriangleAlert size={16} />{formError}</div>}
            <footer><button type="button" className="staff-secondary" onClick={closeEditor} disabled={saving}>Cancel</button><button type="submit" className="staff-primary" disabled={saving}>{saving ? 'Saving...' : editor.mode === 'create' ? 'Create account' : 'Save changes'}</button></footer>
          </form>
        </ModalShell>
      )}

      {pendingUpdate && (
        <ModalShell eyebrow="CONFIRM ACCESS CHANGE" title="Update staff access?" onClose={() => !saving && setPendingUpdate(null)}>
          <div className="staff-confirm"><i><TriangleAlert size={22} /></i><p>Changing <strong>{editor.member.fullName}</strong>&apos;s role, status, or section access will sign out their existing sessions immediately.</p><div><button type="button" className="staff-secondary" onClick={() => setPendingUpdate(null)} disabled={saving}>Go back</button><button type="button" className="staff-danger" onClick={() => saveStaff(pendingUpdate)} disabled={saving}>{saving ? 'Updating...' : 'Confirm change'}</button></div></div>
        </ModalShell>
      )}

      {passwordTarget && (
        <ModalShell eyebrow="SECURITY" title={`Set a new password for ${passwordTarget.fullName}`} onClose={() => !saving && setPasswordTarget(null)}>
          <form className="staff-password-form" onSubmit={submitPassword}>
            <div className="staff-security-note"><ShieldCheck size={19} /><p>Passwords cannot be viewed. Setting a new one will sign this account out on all devices.</p></div>
            <PasswordField label="Your current Super Admin password" value={passwordForm.currentPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))} autoComplete="current-password" />
            <PasswordField label="New staff password" value={passwordForm.newPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))} autoComplete="new-password" />
            <PasswordField label="Confirm new password" value={passwordForm.confirmPassword} onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))} autoComplete="new-password" />
            <small className="staff-password-hint">Use at least 12 characters with uppercase, lowercase, and a number.</small>
            {passwordError && <div className="staff-form-error"><TriangleAlert size={16} />{passwordError}</div>}
            <footer><button type="button" className="staff-secondary" onClick={() => setPasswordTarget(null)} disabled={saving}>Cancel</button><button type="submit" className="staff-primary" disabled={saving}>{saving ? 'Changing...' : 'Change password'}</button></footer>
          </form>
        </ModalShell>
      )}

      {reauthenticate && (
        <ModalShell eyebrow="PASSWORD UPDATED" title="Sign in again" onClose={() => {}}>
          <div className="staff-reauth"><i><ShieldCheck size={24} /></i><p>Your password was changed and your previous session is no longer valid.</p><button type="button" className="staff-primary" onClick={onLogout}>Continue to login</button></div>
        </ModalShell>
      )}
    </div>
  );
}

export default StaffManagement;

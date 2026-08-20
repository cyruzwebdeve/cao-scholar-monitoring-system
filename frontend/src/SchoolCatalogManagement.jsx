import {
  CheckCircle2,
  FilePenLine,
  RefreshCw,
  School,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import schoolsListData from '../../schools_list.json';
import { API_BASE, authHeaders } from './services/api';
import './styles/school-catalog.css';

const baseCatalog = schoolsListData.schools.map((name) => ({ name, classification: 'Public' }));

const formatClassification = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'private' ? 'Private' : 'Public';
};

const mergeCatalog = (savedSchools = []) => {
  const savedByName = new Map(savedSchools.map((school) => [String(school.name).trim().toLowerCase(), school]));
  const baseNames = new Set(baseCatalog.map((school) => school.name.trim().toLowerCase()));
  const schools = baseCatalog.map((school) => {
    const saved = savedByName.get(school.name.trim().toLowerCase());
    return { ...school, ...(saved || {}), classification: formatClassification(saved?.classification) };
  });
  savedSchools.forEach((school) => {
    if (!baseNames.has(String(school.name).trim().toLowerCase())) {
      schools.push({ ...school, classification: formatClassification(school.classification) });
    }
  });
  return schools.sort((left, right) => left.name.localeCompare(right.name));
};

function SchoolCatalogManagement({ token }) {
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [classification, setClassification] = useState('public');
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const fetchCatalog = useCallback(async () => {
    const response = await fetch(`${API_BASE}/schools/catalog`, { headers: authHeaders(token) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || 'Unable to load the school catalog.');
    return payload;
  }, [token]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await fetchCatalog();
      setSchools(mergeCatalog(payload.schools || []));
      setLoadError('');
      setLastUpdated(new Date());
    } catch (error) {
      setLoadError(error.message || 'Unable to load the school catalog.');
    } finally {
      setLoading(false);
    }
  }, [fetchCatalog]);

  useEffect(() => {
    let active = true;
    fetchCatalog()
      .then((payload) => {
        if (!active) return;
        setSchools(mergeCatalog(payload.schools || []));
        setLoadError('');
        setLastUpdated(new Date());
      })
      .catch((error) => { if (active) setLoadError(error.message || 'Unable to load the school catalog.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchCatalog]);

  const counts = useMemo(() => ({
    total: schools.length,
    public: schools.filter((school) => school.classification === 'Public').length,
    private: schools.filter((school) => school.classification === 'Private').length,
  }), [schools]);

  const visibleSchools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return schools.filter((school) => (
      (!normalizedQuery || school.name.toLowerCase().includes(normalizedQuery))
      && (filter === 'all' || school.classification.toLowerCase() === filter)
    ));
  }, [filter, query, schools]);

  const openClassification = (school) => {
    setSelectedSchool(school);
    setClassification(school.classification.toLowerCase());
    setSaveError('');
  };

  const closeClassification = () => {
    if (saving) return;
    setSelectedSchool(null);
    setSaveError('');
  };

  const saveClassification = async () => {
    if (!selectedSchool || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch(`${API_BASE}/schools/classification`, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedSchool.name, classification }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Unable to update the school classification.');
      const nextClassification = formatClassification(payload.school?.classification || classification);
      setSchools((current) => current.map((school) => school.name === selectedSchool.name
        ? { ...school, ...(payload.school || {}), classification: nextClassification }
        : school));
      setNotice(`${selectedSchool.name} is now classified as ${nextClassification}.`);
      setSelectedSchool(null);
    } catch (error) {
      setSaveError(error.message || 'Unable to update the school classification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="school-catalog-page">
      <header className="school-catalog-heading">
        <div><span>CATALOG MANAGEMENT</span><h2>School Catalog</h2><p>Review institutions and maintain the Public or Private classification used by Billing and Payroll.</p></div>
        <div className="school-catalog-refresh"><button type="button" onClick={loadCatalog} disabled={loading}><RefreshCw size={15} className={loading ? 'spinning' : ''} />Refresh catalog</button><small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for live data'}</small></div>
      </header>

      <div className="school-catalog-stats">
        <article><span>All schools</span><strong>{counts.total}</strong><small>Institutions available in forms</small></article>
        <article className="public"><span>Public</span><strong>{counts.public}</strong><small>Government-funded institutions</small></article>
        <article className="private"><span>Private</span><strong>{counts.private}</strong><small>Privately operated institutions</small></article>
      </div>

      {notice && <div className="school-catalog-notice success" role="status"><CheckCircle2 size={17} /><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={15} /></button></div>}
      {loadError && <div className="school-catalog-notice error" role="status"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={loadCatalog}>Retry</button></div>}

      <section className="dashboard-surface dashboard-school-directory school-catalog-directory">
        <div className="dashboard-surface-header"><div><span className="dashboard-panel-icon gold"><School size={16} /></span><div><h3>School Directory</h3><p>Click a school to change its classification.</p></div></div><span className="dashboard-record-count">{visibleSchools.length} of {schools.length} schools</span></div>
        <div className="school-catalog-toolbar">
          <label><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search school name" aria-label="Search schools" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter school classification"><option value="all">All classifications</option><option value="public">Public schools</option><option value="private">Private schools</option></select>
        </div>
        <div className="dashboard-school-grid school-catalog-grid">
          {loading && !schools.length && <div className="school-catalog-empty"><span className="school-catalog-loader" /><strong>Loading school catalog</strong><span>Retrieving the latest classifications…</span></div>}
          {visibleSchools.map((school) => <button type="button" key={school.name} onClick={() => openClassification(school)}><span className="dashboard-school-icon"><School size={15} /></span><div><strong>{school.name}</strong><small className={`dashboard-school-type ${school.classification.toLowerCase()}`}>{school.classification}</small></div><FilePenLine className="dashboard-school-edit" size={14} /></button>)}
          {!loading && !visibleSchools.length && <div className="school-catalog-empty"><Search size={24} /><strong>No schools found</strong><span>Try another name or classification.</span><button type="button" onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button></div>}
        </div>
      </section>

      {selectedSchool && <div className="school-classification-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeClassification()}>
        <section className="school-classification-modal" role="dialog" aria-modal="true" aria-labelledby="school-classification-title">
          <button type="button" className="school-classification-close" onClick={closeClassification} disabled={saving} aria-label="Close classification window"><X size={18} /></button>
          <div className="school-classification-heading"><span><School size={18} /></span><div><small>SCHOOL CATALOG</small><h3 id="school-classification-title">Classify school</h3></div></div>
          <p className="school-classification-name">{selectedSchool.name}</p>
          <p className="school-classification-help">Choose how this institution should be categorized in Billing and Payroll records.</p>
          <div className="school-classification-options">
            {['public', 'private'].map((option) => <button type="button" className={classification === option ? 'selected' : ''} key={option} onClick={() => setClassification(option)}><span>{option === 'public' ? 'Public' : 'Private'}</span><small>{option === 'public' ? 'Government-funded institution' : 'Privately operated institution'}</small><i>{classification === option ? '✓' : ''}</i></button>)}
          </div>
          {saveError && <div className="school-classification-error"><TriangleAlert size={15} />{saveError}</div>}
          <footer><button type="button" className="secondary" onClick={closeClassification} disabled={saving}>Cancel</button><button type="button" className="primary" onClick={saveClassification} disabled={saving}>{saving ? 'Saving…' : 'Save classification'}</button></footer>
        </section>
      </div>}
    </div>
  );
}

export default SchoolCatalogManagement;

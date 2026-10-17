import Notification from './components/Notification';
import PrivateGrantEditor from './PrivateGrantEditor';
import InitialRequirementCapture from './InitialRequirementCapture';
import ContinuingRequirementsSettings from './ContinuingRequirementsSettings';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  BookOpenCheck,
  CalendarRange,
  CircleDollarSign,
  Download,
  Eye,
  FileCheck2,
  Filter,
  GraduationCap,
  History,
  ReceiptText,
  Save,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { DecisionModal, ReviewModal } from './DocumentReviewManagement';
import { buildRecordRows, downloadCsv } from './utils/csvExport';
import { saveProcessingHandoff } from './utils/processingHandoff';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';
import certificateHeader from './assets/certificate-header.png';
import { certificateReferenceFor } from './utils/certificateReference';
import './styles/document-reviews.css';
import './styles/scholars-management.css';

import { requirementScope, requirementScopeQuery } from './utils/requirementWaves';

const formatScholarDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatCertificateDate = (value = new Date()) => value.toLocaleDateString('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const formatScholarAmount = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0));

const imageUrlToDataUrl = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Unable to load the official certificate header.');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to prepare the official certificate header.'));
    reader.readAsDataURL(blob);
  });
};

const scholarExportColumns = [
  { key: 'name', label: 'Scholar Name', group: 'Scholar' },
  { key: 'controlNumber', label: 'Control Number', group: 'Scholar', value: (record) => record.controlNumber || record.scholarId },
  { key: 'email', label: 'Email', group: 'Scholar' },
  { key: 'municipality', label: 'Municipality', group: 'Education & location' },
  { key: 'school', label: 'School', group: 'Education & location' },
  { key: 'barangay', label: 'Barangay', group: 'Education & location' },
  { key: 'schoolYear', label: 'School Year', group: 'Education & location' },
  { key: 'status', label: 'Status', group: 'Record status' },
  { key: 'documentStatus', label: 'Documents', group: 'Record status' },
];


function ScholarBadge({ value, type }) {
  return <span className={`scholar-admin-badge ${type} ${value.toLowerCase().replace(/\s+/g, '-')}`}>{type === 'status' ? <BadgeCheck size={13} /> : <FileCheck2 size={13} />}{value}</span>;
}

export default function ScholarsManagement({ token, user, onSectionChange }) {
  const [scholars, setScholars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [municipality, setMunicipality] = useState('All Municipalities');
  const [school, setSchool] = useState('All Schools');
  const [barangay, setBarangay] = useState('All Barangays');
  const [documentStatus, setDocumentStatus] = useState('All Documents');
  const [selected, setSelected] = useState(null);
  const [sectionTab, setSectionTab] = useState('directory');
  const [schedulePeriodId, setSchedulePeriodId] = useState(null);
  const [drawerTab, setDrawerTab] = useState('overview');
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const [academicPeriods, setAcademicPeriods] = useState([]);
  const [billingForm, setBillingForm] = useState({ schoolYear: '', semester: '' });
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantNotice, setGrantNotice] = useState('');
  const [billingSaving, setBillingSaving] = useState(false);
  const [billingPeriodLoading, setBillingPeriodLoading] = useState(false);
  const [billingEditError, setBillingEditError] = useState('');
  const [documentReview, setDocumentReview] = useState(null);
  const [documentPreview, setDocumentPreview] = useState('');
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState('');
  const [documentDecision, setDocumentDecision] = useState('');
  const [documentDecisionError, setDocumentDecisionError] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);
  const [documentNotice, setDocumentNotice] = useState('');
  const [documentNoticeTone, setDocumentNoticeTone] = useState('success');
  const [openingRequirement, setOpeningRequirement] = useState('');
  const [certificateDownloading, setCertificateDownloading] = useState(false);
  const [certificateNotice, setCertificateNotice] = useState(null);
  const pageSize = 10;
  const canEditBilling = user?.role === 'SuperAdmin'
    || !Array.isArray(user?.sectionAccess)
    || user.sectionAccess.includes(selected?.processRoute === 'payroll' ? 'payroll' : 'billing');
  const canReviewDocuments = ['SuperAdmin', 'BillingPayrollAdmin'].includes(user?.role)
    && (user?.role === 'SuperAdmin' || !Array.isArray(user?.sectionAccess) || user.sectionAccess.includes('documentReviews'));
  const canUploadScholarRequirements = ['SuperAdmin', 'RegularAdmin'].includes(user?.role)
    && (user?.role === 'SuperAdmin' || !Array.isArray(user?.sectionAccess) || user.sectionAccess.includes('scholars'));
  const canViewScholarDocuments = canReviewDocuments || canUploadScholarRequirements;
  const canOpenSettings = user?.role === 'SuperAdmin'
    || !Array.isArray(user?.sectionAccess)
    || user.sectionAccess.includes('settings');

  const openNewCycleSetup = () => {
    setSelected(null);
    onSectionChange?.('Settings');
  };

  const loadScholars = useCallback(async ({ showLoader = false, academicPeriodId } = {}) => {
    academicPeriodId ||= schedulePeriodId;
    if (showLoader) setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/scholars/management${academicPeriodId ? `?academicPeriodId=${academicPeriodId}` : ""}`, { headers: authHeaders(token) });
      if (!response.ok) throw new Error('Unable to load scholar records.');
      const payload = await response.json();
      const nextScholars = payload.scholars || [];
      setAcademicPeriods(payload.academicPeriods || []);
      setScholars(nextScholars);
      setSelected((current) => current
        ? current.academicPeriodId && current.academicPeriodId !== payload.activePeriod?.id
          ? current
          : nextScholars.find((scholar) => scholar.id === current.id) || current
        : null);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'Unable to load scholar records.');
    } finally {
      setLoading(false);
    }
  }, [token, schedulePeriodId]);

  useEffect(() => {
    const initialLoad = window.setTimeout(loadScholars, 0);
    const stopRefreshing = subscribeToVisibleRefresh(loadScholars, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { window.clearTimeout(initialLoad); stopRefreshing(); };
  }, [loadScholars]);

  useEffect(() => {
    if (!selected) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape' && !documentReview) setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [documentReview, selected]);

  useEffect(() => () => { if (documentPreview) URL.revokeObjectURL(documentPreview); }, [documentPreview]);

  const closeDocumentReview = useCallback(() => {
    if (documentPreview) URL.revokeObjectURL(documentPreview);
    setDocumentPreview('');
    setDocumentPreviewError('');
    setDocumentDecision('');
    setDocumentDecisionError('');
    setDocumentReview(null);
  }, [documentPreview]);

  const openDocumentReview = async (document) => {
    if (!canReviewDocuments || !document.submitted || !document.applicationId || !document.requirementKey) return;
    if (documentPreview) URL.revokeObjectURL(documentPreview);
    const review = {
      ...document,
      applicantId: selected.applicantId,
      scholarName: selected.name,
      email: selected.email,
      controlNumber: selected.controlNumber,
      municipality: selected.municipality,
      requirementLabel: document.label,
      status: String(document.status || 'pending').toLowerCase(),
      autoAcceptance: false,
    };
    setDocumentReview(review);
    setDocumentPreview('');
    setDocumentPreviewError('');
    setDocumentPreviewLoading(true);
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${document.applicationId}/${document.requirementKey}/file${requirementScopeQuery(document)}`, { headers: authHeaders(token) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || 'Unable to open the document.');
      }
      setDocumentPreview(URL.createObjectURL(await response.blob()));
    } catch (error) {
      setDocumentPreviewError(error.message || 'Unable to open the document.');
    } finally {
      setDocumentPreviewLoading(false);
    }
  };

  const saveDocumentDecision = async (notes) => {
    if (!documentReview || !documentDecision) return;
    setDocumentSaving(true);
    setDocumentDecisionError('');
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${documentReview.applicationId}/${documentReview.requirementKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({ decision: documentDecision, notes, ...requirementScope(documentReview) }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to save the review decision.');
      setDocumentNotice(body.message || 'Document review saved.');
      setDocumentNoticeTone('success');
      closeDocumentReview();
      await loadScholars({ academicPeriodId: selected?.academicPeriodId });
    } catch (error) {
      setDocumentDecisionError(error.message || 'Unable to save the review decision.');
    } finally {
      setDocumentSaving(false);
    }
  };

  const openScholarDocument = async (document) => {
    if (!document.applicationId || openingRequirement) return;
    setOpeningRequirement(document.requirementKey);
    setDocumentNotice('');
    try {
      const response = await fetch(`${API_BASE}/document-reviews/${document.applicationId}/${document.requirementKey}/file${requirementScopeQuery(document)}`, { headers: authHeaders(token) });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.message || 'Unable to open the scholar requirement.');
      }
      const url = URL.createObjectURL(await response.blob());
      const link = window.document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      setDocumentNotice(error.message || 'Unable to open the scholar requirement.');
      setDocumentNoticeTone('error');
    } finally {
      setOpeningRequirement('');
    }
  };

  const municipalities = useMemo(() => [...new Set(scholars.map((item) => item.municipality).filter(Boolean))].sort(), [scholars]);
  const schools = useMemo(() => [...new Set(scholars
    .filter((item) => municipality === 'All Municipalities' || item.municipality === municipality)
    .map((item) => item.school)
    .filter(Boolean))].sort(), [scholars, municipality]);
  const barangays = useMemo(() => [...new Set(scholars
    .filter((item) => (municipality === 'All Municipalities' || item.municipality === municipality)
      && (school === 'All Schools' || item.school === school))
    .map((item) => item.barangay)
    .filter(Boolean))].sort(), [scholars, municipality, school]);

  const filtered = useMemo(() => scholars.filter((item) => {
    const searchValue = `${item.name} ${item.controlNumber || ''} ${item.email || ''}`.toLowerCase();
    return searchValue.includes(query.trim().toLowerCase())
      && (municipality === 'All Municipalities' || item.municipality === municipality)
      && (school === 'All Schools' || item.school === school)
      && (barangay === 'All Barangays' || item.barangay === barangay)
      && (documentStatus === 'All Documents' || item.documentStatus === documentStatus);
  }), [scholars, query, municipality, school, barangay, documentStatus]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const activeCount = scholars.filter(({ status }) => status === 'Active').length;
  const completeCount = scholars.filter(({ documentStatus: value }) => value === 'Complete').length;
  const reviewCount = scholars.filter(({ documentStatus: value }) => value === 'Review').length;
  const hasFilters = query || municipality !== 'All Municipalities' || school !== 'All Schools' || barangay !== 'All Barangays' || documentStatus !== 'All Documents';
  const certificationHistory = (selected?.financialHistory || [])
    .filter((record) => record.processRoute === 'billing')
    .sort((left, right) => new Date(right.dateProcessed || 0) - new Date(left.dateProcessed || 0));

  const clearFilters = () => {
    setQuery('');
    setMunicipality('All Municipalities');
    setSchool('All Schools');
    setBarangay('All Barangays');
    setDocumentStatus('All Documents');
    setPage(1);
  };

  const formFromScholarPeriod = (record, period) => ({
    schoolYear: period?.schoolYear || record.billingSchoolYear || record.schoolYear || '',
    semester: period?.semester || record.billingSemester || record.semester || '',
  });

  const openBillingTab = () => {
    const defaultPeriod = academicPeriods.find((period) => period.id === selected.academicPeriodId)
      || academicPeriods.find((period) => period.id === selected.billingAcademicPeriodId)
      || academicPeriods.find((period) => period.schoolYear === selected.billingSchoolYear && period.semester === selected.billingSemester)
      || academicPeriods.find((period) => period.isPrimary)
      || academicPeriods.find((period) => period.isActive)
      || academicPeriods[0];
    setBillingForm(formFromScholarPeriod(selected, defaultPeriod));
    setBillingEditError('');
    setGrantNotice('');
    setDrawerTab('finance');
  };

  const activeBillingPeriods = academicPeriods.filter((period) => period.isActive);
  const billingSchoolYears = [...new Set(activeBillingPeriods.map((period) => period.schoolYear))];
  const billingSemesters = activeBillingPeriods
    .filter((period) => period.schoolYear === billingForm.schoolYear)
    .map((period) => period.semester);

  const selectBillingPeriod = async (period) => {
    if (!period || billingPeriodLoading) return;
    setBillingForm((current) => ({ ...current, schoolYear: period.schoolYear, semester: period.semester }));
    setGrantNotice('');
    setBillingPeriodLoading(true);
    setBillingEditError('');
    try {
      const response = await fetch(`${API_BASE}/scholars/management?academicPeriodId=${encodeURIComponent(period.id)}`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to prepare the selected scholar session.');
      const periodScholar = (body.scholars || []).find((scholar) => scholar.id === selected.id);
      if (!periodScholar) throw new Error('The scholar is unavailable for the selected period.');
      setAcademicPeriods(body.academicPeriods || academicPeriods);
      setSelected(periodScholar);
      setBillingForm(formFromScholarPeriod(periodScholar, body.activePeriod || period));
    } catch (error) {
      setBillingEditError(error.message || 'Unable to prepare the selected scholar session.');
      const currentPeriod = academicPeriods.find((item) => item.id === selected.academicPeriodId);
      setBillingForm(formFromScholarPeriod(selected, currentPeriod));
    } finally {
      setBillingPeriodLoading(false);
    }
  };

  const saveBillingMetadata = async (event, { grantSaved = false } = {}) => {
    event?.preventDefault();
    if (!selected || billingSaving || billingPeriodLoading || (grantBusy && !grantSaved)) return;
    setBillingSaving(true);
    setBillingEditError('');
    try {
      const selectedPeriod = academicPeriods.find((period) => (
        period.schoolYear === billingForm.schoolYear && period.semester === billingForm.semester
      ));
      if (!selectedPeriod) throw new Error('Select a configured school year and semester.');
      const destinationMode = selected.processRoute;
      if (!['payroll', 'billing'].includes(destinationMode)) throw new Error('Correct the school classification before preparing a session.');
      if (selected.schoolType === 'Private' && !selected.grantPrepared && !grantSaved) throw new Error('Save the Private grant record for this period first.');
      const response = await fetch(`${API_BASE}/scholars/${selected.applicantId}/billing-metadata`, {
        method: 'PUT',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicPeriodId: selectedPeriod.id, billingStatus: 'Not billed yet' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to update billing and payroll details.');
      const handoffSaved = saveProcessingHandoff({ periodId: selectedPeriod.id, applicantId: selected.applicantId, mode: destinationMode });
      if (onSectionChange && handoffSaved) {
        setSelected(null);
        onSectionChange(destinationMode === 'billing' ? 'Billing' : 'Payroll');
      } else {
        await selectBillingPeriod(selectedPeriod);
      }
    } catch (error) {
      if (grantSaved) throw error;
      setBillingEditError(error.message || 'Unable to update billing and payroll details.');
    } finally {
      setBillingSaving(false);
    }
  };

  const downloadPrivateCertificate = async () => {
    if (!selected || String(selected.schoolType || '').toLowerCase() !== 'private' || certificateDownloading) return;
    setCertificateDownloading(true);
    setCertificateNotice(null);
    try {
      const [{ jsPDF }, headerDataUrl] = await Promise.all([
        import('jspdf'),
        imageUrlToDataUrl(certificateHeader),
      ]);
      const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
      const pageWidth = document.internal.pageSize.getWidth();
      const margin = 25;
      const contentWidth = pageWidth - (margin * 2);
      const reference = certificateReferenceFor(selected);
      const scholarName = String(selected.name || 'Scholar').toUpperCase();
      const course = selected.course || 'the declared program';
      const yearLevel = selected.yearLevel || 'enrolled';
      const school = selected.school || 'the declared private school';
      const semester = selected.semester || 'current semester';
      const schoolYear = selected.schoolYear || 'current school year';

      document.addImage(headerDataUrl, 'PNG', 32, 12, pageWidth - 64, 29);
      document.setDrawColor(35, 35, 35);
      document.setLineWidth(0.35);
      document.line(margin, 45, pageWidth - margin, 45);

      document.setTextColor(31, 78, 121);
      document.setFont('times', 'bold');
      document.setFontSize(13);
      document.text('PROVINCIAL GOVERNMENT COLLEGE', pageWidth / 2, 55, { align: 'center' });
      document.text('EDUCATION ASSISTANCE PROGRAM (PGCEAP)', pageWidth / 2, 62, { align: 'center' });

      document.setTextColor(20, 20, 20);
      document.setFontSize(16);
      document.text('CERTIFICATION', pageWidth / 2, 82, { align: 'center' });
      document.setLineWidth(0.3);
      document.line((pageWidth / 2) - 26, 84, (pageWidth / 2) + 26, 84);

      document.setFont('times', 'normal');
      document.setFontSize(10);
      document.text(`Certification No.: ${reference}`, pageWidth - margin, 96, { align: 'right' });

      document.setFont('times', 'bold');
      document.setFontSize(12);
      document.text('TO WHOM IT MAY CONCERN:', margin, 116);

      document.setFont('times', 'normal');
      document.setFontSize(12);
      const firstParagraph = `This is to certify that ${scholarName}, a ${yearLevel} ${course} student of ${school}, is a SCHOLARSHIP GRANTEE under the Provincial Government College Education Assistance Program (PGCEAP) for the ${semester}, School Year ${schoolYear}.`;
      const secondParagraph = 'As such, the Provincial Government assumes payment of the scholar\'s tuition and school fees in an amount not exceeding FIVE THOUSAND PESOS (PHP 5,000.00), subject to the applicable program requirements.';
      const thirdParagraph = `Issued this ${formatCertificateDate()} for enrollment purposes.`;
      const firstLines = document.splitTextToSize(firstParagraph, contentWidth);
      document.text(firstLines, margin, 132, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.6 });
      const secondY = 132 + (firstLines.length * 7.2) + 8;
      const secondLines = document.splitTextToSize(secondParagraph, contentWidth);
      document.text(secondLines, margin, secondY, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.6 });
      const thirdY = secondY + (secondLines.length * 7.2) + 8;
      document.text(document.splitTextToSize(thirdParagraph, contentWidth), margin, thirdY, { lineHeightFactor: 1.6 });

      const signatureY = Math.max(thirdY + 45, 225);
      document.setFont('times', 'bold');
      document.text('CHRISTABELL ANGELICA R. ABAÑO, RN, MPA', pageWidth / 2, signatureY, { align: 'center' });
      document.setFont('times', 'normal');
      document.text('Community Affairs Officer IV', pageWidth / 2, signatureY + 7, { align: 'center' });

      document.setFontSize(8);
      document.setTextColor(90, 90, 90);
      document.text(`Control No.: ${selected.controlNumber || selected.scholarId || 'Not available'}`, margin, 310);
      document.text('Official PGCEAP private-scholar certification', pageWidth - margin, 310, { align: 'right' });
      document.save(`${reference}.pdf`);
      setCertificateNotice({ scholarId: selected.id, tone: 'success', title: 'Certificate downloaded', message: 'Print the PDF for CAO issuance to the scholar.' });
    } catch (error) {
      setCertificateNotice({ scholarId: selected.id, tone: 'error', title: 'Unable to download certificate', message: error.message || 'Please try downloading the certificate again.' });
    } finally {
      setCertificateDownloading(false);
    }
  };

  const paginationItems = [];
  let previousVisiblePage = 0;
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const visible = pageNumber === 1 || pageNumber === pageCount || Math.abs(pageNumber - currentPage) <= 1;
    if (visible) {
      if (pageNumber - previousVisiblePage > 1) paginationItems.push(`ellipsis-${pageNumber}`);
      paginationItems.push(pageNumber);
      previousVisiblePage = pageNumber;
    }
  }

  const metrics = [
    { label: 'Total Scholars', value: scholars.length, detail: 'Registered scholar accounts', tone: 'green', Icon: UsersRound },
    { label: 'Active Scholars', value: activeCount, detail: 'Currently active accounts', tone: 'blue', Icon: GraduationCap },
    { label: 'Documents Complete', value: completeCount, detail: 'Requirements cleared', tone: 'green', Icon: FileCheck2 },
    { label: 'For Review', value: reviewCount, detail: 'Document sets requiring review', tone: 'orange', Icon: BookOpenCheck },
  ];

  return <>
    <div className="scholars-management">
      <header className="scholars-admin-heading"><div><span className="scholars-admin-eyebrow">SCHOLAR RECORDS</span><h2>Scholars Management</h2><p>Manage scholar accounts, review documents, and track status updates.</p></div><button type="button" className="scholars-export" onClick={() => setExportOpen(true)} disabled={!filtered.length}><Download size={15} />Export CSV</button></header>

      <nav className="examination-workspace-tabs scholars-section-tabs" aria-label="Scholars sections"><button type="button" aria-pressed={sectionTab === 'directory'} className={sectionTab === 'directory' ? 'active' : ''} onClick={() => setSectionTab('directory')}>Scholar</button><button type="button" aria-pressed={sectionTab === 'continuing'} className={sectionTab === 'continuing' ? 'active' : ''} onClick={() => setSectionTab('continuing')}>Continuing Requirements</button></nav>
      {sectionTab === 'continuing' ? <ContinuingRequirementsSettings token={token} periods={academicPeriods} scholars={scholars} canEdit={canUploadScholarRequirements} onPeriodChange={async (periodId) => { setSchedulePeriodId(periodId); await loadScholars({ academicPeriodId: periodId }); }} /> : <>
      <div className="scholars-admin-metrics">{metrics.map(({ label, value, detail, tone, Icon }) => <article className={tone} key={label}><div><span>{label}</span><strong>{loading || (loadError && !scholars.length) ? '—' : value}</strong><small>{detail}</small></div><i><Icon size={20} /></i></article>)}</div>

      {loadError && <div className="scholars-admin-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => loadScholars({ showLoader: true })}>Retry</button></div>}

      <section className="scholars-filter-panel">
        <div className="scholars-panel-heading"><div><span className="scholars-filter-icon"><Filter size={15} /></span><div><h3>Filter Scholars</h3><p>Refine the scholar directory by location, school, or document status.</p></div></div>{hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="scholars-filters">
          <label className="scholars-filter scholars-search"><span>Search scholars</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email, or control number" /></div></label>
          <label className="scholars-filter"><span>Municipality</span><select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setSchool('All Schools'); setBarangay('All Barangays'); setPage(1); }}><option>All Municipalities</option>{municipalities.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>School</span><select value={school} onChange={(event) => { setSchool(event.target.value); setBarangay('All Barangays'); setPage(1); }}><option>All Schools</option>{schools.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>Barangay</span><select value={barangay} onChange={(event) => { setBarangay(event.target.value); setPage(1); }}><option>All Barangays</option>{barangays.map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="scholars-filter"><span>Documents</span><select value={documentStatus} onChange={(event) => { setDocumentStatus(event.target.value); setPage(1); }}><option>All Documents</option><option>Complete</option><option>Review</option></select></label>
        </div>
      </section>

      <div className="scholars-record-count">Showing <strong>{filtered.length}</strong> of <strong>{scholars.length}</strong> scholars</div>
      <section className="scholars-table-card">
        <div className="scholars-table-head"><span>Scholar name</span><span>Control number</span><span>Municipality</span><span>School</span><span>Barangay</span><span>Status</span><span>Documents</span><span>Action</span></div>
        <div className="scholars-table-body">
          {loading && !scholars.length && <div className="scholars-state"><span className="scholars-spinner" />Loading scholar records...</div>}
          {!loading && !loadError && !paginated.length && <div className="scholars-state"><Search size={23} /><strong>No scholars found</strong><span>Adjust the current filters to see more scholar records.</span>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</div>}
          {paginated.map((scholar) => <article className="scholars-row" key={scholar.id}>
            <div data-label="Scholar"><span className="scholars-avatar">{scholar.initials}</span><span className="scholars-name"><strong>{scholar.name}</strong><small>{scholar.email}</small></span></div>
            <div data-label="Control number"><code>{scholar.controlNumber || scholar.scholarId}</code></div>
            <div data-label="Municipality"><span>{scholar.municipality}</span></div>
            <div data-label="School"><span className="scholars-school-name" title={scholar.school}>{scholar.school}</span></div>
            <div data-label="Barangay"><span>{scholar.barangay}</span></div>
            <div data-label="Status"><ScholarBadge value={scholar.status} type="status" /></div>
            <div data-label="Documents"><ScholarBadge value={scholar.documentStatus} type="documents" /></div>
            <div data-label="Action"><button type="button" className="scholars-view" aria-label={`View details for ${scholar.name}`} onClick={() => { setSelected(scholar); setDrawerTab('overview'); setDocumentNotice(''); setCertificateNotice(null); }}><Eye size={13} />View details</button></div>
          </article>)}
        </div>
        {!!filtered.length && <footer className="scholars-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}</span><nav className="scholars-pagination" aria-label="Scholar pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>{paginationItems.map((item) => typeof item === 'number' ? <button type="button" key={item} aria-label={`Page ${item}`} className={item === currentPage ? 'active' : ''} aria-current={item === currentPage ? 'page' : undefined} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}<button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></nav></footer>}
      </section>
      </>}
    </div>
    {exportOpen && <CsvExportModal title="Export scholar records" description="Choose which scholar fields to include. The current directory filters will be preserved." columns={scholarExportColumns} rowCount={filtered.length} onClose={() => setExportOpen(false)} onExport={(columns) => downloadCsv({ filename: `scholars-${new Date().toISOString().slice(0, 10)}.csv`, rows: buildRecordRows(filtered, columns) })} />}

    {selected && (
      <div className="scholars-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <aside className="scholars-drawer" role="dialog" aria-modal="true" aria-labelledby="scholar-detail-title">
          <button type="button" className="scholars-drawer-close" onClick={() => setSelected(null)} aria-label="Close scholar details"><X size={19} /></button>
          <div className="scholars-drawer-profile"><span className="scholars-drawer-avatar">{selected.initials}</span><div><span className="scholars-admin-eyebrow">SCHOLAR RECORD</span><h3 id="scholar-detail-title">{selected.name}</h3><p>{selected.scholarId}</p></div></div>
          <div className="scholars-drawer-badges"><ScholarBadge value={selected.status} type="status" /><ScholarBadge value={selected.documentStatus} type="documents" />{String(selected.schoolType || '').toLowerCase() === 'private' && <button type="button" className="scholars-certification-download" onClick={downloadPrivateCertificate} disabled={certificateDownloading} title="Download individual certification"><Download size={15} />{certificateDownloading ? 'Preparing PDF…' : 'Download Certification'}</button>}</div>
          {certificateNotice?.scholarId === selected.id && <div className={`scholars-certificate-notice ${certificateNotice.tone}`} role={certificateNotice.tone === 'error' ? 'alert' : 'status'} aria-atomic="true">
            <span className="scholars-certificate-notice-icon" aria-hidden="true">{certificateNotice.tone === 'error' ? <TriangleAlert size={18} /> : <BadgeCheck size={18} />}</span>
            <div className="scholars-certificate-notice-copy"><strong>{certificateNotice.title}</strong><p>{certificateNotice.message}</p></div>
            <button type="button" className="scholars-certificate-notice-dismiss" aria-label="Dismiss certificate notification" onClick={() => setCertificateNotice(null)}><X size={16} aria-hidden="true" /></button>
          </div>}

          <nav className="scholars-drawer-tabs" role="tablist" aria-label="Scholar record sections">
            <button type="button" role="tab" aria-selected={drawerTab === 'overview'} className={drawerTab === 'overview' ? 'active' : ''} onClick={() => setDrawerTab('overview')}><GraduationCap size={15} />Overview</button>
            <button type="button" role="tab" aria-selected={drawerTab === 'finance'} className={drawerTab === 'finance' ? 'active' : ''} onClick={openBillingTab}><CircleDollarSign size={15} />Billing &amp; Payroll</button>
            <button type="button" role="tab" aria-selected={drawerTab === 'certification-history'} className={drawerTab === 'certification-history' ? 'active' : ''} onClick={() => setDrawerTab('certification-history')}><History size={15} />Certification History</button>
          </nav>

          {drawerTab === 'overview' ? (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-detail-section"><h4>Scholar information</h4><dl><div><dt>Email address</dt><dd>{selected.email || 'Not provided'}</dd></div><div><dt>School year</dt><dd>{selected.schoolYear || '2026-2027'}</dd></div><div><dt>Issued</dt><dd>{formatScholarDate(selected.issuedAt)}</dd></div></dl></section>
              <section className="scholars-detail-section"><h4>Education and location</h4><dl><div><dt>School</dt><dd>{selected.school}</dd></div><div><dt>Course</dt><dd>{selected.course || 'Not specified'}</dd></div><div><dt>Year level</dt><dd>{selected.yearLevel || 'Not specified'}</dd></div><div><dt>Municipality</dt><dd>{selected.municipality}</dd></div><div><dt>Barangay</dt><dd>{selected.barangay}</dd></div></dl></section>

              {canUploadScholarRequirements && <InitialRequirementCapture key={`${selected.applicantId}:${selected.academicPeriodId}`} scholar={selected} token={token} onSaved={() => loadScholars({ academicPeriodId: selected.academicPeriodId })} />}
              <section className="scholars-detail-section"><h4>Document submissions · {selected.schoolYear} · {selected.semester}</h4>{documentNotice && <Notification tone={documentNoticeTone} title="Document review update" onDismiss={() => setDocumentNotice('')}>{documentNotice}</Notification>}<div className="scholars-document-list">{[...(selected.initialDocuments || selected.documents).map((document) => ({ ...document, submissionWave: 'initial' })), ...(selected.continuingOpen ? selected.continuingDocuments || [] : []).map((document) => ({ ...document, submissionWave: 'continuing' }))].map((document) => {
                const isReviewable = canReviewDocuments && document.submitted && document.fileName && document.applicationId && document.requirementKey;
                return <div key={`${document.submissionWave}:${document.label}`} className="scholars-document-entry">
                  <span>{document.label}<small>{<>{document.submissionWave === 'initial' ? document.legacy ? 'Initial · Previously recorded' : 'Initial · CAO upload' : 'Continuing · Scholar upload'}{document.submitted ? ' · Attached' : ''}</>}</small></span>
                  <div className="scholars-document-actions">
                    <strong className={document.submitted ? document.status.toLowerCase() : 'not-submitted'}>{document.submitted ? document.status : 'Not submitted'}</strong>
                    {isReviewable && <button type="button" className="scholars-document-view" onClick={() => openDocumentReview(document)} aria-label={`View and review ${document.label}`}><Eye size={12} />View</button>}
                    {!isReviewable && canViewScholarDocuments && document.submitted && document.fileName && document.applicationId && <button type="button" className="scholars-document-view" onClick={() => openScholarDocument(document)} disabled={Boolean(openingRequirement)} aria-label={`View ${document.label}`}><Eye size={12} />{openingRequirement === document.requirementKey ? 'Opening…' : 'View'}</button>}

                  </div>
                </div>;
              })}</div></section>
              <section className="scholars-detail-section"><h4>Continuing submission</h4><p>{selected.continuingSubmission?.state === 'waiting_initial' ? 'Waiting for approval of all initial requirements.' : selected.continuingSubmission?.isOpen ? 'Continuing uploads are open for this academic period.' : 'Uploads closed. Admin can reopen them in Continuing Requirements.'}</p></section>
              {selected.documentHistory?.length > 0 && <section className="scholars-detail-section"><h4>Previous document versions</h4>{selected.documentHistory.map((document) => <div className="scholars-document-entry" key={`${document.academicPeriodId}:${document.submissionWave}:${document.versionId}`}><span>{document.fileName}<small>{document.submissionWave} · {document.periodLabel || "Earlier submission"} · {document.status}</small></span><button type="button" className="scholars-document-view" onClick={() => openScholarDocument(document)}>View previous file</button></div>)}</section>}
              {selected.notes && <section className="scholars-detail-section"><h4>Account notes</h4><p className="scholars-notes">{selected.notes}</p></section>}
            </div>
          ) : drawerTab === 'finance' ? (
            <div className="scholars-drawer-tab-panel" role="tabpanel">
              <section className="scholars-detail-section scholars-finance-details">
                <header className="scholars-billing-form-heading">
                  <i><ReceiptText size={17} /></i>
                  <div><span>{selected.processRoute === 'payroll' ? 'PAYROLL PREPARATION' : 'BILLING PREPARATION'}</span><h4>Set up processing session</h4><p>Select the academic period before preparing the official list.</p></div>
                </header>
                <form id="scholar-processing-session" className="scholars-billing-edit-form" onSubmit={saveBillingMetadata}>
                  <div className="scholars-billing-fields">
                    <label><span>School year</span><select aria-label="School year" value={billingForm.schoolYear} disabled={!canEditBilling || billingPeriodLoading || billingSaving || grantBusy} onChange={(event) => { const schoolYear = event.target.value; const matchingPeriods = activeBillingPeriods.filter((period) => period.schoolYear === schoolYear); const nextPeriod = matchingPeriods.find((period) => period.semester === billingForm.semester) || matchingPeriods[0]; selectBillingPeriod(nextPeriod); }}><option value="">School Year</option>{billingSchoolYears.map((schoolYear) => <option key={schoolYear}>{schoolYear}</option>)}</select></label>
                    <label><span>Semester</span><select aria-label="Semester" value={billingForm.semester} disabled={!canEditBilling || billingPeriodLoading || billingSaving || grantBusy || !billingForm.schoolYear} onChange={(event) => selectBillingPeriod(activeBillingPeriods.find((period) => period.schoolYear === billingForm.schoolYear && period.semester === event.target.value))}><option value="">Semester</option>{billingSemesters.map((semester) => <option key={semester}>{semester}</option>)}</select></label>
                    {selected.processRoute === 'billing' && <label><span>Billing reference</span><input aria-label="Billing reference" value={selected.billingReference || ''} placeholder="Generated after processing" readOnly aria-readonly="true" /><small>Assigned automatically by Process Billing.</small></label>}
                    <div className="scholars-processing-status-field">
                      <span>{selected.processRoute === 'payroll' ? 'Payroll-list status' : 'Billing status'}</span>
                      <div role="status" aria-live="polite" aria-busy={billingPeriodLoading}>
                        <strong className={`scholars-processing-status-badge${(selected.processRoute === 'payroll' ? selected.inPayroll : selected.billed) ? ' is-listed' : ''}`}>
                          {billingPeriodLoading ? 'Loading status…' : selected.processRoute === 'payroll' ? (selected.inPayroll ? 'Included in payroll list' : 'Not listed yet') : selected.billed ? 'Billed' : 'Not billed yet'}
                        </strong>
                      </div>
                      <small>Updates automatically when the official list is generated.</small>
                    </div>
                  </div>
                  {billingEditError && <Notification tone="error" title="Unable to prepare this period">{billingEditError}</Notification>}
                </form>
                {grantNotice && <Notification tone="success" title="Grant record saved" onDismiss={() => setGrantNotice('')}>{grantNotice}</Notification>}
                {selected.schoolType === 'Private' && <div className="scholars-grant-preparation">
                  {billingPeriodLoading ? <Notification tone="progress" title="Loading grant record">Please wait while this period’s record is loaded.</Notification> : selected.billed || selected.inPayroll ? <div className="scholars-grant-breakdown"><h4>Listed grant record</h4><p>This period’s record is locked after list generation.</p><dl><div><dt>Total Grant</dt><dd>PHP 5,000.00</dd></div><div><dt>Tuition Fee Assistance</dt><dd>{selected.tuitionFeeAssistance == null ? 'Not recorded' : `PHP ${Number(selected.tuitionFeeAssistance).toFixed(2)}`}</dd></div><div><dt>Allowance</dt><dd>{selected.allowance == null ? 'Not recorded' : `PHP ${Number(selected.allowance).toFixed(2)}`}</dd></div></dl></div> : canEditBilling ? <PrivateGrantEditor key={`${selected.applicantId}:${selected.academicPeriodId}:${selected.grantPreparedAt || 'new'}`} record={selected} period={{ id: selected.academicPeriodId, schoolYear: billingForm.schoolYear, semester: billingForm.semester }} token={token} onContinue={selected.processRoute === 'billing' ? () => saveBillingMetadata(null, { grantSaved: true }) : undefined} onBusyChange={setGrantBusy} onSaved={async (message) => { await loadScholars({ academicPeriodId: selected.academicPeriodId }); setGrantNotice(message); }} /> : <p>Grant preparation requires access to this Scholar’s processing section.</p>}
                </div>}

                  {canEditBilling && !selected.billed && !selected.inPayroll && !(selected.schoolType === 'Private' && selected.processRoute === 'billing') && <div className="scholars-processing-actions"><button type="submit" form="scholar-processing-session" disabled={grantBusy || billingSaving || billingPeriodLoading || !billingForm.schoolYear || !billingForm.semester || (selected.schoolType === 'Private' && !selected.grantPrepared)}><Save size={12} />{billingSaving ? 'Preparing…' : selected.processRoute === 'payroll' ? 'Prepare & open Payroll' : 'Add to billing'}</button></div>}

              </section>
              <section className="scholars-finance-summary">
                <article className={selected.billed ? 'complete' : 'pending'}><i><ReceiptText size={19} /></i><div><span>Billing status</span><strong>{['Ready for billing', 'On hold'].includes(selected.billingStatus) ? 'Not billed yet' : selected.billingStatus || (selected.billed ? 'Billed' : 'Not billed yet')}</strong><small>{selected.billed ? 'Included in a billing record' : 'Waiting for billing processing'}</small></div></article>
                <article className={selected.inPayroll ? 'complete' : 'pending'}><i><CircleDollarSign size={19} /></i><div><span>Payroll status</span><strong>{selected.payrollStatus || (selected.inPayroll ? 'Included in payroll list' : 'Not included yet')}</strong><small>{selected.processRoute !== 'payroll' ? 'Private scholars use the certification list' : selected.inPayroll ? 'Included in the official payroll list' : 'Ready for payroll-list preparation'}</small></div></article>
              </section>
              {(selected.billed || selected.inPayroll) && <section className="scholars-new-cycle-guidance"><CalendarRange size={18} /><div><strong>Need another processing cycle?</strong><span>The completed {selected.billingSchoolYearSemester || selected.schoolYearSemester} session remains locked. Select another active School Year and Semester above to prepare a fresh session with no reference.</span>{activeBillingPeriods.length <= 1 && (canOpenSettings ? <button type="button" onClick={openNewCycleSetup}>Set up the next academic period</button> : <small>Ask an administrator with Settings access to activate the next academic period.</small>)}</div></section>}
              {!!selected.financialHistory?.filter((record) => !record.isActivePeriod).length && <section className="scholars-detail-section"><h4>Previous period history</h4><div className="scholars-finance-history">{selected.financialHistory.filter((record) => !record.isActivePeriod).map((record) => <article key={`${record.academicPeriodId}-${record.dateProcessed}`}><div><strong>{record.schoolYear} · {record.semester}</strong><span>{record.billingStatus} · {record.payrollStatus}</span></div><div><strong>{record.payReference || 'No payroll-list reference'}</strong><span>{record.dateProcessed ? formatScholarDate(record.dateProcessed) : 'Not processed'}</span></div></article>)}</div></section>}
              <div className="scholars-finance-note"><CircleDollarSign size={17} /><div><strong>Live processing status</strong><span>This information follows the scholar’s current Billing and Payroll records and refreshes automatically.</span></div></div>
            </div>
          ) : (
            <div className="scholars-drawer-tab-panel scholars-certification-history-panel" role="tabpanel">
              <header className="scholars-certification-history-heading">
                <i><History size={18} /></i>
                <div><span>PRIVATE-SCHOOL RECORDS</span><h4>Certification History</h4><p>Generated tuition-certification list records associated with this scholar.</p></div>
              </header>
              {String(selected.schoolType || '').toLowerCase() !== 'private' ? (
                <div className="scholars-certification-history-empty"><CircleDollarSign size={24} /><strong>No certification workflow</strong><p>Public-school scholars are recorded in the official Payroll list rather than a Private tuition-certification list.</p></div>
              ) : certificationHistory.length ? (
                <div className="scholars-certification-history-list">
                  {certificationHistory.map((record, index) => <article key={`${record.billingReference || record.academicPeriodId || 'certification'}-${record.dateProcessed || index}`}>
                    <header><div><span>{record.schoolYear} · {record.semester}</span><strong>{record.billingStatus || 'Certification listed'}</strong></div>{record.isActivePeriod && <em>Current period</em>}</header>
                    <dl>
                      <div><dt>Reference number</dt><dd>{record.billingReference || 'Not recorded'}</dd></div>
                      <div><dt>Amount</dt><dd>{formatScholarAmount(record.claimAmount)}</dd></div>
                      <div><dt>Processed</dt><dd>{record.dateProcessed ? formatScholarDate(record.dateProcessed) : 'Not recorded'}</dd></div>
                    </dl>
                  </article>)}
                </div>
              ) : (
                <div className="scholars-certification-history-empty"><History size={24} /><strong>No certification records yet</strong><p>This Private scholar will appear here after inclusion in a generated Billing certification list.</p></div>
              )}
            </div>
          )}
        </aside>
      </div>
    )}
    {documentReview && <ReviewModal review={documentReview} preview={documentPreview} previewLoading={documentPreviewLoading} previewError={documentPreviewError} onClose={closeDocumentReview} onDecision={setDocumentDecision} />}
    {documentReview && documentDecision && <DecisionModal review={documentReview} decision={documentDecision} saving={documentSaving} error={documentDecisionError} onClose={() => { if (!documentSaving) { setDocumentDecision(''); setDocumentDecisionError(''); } }} onConfirm={saveDocumentDecision} />}
  </>;
}

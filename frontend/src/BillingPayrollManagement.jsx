import { matchesPayrollListStatus } from './utils/payrollListStatus';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Filter,
  ReceiptText,
  Search,
  TriangleAlert,
  UsersRound,
  X,
} from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import ScholarSchoolIdentity from './components/ScholarSchoolIdentity';
import RequirementsWarning from './components/RequirementsWarning';
import { clearProcessingHandoff, readProcessingHandoff } from './utils/processingHandoff';
import { canQueueForProcessing, isVisibleInProcessingMode } from './utils/processingVisibility';
import { ROUTINE_DATA_REFRESH_MS, subscribeToVisibleRefresh } from './utils/dataRefresh';

const formatDate = (value) => {
  if (!value) return 'Not processed';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not processed' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatAmount = (value) => value === null || value === undefined
  ? 'Not assigned'
  : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);

const billingExportColumns = [
  { key: 'name', label: 'Scholar Name', group: 'Scholar' },
  { key: 'controlNumber', label: 'Control Number', group: 'Scholar' },
  { key: 'email', label: 'Email', group: 'Scholar' },
  { key: 'status', label: 'Scholar Status', group: 'Scholar' },
  { key: 'billingStatus', label: 'Certification List Status', group: 'Billing & payroll' },
  { key: 'billingReference', label: 'Billing Reference', group: 'Billing & payroll' },
  { key: 'payReference', label: 'Payroll Reference', group: 'Billing & payroll' },
  { key: 'payrollStatus', label: 'Payroll List Status', group: 'Billing & payroll' },
  { key: 'preparationStatus', label: 'Preparation Status', group: 'Grant preparation' },
  { key: 'totalGrant', label: 'Total Grant', group: 'Grant preparation' },
  { key: 'tuitionFeeAssistance', label: 'Tuition Fee Assistance', group: 'Grant preparation' },
  { key: 'allowance', label: 'Allowance', group: 'Grant preparation' },
  { key: 'claimAmount', label: 'Amount', group: 'Billing & payroll', value: (record) => formatAmount(record.claimAmount) },
  { key: 'schoolYearSemester', label: 'School Year / Semester', group: 'Academic' },
  { key: 'school', label: 'School', group: 'Academic' },
  { key: 'schoolType', label: 'School Type', group: 'Academic', value: (record) => record.schoolType || 'Public' },
  { key: 'dateProcessed', label: 'Date Processed', group: 'Processing', value: (record) => formatDate(record.dateProcessed) },
];

const certificationTemplateColumns = [
  { key: 'sequence', label: 'No.', width: 7, value: (_record, index) => index + 1 },
  { key: 'controlNumber', label: 'Control Number', width: 18 },
  { key: 'name', label: 'Private Scholar Name', width: 32 },
  { key: 'school', label: 'School', width: 36 },
  { key: 'municipality', label: 'Municipality', width: 18 },
  { key: 'course', label: 'Course / Program', width: 28 },
  { key: 'yearLevel', label: 'Year Level', width: 14 },
  { key: 'totalGrant', label: 'Total Grant (PHP)', width: 20, currency: true, value: record => Number(record.claimAmount || record.billingAmount || 5000) },
  { key: 'tuitionFeeAssistance', label: 'Tuition Fee Assistance (PHP)', width: 22, currency: true },
  { key: 'allowance', label: 'Allowance (PHP)', width: 18, currency: true },
  { key: 'referenceNumber', label: 'Reference Number', width: 25, value: (_record, _index, batch) => batch?.batchNumber || batch?.billingReference || '' },
].map(column => ({ ...column, group: 'Billing template' }));
const configurableBillingColumns = [
  ...certificationTemplateColumns,
  ...billingExportColumns.filter(column => !certificationTemplateColumns.some(template => template.key === column.key) && !['claimAmount', 'billingReference'].includes(column.key)).map(column => ({ ...column, width: 24, defaultSelected: false })),
];

const payrollTemplateColumns = [
  { key: 'sequence', label: 'No.', width: 7, value: (_record, index) => index + 1 },
  { key: 'controlNumber', label: 'Control Number', width: 18 },
  { key: 'name', label: 'Scholar Name', width: 32 },
  { key: 'school', label: 'School', width: 36 },
  { key: 'schoolType', label: 'School Type', width: 14 },
  { key: 'municipality', label: 'Municipality', width: 18 },
  { key: 'totalGrant', label: 'Total Grant (PHP)', width: 18, currency: true, value: record => Number(record.claimAmount || 0) },
  { key: 'tuitionFeeAssistance', label: 'Tuition Fee Assistance (PHP)', width: 22, currency: true },
  { key: 'allowance', label: 'Allowance (PHP)', width: 18, currency: true },
  { key: 'referenceNumber', label: 'Reference Number', width: 25, value: (_record, _index, batch) => batch?.batchNumber || '' },
  { key: 'signature', label: 'Signature', width: 28, value: () => '' },
].map(column => ({ ...column, group: 'Payroll template' }));
const configurablePayrollColumns = [
  ...payrollTemplateColumns,
  ...billingExportColumns.filter(column => !payrollTemplateColumns.some(template => template.key === column.key) && !['claimAmount', 'payReference'].includes(column.key)).map(column => ({ ...column, width: 24, defaultSelected: false })),
];

const downloadPayrollWorkbook = async ({ records, batch, activePeriod, preparationCopy = false, selectedColumns = payrollTemplateColumns }) => {
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Excel workbook support could not be loaded.');
  const workbook = new Workbook();
  workbook.creator = 'PGCEAP Scholarship Management System';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Official Payroll List', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  if (!selectedColumns.length) throw new Error('Select at least one export column.');
  const lastColumn = sheet.getColumn(selectedColumns.length).letter;
  if (selectedColumns.length > 1) sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell('A1').value = preparationCopy ? 'PGCEAP PAYROLL LIST - PREPARATION COPY' : 'PGCEAP OFFICIAL PAYROLL LIST';
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF176B3A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  if (selectedColumns.length > 1) sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell('A2').value = `${activePeriod?.schoolYear || ''} · ${activePeriod?.semester || ''} · ${batch?.batchNumber || ''}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.addRow([]);
  const header = sheet.addRow(selectedColumns.map(column => column.label));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B3A' } };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  records.forEach((record, index) => {
    sheet.addRow(selectedColumns.map(column => column.value ? column.value(record, index, batch) : record[column.key] ?? ''));
  });
  const totalIndex = selectedColumns.findIndex(column => column.key === 'totalGrant');
  if (totalIndex >= 0) {
    const values = Array(selectedColumns.length).fill('');
    values[totalIndex] = records.reduce((sum, record) => sum + Number(record.claimAmount || 0), 0);
    if (selectedColumns.length > 1) values[totalIndex > 0 ? totalIndex - 1 : 1] = 'TOTAL';
    sheet.addRow(values).font = { bold: true };
  }
  selectedColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width || 24;
    if (column.currency) sheet.getColumn(index + 1).numFmt = '₱#,##0.00';
  });
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(preparationCopy ? `payroll-preparation-${new Date().toISOString().slice(0, 10)}` : batch?.batchNumber || 'payroll-list').replace(/[^a-z0-9_-]+/gi, '-')}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadCertificationWorkbook = async ({ records, batch, activePeriod, preparationCopy = false, selectedColumns = certificationTemplateColumns }) => {
  const ExcelJS = await import('exceljs');
  const Workbook = ExcelJS.Workbook || ExcelJS.default?.Workbook;
  if (!Workbook) throw new Error('Excel workbook support could not be loaded.');
  const workbook = new Workbook();
  workbook.creator = 'PGCEAP Scholarship Management System';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Tuition Certification List', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  if (!selectedColumns.length) throw new Error('Select at least one export column.');
  const lastColumn = sheet.getColumn(selectedColumns.length).letter;
  if (selectedColumns.length > 1) sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getCell('A1').value = preparationCopy ? 'PGCEAP PRIVATE-SCHOLAR CERTIFICATION LIST - PREPARATION COPY' : 'PGCEAP PRIVATE-SCHOLAR TUITION CERTIFICATION LIST';
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF176B3A' } };
  sheet.getCell('A1').alignment = { horizontal: 'center' };
  if (selectedColumns.length > 1) sheet.mergeCells(`A2:${lastColumn}2`);
  sheet.getCell('A2').value = `${activePeriod?.schoolYear || ''} · ${activePeriod?.semester || ''} · ${batch?.batchNumber || batch?.billingReference || ''}`;
  sheet.getCell('A2').alignment = { horizontal: 'center' };
  sheet.addRow([]);
  const header = sheet.addRow(selectedColumns.map(column => column.label));
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF176B3A' } };
  header.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  records.forEach((record, index) => {
    sheet.addRow(selectedColumns.map(column => column.value ? column.value(record, index, batch) : record[column.key] ?? ''));
  });
  const totalIndex = selectedColumns.findIndex(column => column.key === 'totalGrant');
  if (totalIndex >= 0) {
    const values = Array(selectedColumns.length).fill('');
    values[totalIndex] = records.reduce((sum, record) => sum + Number(record.claimAmount || record.billingAmount || 5000), 0);
    if (selectedColumns.length > 1) values[totalIndex > 0 ? totalIndex - 1 : 1] = 'TOTAL';
    sheet.addRow(values).font = { bold: true };
  }
  selectedColumns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width || 24;
    if (column.currency) sheet.getColumn(index + 1).numFmt = '₱#,##0.00';
  });
  sheet.views = [{ state: 'frozen', ySplit: 4 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${String(preparationCopy ? `billing-preparation-${new Date().toISOString().slice(0, 10)}` : batch?.batchNumber || batch?.billingReference || 'private-certification-list').replace(/[^a-z0-9_-]+/gi, '-')}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const matchesDateRange = (value, from, to) => {
  if (!from && !to) return true;
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  if (from && date < new Date(`${from}T00:00:00`)) return false;
  if (to && date > new Date(`${to}T23:59:59.999`)) return false;
  return true;
};

export default function BillingPayrollManagement({ token, mode = 'billing' }) {
  const isPayroll = mode === 'payroll';
  const [initialHandoff] = useState(() => readProcessingHandoff(mode));
  const defaultBilledFilter = isPayroll ? 'All Billing Statuses' : 'Not billed yet';
  const defaultPayrollListFilter = isPayroll ? 'Not included yet' : 'All Payroll Statuses';
  const [records, setRecords] = useState([]);
  const [activePeriods, setActivePeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState(() => initialHandoff ? String(initialHandoff.periodId) : '');
  const [handoffApplicantId, setHandoffApplicantId] = useState(() => initialHandoff?.applicantId || null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [, setPage] = useState(1);
  const [queuedIds, setQueuedIds] = useState([]);
  const [sourceSelection, setSourceSelection] = useState([]);
  const [queueSelection, setQueueSelection] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [operationNotice, setOperationNotice] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportingWorkbook, setExportingWorkbook] = useState(false);
  const [routingApplicant, setRoutingApplicant] = useState(null);
  const [query, setQuery] = useState('');
  const [scholarStatus, setScholarStatus] = useState('All Scholar Statuses');
  const [billed, setBilled] = useState(defaultBilledFilter);
  const [billingReference, setBillingReference] = useState('All Billing References');
  const [payReference, setPayReference] = useState('All Payroll References');
  const [payrollListStatus, setPayrollListStatus] = useState(defaultPayrollListFilter);
  const [schoolYearSem, setSchoolYearSem] = useState('All School Years / Semesters');
  const [school, setSchool] = useState('All Schools');
  const [schoolType, setSchoolType] = useState('All School Types');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const loadRecords = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const periodQuery = selectedPeriodId ? `?academicPeriodId=${encodeURIComponent(selectedPeriodId)}` : '';
      const response = await fetch(`${API_BASE}/scholars/management${periodQuery}`, { headers: authHeaders(token), cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to load billing and payroll records.');
      const currentRecords = (body.scholars || []).map((record) => ({ ...record, isArchivedPeriod: false }));
      const archivedRecords = (body.scholars || []).flatMap((record) => (record.financialHistory || [])
        .filter((history) => !history.isActivePeriod)
        .map((history) => ({
          ...record,
          ...history,
          id: `${record.id}-period-${history.academicPeriodId || history.dateProcessed || 'legacy'}`,
          billed: true,
          schoolYearSemester: `${history.schoolYear} · ${history.semester}`,
          isArchivedPeriod: true,
        })));
      setRecords([...currentRecords, ...archivedRecords]);
      setActivePeriods(body.activePeriods || (body.activePeriod ? [body.activePeriod] : []));
      setSelectedPeriodId((current) => current || String(body.activePeriod?.id || ''));
      if (handoffApplicantId) {
        const preparedScholar = currentRecords.find((record) => record.applicantId === handoffApplicantId);
        if (preparedScholar) {
          setQuery((current) => current || preparedScholar.controlNumber || preparedScholar.email || preparedScholar.name);
          setOperationNotice({ tone: 'success', text: `${preparedScholar.name} is loaded in the prepared ${body.activePeriod?.schoolYear || ''} ${body.activePeriod?.semester || ''} session.`.replace(/\s+/g, ' ').trim() });
        } else {
          setOperationNotice({ tone: 'error', text: 'The prepared scholar could not be found in this processing period.' });
        }
        clearProcessingHandoff();
        setHandoffApplicantId(null);
      }
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof TypeError ? 'Unable to reach the server. Retrying automatically…' : error.message || 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [handoffApplicantId, selectedPeriodId, token]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => loadRecords({ showLoader: true }), 0);
    const stopRefreshing = subscribeToVisibleRefresh(loadRecords, { intervalMs: ROUTINE_DATA_REFRESH_MS });
    return () => { window.clearTimeout(initialLoad); stopRefreshing(); };
  }, [loadRecords]);

  const scholarStatuses = useMemo(() => [...new Set(records.map(({ status }) => status).filter(Boolean))].sort(), [records]);
  const billingReferences = useMemo(() => [...new Set(records.map((item) => item.billingReference).filter(Boolean))].sort(), [records]);
  const payReferences = useMemo(() => [...new Set(records.map((item) => item.payReference).filter(Boolean))].sort(), [records]);
  const schoolYearSemesters = useMemo(() => [...new Set(records.map((item) => item.schoolYearSemester).filter(Boolean))].sort(), [records]);
  const schools = useMemo(() => [...new Set(records.map((item) => item.school).filter(Boolean))].sort(), [records]);
  const schoolTypes = useMemo(() => [...new Set(records.map((item) => item.schoolType || 'Public'))].sort(), [records]);

  const filtered = useMemo(() => records.filter((record) => {
    const search = `${record.name} ${record.controlNumber || ''} ${record.email || ''}`.toLowerCase();
    const normalizedSchoolType = record.schoolType || 'Public';
    const matchesBillingReference = billingReference === 'All Billing References'
      || (billingReference === 'No billing reference' ? !record.billingReference : record.billingReference === billingReference);
    const matchesReference = payReference === 'All Payroll References'
      || (payReference === 'No payroll reference' ? !record.payReference : record.payReference === payReference);
    return search.includes(query.trim().toLowerCase())
      && (scholarStatus === 'All Scholar Statuses' || record.status === scholarStatus)
      && (billed === 'All Billing Statuses' || (billed === 'Billed' ? record.billed : !record.billed))
      && matchesBillingReference
      && matchesReference
      && matchesPayrollListStatus(record, payrollListStatus)
      && ((isPayroll && payrollListStatus === 'Not included yet' && record.notYetIncluded === true) || isVisibleInProcessingMode(record, isPayroll ? 'payroll' : 'billing'))
      && (schoolYearSem === 'All School Years / Semesters' || record.schoolYearSemester === schoolYearSem)
      && (school === 'All Schools' || record.school === school)
      && (schoolType === 'All School Types' || normalizedSchoolType === schoolType)
      && matchesDateRange(record.dateProcessed, dateFrom, dateTo);
  }), [records, query, scholarStatus, billed, billingReference, payReference, payrollListStatus, schoolYearSem, school, schoolType, dateFrom, dateTo, isPayroll]);

  const hasFilters = Boolean(query || dateFrom || dateTo
    || scholarStatus !== 'All Scholar Statuses'
    || billed !== defaultBilledFilter
    || billingReference !== 'All Billing References'
    || payReference !== 'All Payroll References'
    || payrollListStatus !== defaultPayrollListFilter
    || schoolYearSem !== 'All School Years / Semesters'
    || school !== 'All Schools'
    || schoolType !== 'All School Types');

  const clearFilters = () => {
    setQuery(''); setScholarStatus('All Scholar Statuses'); setBilled(defaultBilledFilter);
    setBillingReference('All Billing References'); setPayReference('All Payroll References'); setPayrollListStatus(defaultPayrollListFilter);
    setSchoolYearSem('All School Years / Semesters'); setSchool('All Schools');
    setSchoolType('All School Types'); setDateFrom(''); setDateTo(''); setPage(1);
  };

  const currentRecords = useMemo(() => records.filter((record) => !record.isArchivedPeriod), [records]);
  const visibleRecords = useMemo(() => filtered.filter((record) => !record.isArchivedPeriod), [filtered]);
  const queuedRecords = useMemo(() => records.filter((record) => queuedIds.includes(record.applicantId)
    && canQueueForProcessing(record, isPayroll ? 'payroll' : 'billing')), [records, queuedIds, isPayroll]);
  const sourceRecords = useMemo(() => visibleRecords.filter((record) => !queuedIds.includes(record.applicantId)), [visibleRecords, queuedIds]);
  const movableSourceRecords = useMemo(() => sourceRecords.filter((record) => canQueueForProcessing(record, isPayroll ? 'payroll' : 'billing')), [sourceRecords, isPayroll]);
  const selectedMovableIds = sourceSelection.filter((id) => movableSourceRecords.some((record) => record.applicantId === id));
  const queuedTotalAmount = queuedRecords.reduce((sum, record) => sum + Number(record.claimAmount || 0), 0);
  const routedRecords = currentRecords.filter((item) => item.processRoute === (isPayroll ? 'payroll' : 'billing'));
  const billedCount = routedRecords.filter((item) => item.billed).length;
  const referencedCount = routedRecords.filter((item) => item.inPayroll).length;
  const metrics = isPayroll
    ? [
        { label: 'Total Scholars', value: routedRecords.length, detail: 'Accepted scholar accounts', tone: 'green', Icon: UsersRound },
        { label: 'For Payroll', value: routedRecords.filter((item) => !item.inPayroll).length, detail: 'Scholars awaiting payroll', tone: 'orange', Icon: Banknote },
        { label: 'In Payroll', value: routedRecords.filter((item) => item.inPayroll).length, detail: 'Included in payroll records', tone: 'blue', Icon: Banknote },
        { label: 'Generated Lists', value: referencedCount, detail: 'Official payroll-list records', tone: 'violet', Icon: ReceiptText },
      ]
    : [
        { label: 'Total Scholars', value: routedRecords.length, detail: 'Accepted scholar accounts', tone: 'green', Icon: UsersRound },
        { label: 'For Certification', value: routedRecords.length - billedCount, detail: 'Private scholars awaiting listing', tone: 'orange', Icon: ReceiptText },
        { label: 'Certification Listed', value: billedCount, detail: 'Included in certification records', tone: 'blue', Icon: ReceiptText },
        { label: 'Grant (PHP)', value: 5000, detail: 'Fixed private tuition support', tone: 'violet', Icon: Banknote },
      ];
  const certificationHistory = useMemo(() => {
    if (isPayroll) return [];
    const batches = new Map();
    records.filter((record) => record.processRoute === 'billing' && record.billed && record.billingReference).forEach((record) => {
      if (!batches.has(record.billingReference)) {
        batches.set(record.billingReference, {
          reference: record.billingReference,
          schoolYear: record.schoolYear,
          semester: record.semester,
          dateProcessed: record.dateProcessed,
          records: [],
        });
      }
      batches.get(record.billingReference).records.push(record);
    });
    return [...batches.values()].sort((left, right) => new Date(right.dateProcessed || 0) - new Date(left.dateProcessed || 0));
  }, [isPayroll, records]);

  const toggleSelection = (setter, id) => setter((current) => current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id]);

  const queueSelected = () => {
    setQueuedIds((current) => [...new Set([...current, ...selectedMovableIds])]);
    setSourceSelection([]);
    setOperationNotice(null);
  };

  const queueAll = () => {
    setQueuedIds((current) => [...new Set([...current, ...movableSourceRecords.map(({ applicantId }) => applicantId)])]);
    setSourceSelection([]);
    setOperationNotice(null);
  };

  const sendToPayroll = async (record) => {
    if (routingApplicant) return;
    setRoutingApplicant(record.applicantId); setOperationNotice(null);
    try {
      const response = await fetch(`${API_BASE}/scholars/${record.applicantId}/payroll-preparation`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ academicPeriodId: Number(selectedPeriodId) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Unable to send this Scholar to Payroll.');
      await loadRecords(); setOperationNotice({ tone: 'success', text: body.message });
    } catch (failure) { setOperationNotice({ tone: 'error', text: failure.message }); }
    finally { setRoutingApplicant(null); }
  };

  const removeSelectedFromQueue = () => {
    setQueuedIds((current) => current.filter((id) => !queueSelection.includes(id)));
    setQueueSelection([]);
    setOperationNotice(null);
  };

  const clearQueue = () => {
    setQueuedIds([]);
    setQueueSelection([]);
    setOperationNotice(null);
  };

  const processQueue = async () => {
    if (!queuedRecords.length || processing || routingApplicant) return;
    setProcessing(true);
    setOperationNotice(null);
    const processedRecords = [...queuedRecords];
    try {
      const response = await fetch(`${API_BASE}/${isPayroll ? 'payroll' : 'billing'}/process`, {
        method: 'POST',
        headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          academicPeriodId: Number(selectedPeriodId),
          applicantIds: queuedRecords.map(({ applicantId }) => applicantId),
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        const details = (Array.isArray(body.ineligible) ? body.ineligible : []).map(({ applicantId, reasons }) => {
          const name = processedRecords.find((record) => record.applicantId === applicantId)?.name || 'Selected scholar';
          const messages = (Array.isArray(reasons) ? reasons : []).map(({ message }) => message).filter(Boolean);
          return messages.length ? `${name}: ${messages.join(' ')}` : '';
        }).filter(Boolean).join(' ');
        throw new Error([body.message || `Unable to process ${mode} records.`, details].filter(Boolean).join(' '));
      }
      const snapshotByApplicant = new Map((body.grantBreakdowns || []).map((item) => [item.applicantId, item]));
      const downloadRecords = processedRecords.map((record) => ({ ...record, ...snapshotByApplicant.get(record.applicantId) }));
      let downloadWarning = '';
      try {
        if (isPayroll) {
          await downloadPayrollWorkbook({ records: downloadRecords, batch: body.batch, activePeriod: body.activePeriod });
        } else {
          await downloadCertificationWorkbook({ records: downloadRecords, batch: body.batch, activePeriod: body.activePeriod });
        }
      } catch (downloadError) {
        const listName = isPayroll ? 'payroll list' : 'certification list';
        downloadWarning = ` The ${listName} was generated, but the Excel download failed: ${downloadError.message}`;
      }
      setQueuedIds([]);
      setSourceSelection([]);
      setQueueSelection([]);
      setOperationNotice({ tone: downloadWarning ? 'error' : 'success', text: `${body.message}${body.incompleteRequirementsCount ? ` ${body.incompleteRequirementsCount} scholar(s) have incomplete requirements; approvals remain unchanged.` : ''}${downloadWarning}` });
      await loadRecords();
    } catch (error) {
      setOperationNotice({ tone: 'error', text: error.message || `Unable to process ${mode} records.` });
    } finally {
      setProcessing(false);
    }
  };

  const exportWorkbook = async (selectedColumns) => {
    if ( !queuedRecords.length || exportingWorkbook || processing) return;
    setExportingWorkbook(true); setOperationNotice(null);
    try {
      const period = activePeriods.find((item) => String(item.id) === String(selectedPeriodId));
      if (!period) throw new Error('Select an active processing period before exporting.');
      await (isPayroll ? downloadPayrollWorkbook : downloadCertificationWorkbook)({ records: [...queuedRecords], activePeriod: period, preparationCopy: true, selectedColumns });
      setOperationNotice({ tone: 'success', text: `${isPayroll ? 'Payroll' : 'Billing'} preparation workbook downloaded. No official list was generated.` });
    } catch (failure) { setOperationNotice({ tone: 'error', text: `Unable to export ${isPayroll ? 'Payroll' : 'Billing'} workbook: ${failure.message}` }); }
    finally { setExportingWorkbook(false); }
  };

  const downloadHistoricalCertification = async (batch) => {
    try {
      await downloadCertificationWorkbook({
        records: batch.records,
        batch: { batchNumber: batch.reference, billingReference: batch.reference },
        activePeriod: { schoolYear: batch.schoolYear, semester: batch.semester },
      });
      setOperationNotice({ tone: 'success', text: `${batch.reference} downloaded successfully.` });
    } catch (error) {
      setOperationNotice({ tone: 'error', text: `Unable to download ${batch.reference}: ${error.message}` });
    }
  };

  return <>
    <div className="billing-management">
      <header className="billing-heading">
        <div><span>{isPayroll ? 'PAYROLL OPERATIONS' : 'BILLING OPERATIONS'}</span><h2>{isPayroll ? 'Payroll Management' : 'Billing Management'}</h2><p>{isPayroll ? 'Generate the official payroll list for initial Public/Private, subsequent Public, and late submissions.' : 'Generate tuition certification lists for subsequent regular Private-school submissions.'}</p></div>
        <label className="billing-period-selector"><span>Processing period</span><select value={selectedPeriodId} disabled={loading || processing || Boolean(routingApplicant) || !activePeriods.length} onChange={(event) => { setSelectedPeriodId(event.target.value); setQueuedIds([]); setSourceSelection([]); setQueueSelection([]); setOperationNotice(null); setPage(1); }}><option value="" disabled>Select active period</option>{activePeriods.map((period) => <option key={period.id} value={period.id}>{period.schoolYear} · {period.semester}{period.isPrimary ? ' (Primary)' : ''}</option>)}</select></label>
      </header>

      <section className="billing-metrics">{metrics.map(({ label, value, detail, tone, Icon }) => <article className={tone} key={label}><div><span>{label}</span><strong>{loading || (loadError && !records.length) ? '—' : Math.max(0, value)}</strong><small>{detail}</small></div><i><Icon size={20} /></i></article>)}</section>

      {loadError && <div className="billing-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => loadRecords({ showLoader: true })}>Retry</button></div>}

      <section className="billing-filter-panel">
        <div className="billing-filter-heading"><div><i><Filter size={15} /></i><span><strong>Quick filters</strong><small>Filter scholar billing and payroll records using operational fields.</small></span></div>{hasFilters && <button type="button" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="billing-filters billing-filter-groups">
          <section className="billing-filter-group">
            <header><strong>Scholar</strong></header>
            <div className="billing-filter-group-fields">
              <label className="billing-search"><span>Search</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Scholar name or email" /></div></label>
              <label><span>Status of scholar</span><select value={scholarStatus} onChange={(event) => { setScholarStatus(event.target.value); setPage(1); }}><option>All Scholar Statuses</option>{scholarStatuses.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>School</span><select value={school} onChange={(event) => { setSchool(event.target.value); setPage(1); }}><option>All Schools</option>{schools.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>
          </section>

          <section className="billing-filter-group">
            <header><strong>Billing & payroll</strong></header>
            <div className="billing-filter-group-fields">
              <div className="billing-filter-status-row">
                <label><span>Billed?</span><select value={billed} onChange={(event) => { setBilled(event.target.value); setPage(1); }}><option>All Billing Statuses</option><option>Billed</option><option>Not billed yet</option></select></label>
                <label><span>Payroll list</span><select aria-label="Payroll list status" value={payrollListStatus} onChange={(event) => { setPayrollListStatus(event.target.value); setPage(1); }}><option>All Payroll Statuses</option><option>Included in payroll list</option><option>Not included yet</option></select></label>
              </div>
              <label><span>Billing reference</span><select value={billingReference} onChange={(event) => {
                const nextReference = event.target.value;
                setBillingReference(nextReference);
                if (!['All Billing References', 'No billing reference'].includes(nextReference)) setBilled('Billed');
                setPage(1);
              }}><option>All Billing References</option><option>No billing reference</option>{billingReferences.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>Payroll reference</span><select value={payReference} onChange={(event) => {
                const nextReference = event.target.value;
                setPayReference(nextReference);
                if (!['All Payroll References', 'No payroll reference'].includes(nextReference)) {
                  setBilled('All Billing Statuses');
                  setPayrollListStatus('All Payroll Statuses');
                }
                setPage(1);
              }}><option>All Payroll References</option><option>No payroll reference</option>{payReferences.map((option) => <option key={option}>{option}</option>)}</select></label>
            </div>
          </section>

          <section className="billing-filter-group">
            <header><strong>Academic & date</strong></header>
            <div className="billing-filter-group-fields">
              <label><span>School year / sem</span><select value={schoolYearSem} onChange={(event) => { setSchoolYearSem(event.target.value); setPage(1); }}><option>All School Years / Semesters</option>{schoolYearSemesters.map((option) => <option key={option}>{option}</option>)}</select></label>
              <label><span>School type</span><select value={schoolType} onChange={(event) => { setSchoolType(event.target.value); setPage(1); }}><option>All School Types</option>{schoolTypes.map((option) => <option key={option}>{option}</option>)}</select></label>
              <div className="billing-filter-date-range">
                <label><span>Processed from</span><div className="billing-date"><CalendarRange size={14} /><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} /></div></label>
                <label><span>Processed to</span><div className="billing-date"><CalendarRange size={14} /><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} /></div></label>
              </div>
            </div>
          </section>
        </div>
      </section>

      {isPayroll && payrollListStatus === 'Not included yet' && <p className="processing-remaining-note">Showing Scholars without a Billing or Payroll list record for this period. After a regular list is generated, use Send to Payroll for remaining Private Scholars. Missing a list record does not mean a late submission.</p>}
      {operationNotice && <div className={`billing-operation-notice ${operationNotice.tone}`} role="status">{operationNotice.tone === 'error' && <TriangleAlert size={16} />}<span>{operationNotice.text}</span><button type="button" onClick={() => setOperationNotice(null)} aria-label="Dismiss notification"><X size={14} /></button></div>}

      <section className="billing-transfer-board">
        <article className="billing-transfer-panel billing-source-panel">
          <header className="billing-transfer-header">
            <div><strong>List of Scholars</strong><small>{loadError && !records.length ? 'Records unavailable' : <>{sourceRecords.length} filtered record{sourceRecords.length === 1 ? '' : 's'}</>}</small></div>
            <span><button type="button" onClick={() => setSourceSelection(movableSourceRecords.map(({ applicantId }) => applicantId))} disabled={!movableSourceRecords.length}>Select movable</button><button type="button" onClick={() => setSourceSelection([])} disabled={!sourceSelection.length}>Clear</button></span>
          </header>
          <div className="billing-queue-table billing-source-table">
            <div className="billing-queue-table-head"><span>Control no.</span><span>Name</span><span>Status</span></div>
            <div className="billing-queue-table-body">
              {loading && !records.length && <div className="billing-queue-empty"><span className="scholars-spinner" />Loading scholars…</div>}
              {!loading && !loadError && !sourceRecords.length && <div className="billing-queue-empty"><Search size={20} /><strong>No scholar records</strong><span>{hasFilters ? 'No records match the selected filters.' : 'Scholar records will appear here automatically.'}</span></div>}
              {sourceRecords.map((record) => {
                const canMove = canQueueForProcessing(record, isPayroll ? 'payroll' : 'billing');
                const isSelected = canMove && sourceSelection.includes(record.applicantId);
                const statusLabel = record.schoolType === 'Private' && !record.grantPrepared && !record.billed && !record.inPayroll
                  ? 'Grant preparation required' : record.schoolType === 'Unclassified'
                  ? 'School classification required'
                  : isPayroll
                    ? record.inPayroll ? 'In payroll list' : canMove ? 'Ready for payroll' : 'Unavailable'
                    : record.billed ? 'Certification listed' : canMove ? 'Ready for certification' : 'Unavailable';
                const unavailableReason = record.billingEligibilityReasons?.[0]?.message;
                return <div className={`billing-queue-row ${isSelected ? 'selected' : ''} ${canMove ? '' : 'archived'}`} key={record.id}>
                  <code>{record.controlNumber || '—'}</code>
                  <button type="button" className="billing-queue-name" aria-pressed={isSelected} disabled={!canMove} title={canMove ? `Select ${record.name}` : unavailableReason || `${record.name} cannot be moved again.`} onClick={() => toggleSelection(setSourceSelection, record.applicantId)}><strong>{record.name}</strong></button>
                  <div className="billing-source-status">
                    <span className={`billing-queue-ready ${canMove ? '' : 'archived'}`}>{statusLabel}</span>
                    {record.processingWarnings?.length > 0 && <RequirementsWarning name={record.name} />}
                    {record.canPreparePayroll && <button type="button" className="processing-send-payroll" disabled={Boolean(routingApplicant) || processing} onClick={() => sendToPayroll(record)} aria-label={`Send ${record.name} to Payroll`}>{routingApplicant === record.applicantId ? 'Sending…' : 'Send to Payroll'}</button>}
                  </div>
                  <ScholarSchoolIdentity record={record} />
                </div>;
              })}
            </div>
          </div>
          <footer><span>Selected: <strong>{selectedMovableIds.length}</strong></span><span>Movable: <strong>{movableSourceRecords.length}</strong></span></footer>
        </article>

        <nav className="billing-transfer-controls" aria-label="Move scholars between lists">
          <button type="button" className="primary" onClick={queueSelected} disabled={!selectedMovableIds.length} aria-label={`Move selected scholars to ${isPayroll ? 'payroll' : 'billing'}`}><ChevronRight size={17} /></button>
          <button type="button" onClick={queueAll} disabled={!movableSourceRecords.length} aria-label={`Move all eligible scholars to ${isPayroll ? 'payroll' : 'billing'}`}><ChevronsRight size={17} /></button>
          <button type="button" onClick={removeSelectedFromQueue} disabled={!queueSelection.length} aria-label="Return selected scholars to the source list"><ChevronLeft size={17} /></button>
          <button type="button" onClick={clearQueue} disabled={!queuedRecords.length} aria-label="Return all scholars to the source list"><ChevronsLeft size={17} /></button>
        </nav>

        <article className="billing-transfer-panel billing-target-panel">
          <header className="billing-transfer-header">
            <div><strong>{isPayroll ? 'For Payroll' : 'For Billing'}</strong><small>Incomplete requirements can still be listed.</small></div>
            <button type="button" className="billing-queue-export" onClick={() => setExportOpen(true)} disabled={!queuedRecords.length || exportingWorkbook || processing}><Download size={14} />{exportingWorkbook ? 'Exporting…' : 'Export Excel'}</button>
          </header>
          <div className="billing-queue-table billing-target-table">
            <div className="billing-queue-table-head"><span>Control no.</span><span>Name</span><span>School year</span><span>Sem</span><span>Amount</span></div>
            <div className="billing-queue-table-body">
              {!queuedRecords.length && <div className="billing-queue-empty"><ReceiptText size={20} /><strong>No scholars queued</strong><span>Use the transfer controls to add scholars.</span></div>}
              {queuedRecords.map((record) => <div className={`billing-queue-row ${queueSelection.includes(record.applicantId) ? 'selected' : ''}`} key={record.id}>
                <code>{record.controlNumber || '—'}</code>
                <div className="billing-queued-identity">
                  <button type="button" className="billing-queue-name" aria-pressed={queueSelection.includes(record.applicantId)} onClick={() => toggleSelection(setQueueSelection, record.applicantId)}><strong>{record.name}</strong><small>{record.school}</small></button>
                  {record.processingWarnings?.length > 0 && <RequirementsWarning name={record.name} />}
                </div>
                <span>{record.schoolYear}</span>
                <span>{record.semester}</span>
                <strong className="billing-row-amount">{formatAmount(record.claimAmount)}</strong>
              </div>)}
            </div>
          </div>
          <footer className="billing-target-footer"><div><span>List count: <strong>{queuedRecords.length}</strong></span><span>{isPayroll ? 'Total payroll amount' : 'Total certification amount'}: <strong>{formatAmount(queuedTotalAmount)}</strong></span></div><button type="button" onClick={processQueue} disabled={!queuedRecords.length || processing || Boolean(routingApplicant)}>{processing ? 'Processing…' : isPayroll ? 'Generate payroll list' : 'Generate certification list'}</button></footer>
        </article>
      </section>
      {!isPayroll && !loadError && <section className="billing-certification-history"><header><div><span>CERTIFICATION RECORDS</span><h3>Certification history</h3><p>Review generated Private-scholar lists and download a previous workbook again.</p></div><strong>{certificationHistory.length} batch{certificationHistory.length === 1 ? '' : 'es'}</strong></header>{certificationHistory.length ? <div className="billing-certification-history-list">{certificationHistory.map((batch) => <article key={batch.reference}><div><code>{batch.reference}</code><span>{batch.schoolYear} · {batch.semester}</span></div><div><strong>{batch.records.length} scholar{batch.records.length === 1 ? '' : 's'}</strong><span>{formatAmount(batch.records.reduce((total, record) => total + Number(record.claimAmount || 5000), 0))} · {formatDate(batch.dateProcessed)}</span></div><button type="button" onClick={() => downloadHistoricalCertification(batch)}><Download size={14} />Download XLSX</button></article>)}</div> : <div className="billing-certification-history-empty"><ReceiptText size={20} /><strong>No certification history yet</strong><span>Generated Private-scholar certification lists will appear here.</span></div>}</section>}
      {exportOpen && <CsvExportModal title={`Export ${isPayroll ? 'payroll' : 'billing'} queue`} description={`Choose columns and arrange their order. The Excel download uses the ${isPayroll ? 'Payroll' : 'Billing'} template and is marked as a preparation copy.`} columns={isPayroll ? configurablePayrollColumns : configurableBillingColumns} allowReorder formatLabel="EXCEL EXPORT" exportLabel="Export Excel" rowCount={queuedRecords.length} onClose={() => setExportOpen(false)} onExport={exportWorkbook} />}

    </div>

  </>;
}

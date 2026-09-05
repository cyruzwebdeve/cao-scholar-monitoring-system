import {
  Archive,
  ArrowUpDown,
  BadgeCheck,
  BookText,
  CalendarDays,
  Calculator,
  ChartColumn,
  ClipboardList,
  Clock3,
  Download,
  FileCheck2,
  FilePenLine,
  FileText,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  HardDrive,
  Eye,
  Info,
  ListTodo,
  Megaphone,
  MapPin,
  NotebookPen,
  Power,
  Puzzle,
  Rocket,
  School,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  UserCog,
  UsersRound,
  X,
  Boxes,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { API_BASE, authHeaders } from './services/api';
import CsvExportModal from './components/CsvExportModal';
import { buildRecordRows, downloadCsv } from './utils/csvExport';
import ResultsManagement from './ResultsManagement';
import ScholarsManagement from './ScholarsManagement';
import SettingsManagement from './SettingsManagement';
import BillingPayrollManagement from './BillingPayrollManagement';
import AnnouncementsManagement from './AnnouncementsManagement';
import ReportsManagement from './ReportsManagement';
import ActivityLogsManagement from './ActivityLogsManagement';
import StaffManagement from './StaffManagement';
import DocumentReviewManagement from './DocumentReviewManagement';
import SchoolCatalogManagement from './SchoolCatalogManagement';
import municipalitiesData from '../../municipality.json';
import barangaysData from '../../brgy.json';
import './styles/admin-prelude.css';
import './styles/admin.css';
import './styles/admin-responsive.css';

const municipalityNames = [...new Set(municipalitiesData.map((item) => item.name))];

const metricIconByLabel = {
  'Open Applications': FileText,
  'Active Scholars': UsersRound,
  'Pending Reviews': Clock3,
  'Role Updates': ShieldCheck,
  Submitted: FileCheck2,
  Incomplete: ClipboardList,
  'For Review': Search,
  Approved: BadgeCheck,
  'Staff Members': UserCog,
  'Active Tasks': ListTodo,
  'Open Requests': Clock3,
  'Access Reviews': ShieldCheck,
  'Payout Compliant': BadgeCheck,
  'In Payroll': Boxes,
  'Needs Action': TriangleAlert,
  'Open Bills': FileText,
  'Pending Review': Search,
  Released: Send,
  Paid: BadgeCheck,
  'Compliant Scholars': BadgeCheck,
  'Batches Created': Boxes,
  'For Scoring': FilePenLine,
  Passed: GraduationCap,
  'For Recheck': FlaskConical,
  'Ready to Activate': Rocket,
  Waitlisted: FileText,
  'For Release': Megaphone,
  Archived: Archive,
  Published: Megaphone,
  Scheduled: CalendarDays,
  Drafts: NotebookPen,
  'Audience Segments': UsersRound,
  Schools: School,
  'Active Entries': BookText,
  'Pending Updates': Clock3,
  Today: ClipboardList,
  Week: CalendarDays,
  'Access Events': ShieldCheck,
  Alerts: TriangleAlert,
  'Current Year': CalendarDays,
  'Open Terms': CalendarDays,
  'Archived Cycles': Archive,
  'Pending Setup': Settings2,
  'Monthly Reports': ChartColumn,
  Exports: FolderOpen,
  'Audit Views': Calculator,
  'Pending Metrics': Clock3,
  'Active Modules': Puzzle,
  'Last Backup': HardDrive,
  'Security Flags': ShieldAlert,
  'Pending Configs': Settings2,
  'Forfeited Accounts': ShieldAlert,
};

const sectionViews = {
  Dashboard: {
    eyebrow: 'System overview',
    title: 'Super admin command center',
    description: 'Track the full scholarship workflow, access control, and operational priorities from one place.',
    metrics: [
      { label: 'Open Applications', value: '184', icon: '📝', tone: 'emerald' },
      { label: 'Active Scholars', value: '42', icon: '👥', tone: 'sky' },
      { label: 'Pending Reviews', value: '11', icon: '⏳', tone: 'amber' },
      { label: 'Role Updates', value: '7', icon: '🔐', tone: 'violet' },
    ],
    primaryTitle: 'Recent submissions',
    primaryLink: 'View application queue',
    primaryItems: [
      { name: 'Maria Santos', detail: 'Scholarship Renewal', status: 'Approved', time: '10 min ago' },
      { name: 'Jhon Dela Cruz', detail: 'New Application', status: 'Pending', time: '32 min ago' },
      { name: 'Rina Lopez', detail: 'Document Check', status: 'Needs Review', time: '1 hr ago' },
    ],
    secondaryTitle: 'Today’s focus',
    secondaryTag: 'Priority',
    secondaryHeadline: 'Review 6 incomplete documents',
    secondaryText: 'Most applicants are missing proof of residency, certification uploads, or role verification.',
    secondaryItems: [
      '3 applications are ready for exam encoding.',
      '2 role update requests need approval.',
      '1 payroll batch is waiting for release review.',
    ],
  },
  'Content Management': {
    eyebrow: 'Content moderation',
    title: 'Content management workspace',
    description: 'Manage announcements, publishing flow, and content review tasks from one place.',
    heroBadge: 'Moderator ready',
    metrics: [
      { label: 'Published', value: '18', icon: '📣', tone: 'emerald' },
      { label: 'Scheduled', value: '3', icon: '🗓️', tone: 'sky' },
      { label: 'Drafts', value: '5', icon: '📝', tone: 'amber' },
      { label: 'Pending Review', value: '7', icon: '🔎', tone: 'violet' },
    ],
    primaryTitle: 'Content queue',
    primaryLink: 'Open content editor',
    primaryItems: [
      { name: 'Scholarship deadline reminder', detail: 'Ready for publish', status: 'Approved', time: '2 hrs ago' },
      { name: 'Payroll release update', detail: 'Scheduled for later today', status: 'Pending', time: 'Today' },
      { name: 'Exam schedule notice', detail: 'Needs final review', status: 'Needs Review', time: 'Today' },
    ],
    secondaryTitle: 'Content focus',
    secondaryTag: 'Moderation',
    secondaryHeadline: 'Keep announcements accurate',
    secondaryText: 'Review posts before publishing to avoid stale deadlines and incorrect notices.',
    secondaryItems: [
      'Check draft announcements.',
      'Approve or reject scheduled posts.',
      'Keep the notice board current.',
    ],
  },
  Applicants: {
    eyebrow: 'Application pipeline',
    title: 'Application intake and review',
    description: 'Monitor new submissions, application completeness, and approval bottlenecks.',
    heroBadge: 'Queue 184',
    metrics: [
      { label: 'Submitted', value: '184', icon: '📝', tone: 'emerald' },
      { label: 'Incomplete', value: '23', icon: '🧾', tone: 'amber' },
      { label: 'For Review', value: '11', icon: '🔍', tone: 'sky' },
      { label: 'Approved', value: '97', icon: '✅', tone: 'violet' },
    ],
    primaryTitle: 'Application queue',
    primaryLink: 'Open all applications',
    primaryItems: [
      { name: 'Ana Cruz', detail: 'Needs residency document', status: 'Needs Review', time: '5 min ago' },
      { name: 'Leah Torres', detail: 'Ready for encoding', status: 'Pending', time: '18 min ago' },
      { name: 'Mark Dizon', detail: 'For final approval', status: 'Approved', time: '41 min ago' },
    ],
    secondaryTitle: 'Screening focus',
    secondaryTag: 'Review',
    secondaryHeadline: 'Clear the incomplete intake forms',
    secondaryText: 'Prioritize document follow-ups before exam encoding and scholar activation.',
    secondaryItems: [
      'Validate required fields on new submissions.',
      'Route incomplete records back to applicants.',
      'Prepare complete records for exam workflow.',
    ],
  },
  Staff: {
    eyebrow: 'Staff oversight',
    title: 'Staff records and assignments',
    description: 'Manage staff access, task ownership, and day-to-day workload across the portal.',
    heroBadge: 'Team active',
    metrics: [
      { label: 'Staff Members', value: '14', icon: '👔', tone: 'emerald' },
      { label: 'Active Tasks', value: '26', icon: '📋', tone: 'sky' },
      { label: 'Open Requests', value: '5', icon: '⏳', tone: 'amber' },
      { label: 'Access Reviews', value: '2', icon: '🔐', tone: 'violet' },
    ],
    primaryTitle: 'Staff task list',
    primaryLink: 'Open staff directory',
    primaryItems: [
      { name: 'Maria Cruz', detail: 'Reviewing applications', status: 'Approved', time: 'Updated today' },
      { name: 'Jorge Santos', detail: 'Assigned to payroll checks', status: 'Pending', time: 'Updated today' },
      { name: 'Ana Reyes', detail: 'Access request pending', status: 'Needs Review', time: 'Updated 2 hrs ago' },
    ],
    secondaryTitle: 'Staff focus',
    secondaryTag: 'Assignments',
    secondaryHeadline: 'Keep staff load balanced',
    secondaryText: 'Track internal staff work, approvals, and any access changes that need attention.',
    secondaryItems: [
      'Review internal task assignments.',
      'Confirm staff access updates.',
      'Track workload across teams.',
    ],
  },
  Scholars: {
    eyebrow: 'Scholar management',
    title: 'Scholar records and status tracking',
    description: 'View active scholars, compliance status, and records moving through the program.',
    heroBadge: '42 active',
    metrics: [
      { label: 'Active Scholars', value: '42', icon: '👥', tone: 'sky' },
      { label: 'Payout Compliant', value: '28', icon: '💳', tone: 'emerald' },
      { label: 'In Payroll', value: '9', icon: '📦', tone: 'amber' },
      { label: 'Needs Action', value: '5', icon: '⚠️', tone: 'violet' },
    ],
    primaryTitle: 'Scholar status list',
    primaryLink: 'Open scholar roster',
    primaryItems: [
      { name: 'Rina Lopez', detail: 'Payout compliant', status: 'Approved', time: 'Updated today' },
      { name: 'Jose Reyes', detail: 'In payroll queue', status: 'Pending', time: 'Updated today' },
      { name: 'Mia Santos', detail: 'Needs requirement follow-up', status: 'Needs Review', time: 'Updated 2 hrs ago' },
    ],
    secondaryTitle: 'Management focus',
    secondaryTag: 'Compliance',
    secondaryHeadline: 'Keep scholar records current',
    secondaryText: 'Confirm payout readiness and keep compliance flags aligned with the latest submissions.',
    secondaryItems: [
      'Check scholar status transitions.',
      'Confirm payout-compliant records.',
      'Resolve exceptions before payroll release.',
    ],
  },
  Billing: {
    eyebrow: 'Billing overview',
    title: 'Billing records and payment status',
    description: 'Monitor pending charges, release requests, and billing-related follow ups.',
    heroBadge: 'Billing queue',
    metrics: [
      { label: 'Open Bills', value: '8', icon: '🧾', tone: 'emerald' },
      { label: 'Pending Review', value: '4', icon: '🔍', tone: 'sky' },
      { label: 'Released', value: '16', icon: '📤', tone: 'amber' },
      { label: 'Paid', value: '21', icon: '💰', tone: 'violet' },
    ],
    primaryTitle: 'Billing queue',
    primaryLink: 'Open billing records',
    primaryItems: [
      { name: 'Batch 2026-07A', detail: 'Pending release check', status: 'Pending', time: 'Today' },
      { name: 'Batch 2026-07B', detail: 'Approved for billing', status: 'Approved', time: 'Today' },
      { name: 'Batch 2026-06C', detail: 'Archived billing cycle', status: 'Approved', time: 'Last week' },
    ],
    secondaryTitle: 'Billing focus',
    secondaryTag: 'Review',
    secondaryHeadline: 'Clear billing follow ups',
    secondaryText: 'Keep billing records aligned with the latest approval and payment status.',
    secondaryItems: [
      'Check pending billing items.',
      'Verify release readiness.',
      'Confirm paid billing cycles.',
    ],
  },
  Payroll: {
    eyebrow: 'Payroll oversight',
    title: 'Payroll management',
    description: 'Monitor compliant scholars, batch release status, and payment progress.',
    heroBadge: 'Billing ready',
    metrics: [
      { label: 'Compliant Scholars', value: '28', icon: '💳', tone: 'emerald' },
      { label: 'Batches Created', value: '4', icon: '📦', tone: 'sky' },
      { label: 'Released', value: '3', icon: '📤', tone: 'amber' },
      { label: 'Paid', value: '21', icon: '💰', tone: 'violet' },
    ],
    primaryTitle: 'Payroll batch list',
    primaryLink: 'Open payroll batches',
    primaryItems: [
      { name: 'Batch 2026-07A', detail: '10 scholars released', status: 'Approved', time: 'Today' },
      { name: 'Batch 2026-07B', detail: 'Awaiting release', status: 'Pending', time: 'Today' },
      { name: 'Batch 2026-06C', detail: 'Complete and paid', status: 'Approved', time: 'Last week' },
    ],
    secondaryTitle: 'Payroll focus',
    secondaryTag: 'Release',
    secondaryHeadline: 'Clear payout batches on time',
    secondaryText: 'Use the payroll queue to keep scholarship disbursements moving without delays.',
    secondaryItems: [
      'Review payout-compliant scholars.',
      'Release approved batches.',
      'Confirm paid scholarship records.',
    ],
  },
  'Examination Management': {
    eyebrow: 'Exam operations',
    title: 'Examination management',
    description: 'Assign exam results, monitor scoring progress, and prepare scholars for activation.',
    heroBadge: 'Encoding live',
    metrics: [
      { label: 'For Scoring', value: '18', icon: '✍️', tone: 'amber' },
      { label: 'Passed', value: '76', icon: '🎓', tone: 'emerald' },
      { label: 'For Recheck', value: '9', icon: '🧪', tone: 'sky' },
      { label: 'Ready to Activate', value: '12', icon: '🚀', tone: 'violet' },
    ],
    primaryTitle: 'Exam score queue',
    primaryLink: 'Open scoring records',
    primaryItems: [
      { name: 'Batch A-2026', detail: '15 submissions waiting', status: 'Pending', time: 'Today' },
      { name: 'Batch B-2026', detail: '3 for recheck', status: 'Needs Review', time: 'Today' },
      { name: 'Batch C-2026', detail: 'All scores encoded', status: 'Approved', time: 'Today' },
    ],
    secondaryTitle: 'Exam focus',
    secondaryTag: 'Scoring',
    secondaryHeadline: 'Finalize exam inputs',
    secondaryText: 'Clear pending scores so scholar activation can move forward without delays.',
    secondaryItems: [
      'Encode new exam results.',
      'Review borderline score entries.',
      'Push qualified scholars to activation.',
    ],
  },
  'Results Management': {
    eyebrow: 'Decision releases',
    title: 'Results management',
    description: 'Track approved outcomes, waitlisted records, and release readiness for final notices.',
    heroBadge: '117 resolved',
    metrics: [
      { label: 'Approved', value: '97', icon: '✅', tone: 'emerald' },
      { label: 'Waitlisted', value: '14', icon: '📄', tone: 'amber' },
      { label: 'For Release', value: '8', icon: '📣', tone: 'sky' },
      { label: 'Archived', value: '23', icon: '🗂️', tone: 'violet' },
    ],
    primaryTitle: 'Outcome release list',
    primaryLink: 'Open release history',
    primaryItems: [
      { name: 'Final cohort A', detail: 'Ready for notification', status: 'Approved', time: 'Today' },
      { name: 'Final cohort B', detail: 'Waiting on confirmation', status: 'Pending', time: 'Yesterday' },
      { name: 'Appeal batch', detail: 'Needs review', status: 'Needs Review', time: 'Yesterday' },
    ],
    secondaryTitle: 'Results focus',
    secondaryTag: 'Release',
    secondaryHeadline: 'Publish final decisions',
    secondaryText: 'Review locked outcomes before releasing notifications to applicants and scholars.',
    secondaryItems: [
      'Confirm approval lists.',
      'Check for unresolved appeals.',
      'Schedule release notices.',
    ],
  },
  Announcements: {
    eyebrow: 'Communication hub',
    title: 'Announcements and notices',
    description: 'Publish system-wide updates for applicants, scholars, and staff.',
    heroBadge: '3 scheduled',
    metrics: [
      { label: 'Published', value: '18', icon: '📣', tone: 'emerald' },
      { label: 'Scheduled', value: '3', icon: '🗓️', tone: 'sky' },
      { label: 'Drafts', value: '5', icon: '📝', tone: 'amber' },
      { label: 'Audience Segments', value: '4', icon: '👥', tone: 'violet' },
    ],
    primaryTitle: 'Recent announcements',
    primaryLink: 'Open announcement editor',
    primaryItems: [
      { name: 'Scholarship deadline reminder', detail: 'Published for applicants', status: 'Approved', time: '2 hrs ago' },
      { name: 'Payroll release update', detail: 'Scheduled for scholars', status: 'Pending', time: 'Tomorrow' },
      { name: 'Exam schedule notice', detail: 'Draft ready', status: 'Needs Review', time: 'Today' },
    ],
    secondaryTitle: 'Announcement focus',
    secondaryTag: 'Publishing',
    secondaryHeadline: 'Keep audiences informed',
    secondaryText: 'Coordinate notices around deadlines, exam schedules, and payment releases.',
    secondaryItems: [
      'Publish urgent notices first.',
      'Schedule system reminders.',
      'Keep draft updates ready for review.',
    ],
  },
  'School Catalog': {
    eyebrow: 'Catalog management',
    title: 'School catalog and institution list',
    description: 'Review the school catalog used across the application and scholar workflows.',
    heroBadge: 'Catalog synced',
    metrics: [
      { label: 'Schools', value: '124', icon: '🏫', tone: 'emerald' },
      { label: 'Active Entries', value: '118', icon: '📘', tone: 'sky' },
      { label: 'Pending Updates', value: '6', icon: '⏳', tone: 'amber' },
      { label: 'Archived', value: '2', icon: '🗂️', tone: 'violet' },
    ],
    primaryTitle: 'School catalog',
    primaryLink: 'Open catalog editor',
    primaryItems: [
      { name: 'Central State University', detail: 'Active catalog entry', status: 'Approved', time: 'Updated today' },
      { name: 'Northern Institute', detail: 'Needs validation', status: 'Needs Review', time: 'Updated today' },
      { name: 'Metro Tech College', detail: 'Approved for use', status: 'Approved', time: 'Updated 2 hrs ago' },
    ],
    secondaryTitle: 'Catalog focus',
    secondaryTag: 'Data',
    secondaryHeadline: 'Keep school records current',
    secondaryText: 'Ensure the school list is accurate before applicants and scholars make selections.',
    secondaryItems: [
      'Review institution names and codes.',
      'Validate new catalog additions.',
      'Archive retired school entries.',
    ],
  },
  'Activity Logs': {
    eyebrow: 'Audit trail',
    title: 'Activity logs and system events',
    description: 'Track administrative actions, approvals, and system activity across the portal.',
    heroBadge: 'Live events',
    metrics: [
      { label: 'Today', value: '42', icon: '📋', tone: 'emerald' },
      { label: 'Week', value: '198', icon: '🕘', tone: 'sky' },
      { label: 'Access Events', value: '13', icon: '🔐', tone: 'amber' },
      { label: 'Alerts', value: '2', icon: '⚠️', tone: 'violet' },
    ],
    primaryTitle: 'Recent events',
    primaryLink: 'Open audit log',
    primaryItems: [
      { name: 'Super Admin Login', detail: 'Dashboard access granted', status: 'Approved', time: '2 min ago' },
      { name: 'Role Update', detail: 'Staff permissions changed', status: 'Needs Review', time: '24 min ago' },
      { name: 'Payroll Release', detail: 'Batch approved for payout', status: 'Approved', time: 'Today' },
    ],
    secondaryTitle: 'Log focus',
    secondaryTag: 'Monitoring',
    secondaryHeadline: 'Watch key actions closely',
    secondaryText: 'Keep an eye on sensitive changes, approvals, and access activity.',
    secondaryItems: [
      'Review admin actions.',
      'Check access changes.',
      'Export logs when needed.',
    ],
  },
  'Academic Years': {
    eyebrow: 'Academic calendar',
    title: 'Academic years and cycles',
    description: 'Manage academic periods used for applications, enrollment, and reporting.',
    heroBadge: 'Current cycle',
    metrics: [
      { label: 'Current Year', value: '2026-2027', icon: '📅', tone: 'emerald' },
      { label: 'Open Terms', value: '2', icon: '🗓️', tone: 'sky' },
      { label: 'Archived Cycles', value: '7', icon: '🗃️', tone: 'amber' },
      { label: 'Pending Setup', value: '1', icon: '⚙️', tone: 'violet' },
    ],
    primaryTitle: 'Academic year list',
    primaryLink: 'Open cycle manager',
    primaryItems: [
      { name: '2026-2027', detail: 'Current academic year', status: 'Approved', time: 'Active' },
      { name: '2025-2026', detail: 'Archived cycle', status: 'Approved', time: 'Archived' },
      { name: '2027-2028', detail: 'Prepared for setup', status: 'Pending', time: 'Draft' },
    ],
    secondaryTitle: 'Calendar focus',
    secondaryTag: 'Cycle setup',
    secondaryHeadline: 'Keep academic cycles organized',
    secondaryText: 'Make sure each school year is set before submissions and reporting begin.',
    secondaryItems: [
      'Review active academic year.',
      'Prepare the next cycle.',
      'Archive completed years.',
    ],
  },
  Reports: {
    eyebrow: 'Reporting center',
    title: 'Reports and analytics',
    description: 'Review operational exports, monthly summaries, and audit-ready snapshots.',
    heroBadge: 'Export ready',
    metrics: [
      { label: 'Monthly Reports', value: '12', icon: '📊', tone: 'emerald' },
      { label: 'Exports', value: '8', icon: '📁', tone: 'sky' },
      { label: 'Audit Views', value: '5', icon: '🧮', tone: 'amber' },
      { label: 'Pending Metrics', value: '2', icon: '⏳', tone: 'violet' },
    ],
    primaryTitle: 'Report queue',
    primaryLink: 'Open reporting workspace',
    primaryItems: [
      { name: 'Application summary', detail: 'Ready to export', status: 'Approved', time: 'Today' },
      { name: 'Payroll summary', detail: 'Waiting on release totals', status: 'Pending', time: 'Today' },
      { name: 'Access audit', detail: 'Needs signoff', status: 'Needs Review', time: 'Yesterday' },
    ],
    secondaryTitle: 'Reporting focus',
    secondaryTag: 'Insights',
    secondaryHeadline: 'Keep the system measurable',
    secondaryText: 'Use reports to track approvals, releases, and role changes over time.',
    secondaryItems: [
      'Export monthly snapshots.',
      'Review approval trends.',
      'Prepare audit references.',
    ],
  },
  Settings: {
    eyebrow: 'System settings',
    title: 'Portal settings and controls',
    description: 'Tune system preferences, monitor access health, and keep configuration aligned.',
    heroBadge: 'Healthy',
    metrics: [
      { label: 'Active Modules', value: '9', icon: '🧩', tone: 'emerald' },
      { label: 'Last Backup', value: 'Today', icon: '💾', tone: 'sky' },
      { label: 'Security Flags', value: '0', icon: '🛡️', tone: 'amber' },
      { label: 'Pending Configs', value: '1', icon: '⚙️', tone: 'violet' },
    ],
    primaryTitle: 'System checks',
    primaryLink: 'Open settings',
    primaryItems: [
      { name: 'Authentication', detail: 'Healthy and synced', status: 'Approved', time: 'Now' },
      { name: 'Notifications', detail: 'Templates loaded', status: 'Pending', time: 'Now' },
      { name: 'Backups', detail: 'Latest backup complete', status: 'Approved', time: 'Today' },
    ],
    secondaryTitle: 'Configuration focus',
    secondaryTag: 'Maintenance',
    secondaryHeadline: 'Keep the system stable',
    secondaryText: 'Review platform configuration, backup status, and access safeguards regularly.',
    secondaryItems: [
      'Confirm authentication settings.',
      'Review backup completion.',
      'Check notification templates.',
    ],
  },
};

const superAdminOverview = {
  stats: [
    {
      label: 'Active Scholars',
      value: '4',
      icon: GraduationCap,
      tone: 'success',
      accent: 'emerald',
    },
    {
      label: 'Forfeited Accounts',
      value: '0',
      icon: TriangleAlert,
      tone: 'danger',
      accent: 'rose',
    },
  ],
  recentApplications: [
    { name: 'CLARA MAGBANUA', controlNo: 'PGCEAP-2026-00023', status: 'Completed' },
    { name: 'PATRICIA DE LOS SANTOS', controlNo: 'PGCEAP-2026-00022', status: 'Pending Review' },
    { name: 'MARK VILLAFUERTE', controlNo: 'PGCEAP-2026-00021', status: 'Pending Review' },
    { name: 'BENEDICT EVANGELISTA', controlNo: 'PGCEAP-2026-00020', status: 'Pending Review' },
    { name: 'LIZA MARIE CATACUTAN', controlNo: 'PGCEAP-2026-00019', status: 'Pending Review' },
    { name: 'EMILIO SANTOS', controlNo: 'PGCEAP-2026-00018', status: 'Pending Review' },
    { name: 'KRISTINA CASSANDRA MACAPAGAL', controlNo: 'PGCEAP-2026-00017', status: 'Pending Review' },
  ],
  schoolCatalog: [
    { name: 'Camarines Norte School of Law', classification: 'Public' },
    { name: 'Camarines Norte School of Law, Arts and Sciences Inc.', classification: 'Public' },
    { name: 'Camarines Norte State College - Daet Campus', classification: 'Public' },
    { name: 'Camarines Norte State College, Abaño Campus', classification: 'Public' },
    { name: 'Camarines Norte State College, Entienza Campus', classification: 'Public' },
    { name: 'Camarines Norte State College, Jose Panganiban Campus', classification: 'Public' },
    { name: 'Camarines Norte State College, Labo Campus', classification: 'Public' },
  ],
  recentActivity: [
    {
      title: 'Admin logged in',
      detail: 'Email: superadmin@pgceap.gov.ph',
      status: 'INFO',
      time: '2026-07-13 17:03:01',
    },
    {
      title: 'Admin logged in',
      detail: 'Email: superadmin@pgceap.gov.ph',
      status: 'INFO',
      time: '2026-07-13 17:01:07',
    },
    {
      title: 'User logged out',
      detail: 'Session closed from dashboard',
      status: 'INFO',
      time: '2026-07-13 16:51:42',
    },
    {
      title: 'Admin logged in',
      detail: 'Email: admin@pgceap.gov.ph',
      status: 'INFO',
      time: '2026-07-13 12:05:08',
    },
  ],
};

const formatDashboardTime = (value) => {
  if (!value) return 'Time unavailable';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

function DashboardOverview({ token, onSectionChange }) {
  const [overview, setOverview] = useState({
    stats: { activeScholars: 0, forfeitedAccounts: 0 },
    recentApplications: [],
    recentActivity: [],
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    const loadOverview = async () => {
      try {
        const response = await fetch(`${API_BASE}/dashboard/summary`, { headers: authHeaders(token) });
        if (!response.ok) throw new Error('Unable to load the latest dashboard summary.');
        const data = await response.json();
        if (active) {
          setOverview({
            stats: { activeScholars: 0, forfeitedAccounts: 0, ...(data.stats || {}) },
            recentApplications: data.recentApplications || [],
            recentActivity: data.recentActivity || [],
          });
          setLoadError('');
          setLastUpdated(new Date());
        }
      } catch (error) {
        console.warn('Unable to load dashboard summary:', error);
        if (active) setLoadError(error.message || 'Unable to load the dashboard summary.');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadOverview();
    const refreshTimer = window.setInterval(loadOverview, 30000);
    return () => { active = false; window.clearInterval(refreshTimer); };
  }, [token, reloadKey]);

  const metrics = [
    { ...superAdminOverview.stats[0], value: String(overview.stats.activeScholars), detail: 'Currently active scholarship accounts' },
    { ...superAdminOverview.stats[1], value: String(overview.stats.forfeitedAccounts), detail: 'Accounts requiring follow-up' },
  ];

  return (
    <div className="super-admin-dashboard admin-overview-dashboard">
      <header className="dashboard-section-header">
        <div><span className="dashboard-overview-eyebrow">PROGRAM OPERATIONS</span><h2>Dashboard Overview</h2><p>Monitor scholarship accounts, recent applications, and program activity.</p></div>
        <div className="dashboard-overview-status"><span className="dashboard-live-indicator"><i />Live data</span><small>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : loading ? 'Updating dashboard…' : 'Update unavailable'}</small></div>
      </header>

      {loadError && <div className="dashboard-overview-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => { setLoading(true); setReloadKey((current) => current + 1); }}>Retry</button></div>}

      <div className="dashboard-stat-grid">
        {metrics.map((stat) => {
          const Icon = stat.icon;
          return <article key={stat.label} className={`dashboard-stat-card dashboard-stat-card-${stat.tone}`}><div><p className="dashboard-stat-label">{stat.label}</p><h3>{loading ? '—' : stat.value}</h3><small>{stat.detail}</small></div><div className={`dashboard-stat-icon dashboard-stat-icon-${stat.accent}`}><Icon size={22} strokeWidth={2.1} /></div></article>;
        })}
      </div>

      <div className="dashboard-overview-grid">
        <section className="dashboard-surface dashboard-recent-applications">
          <div className="dashboard-surface-header"><div><span className="dashboard-panel-icon"><UsersRound size={16} /></span><div><h3>Recent Applications</h3><p>Latest applicant records from the scholarship database.</p></div></div><button className="dashboard-link-button" type="button" onClick={() => onSectionChange?.('Applicants')}>View applicants</button></div>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table dashboard-applications-table"><thead><tr><th>Name</th><th>Control no.</th><th>Status</th></tr></thead><tbody>{overview.recentApplications.map((row) => <tr key={row.controlNo}><td data-label="Applicant">{row.name}</td><td data-label="Control no."><code className="dashboard-control-number">{row.controlNo}</code></td><td data-label="Status"><span className={`dashboard-pill dashboard-pill-${String(row.status).toLowerCase().replace(/\s+/g, '-')}`}>{row.status}</span></td></tr>)}</tbody></table>
            {!loading && !overview.recentApplications.length && <div className="dashboard-panel-empty"><ClipboardList size={21} /><strong>No recent applications</strong><span>New applicant records will appear here.</span></div>}
            {loading && !overview.recentApplications.length && <div className="dashboard-panel-loading"><span />Loading applications…</div>}
          </div>
        </section>

        <section className="dashboard-surface dashboard-recent-activity">
          <div className="dashboard-surface-header"><div><span className="dashboard-panel-icon blue"><Clock3 size={16} /></span><div><h3>Recent Activity</h3><p>Latest recorded system events.</p></div></div><span className="dashboard-record-count">{overview.recentActivity.length} events</span></div>
          <div className="dashboard-activity-list">{overview.recentActivity.map((entry) => <article key={`${entry.title}-${entry.time}`} className="dashboard-activity-row"><div className="dashboard-activity-dot" /><div className="dashboard-activity-copy"><strong>{entry.title}</strong><p>{entry.detail}</p></div><div className="dashboard-activity-meta"><span className="dashboard-activity-tag">{entry.status}</span><small>{formatDashboardTime(entry.time)}</small></div></article>)}</div>
          {!loading && !overview.recentActivity.length && <div className="dashboard-panel-empty compact"><Clock3 size={21} /><strong>No recent activity</strong><span>Recorded system events will appear here.</span></div>}
          {loading && !overview.recentActivity.length && <div className="dashboard-panel-loading"><span />Loading activity…</div>}
        </section>

      </div>

    </div>
  );
}

const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Never';
const formatDateTime = (value) => value ? new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';
const applicantExportColumns = [
  { key: 'name', label: 'Applicant' },
  { key: 'controlNo', label: 'Control Number' },
  { key: 'email', label: 'Email' },
  { key: 'municipality', label: 'Municipality' },
  { key: 'barangay', label: 'Barangay' },
  { key: 'schoolYear', label: 'School Year' },
  { key: 'status', label: 'Status' },
  { key: 'registered', label: 'Registered' },
  { key: 'lastLogin', label: 'Last Login' },
];

function ApplicantsManagement({ token }) {
  const [data, setData] = useState({ stats: { total: 0, scheduled: 0, completed: 0, passed: 0 }, applicants: [] });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All Status');
  const [municipality, setMunicipality] = useState('All Municipalities');
  const [schoolYear, setSchoolYear] = useState('All School Years');
  const [barangay, setBarangay] = useState('All Barangays');
  const [page, setPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'registered', direction: 'desc' });
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/applicants/management`, { headers: authHeaders(token) });
        if (!response.ok) throw new Error('Unable to load applicant records.');
        const nextData = await response.json();
        if (active) { setData(nextData); setLoadError(''); }
      } catch (error) {
        console.warn('Unable to load applicants:', error);
        if (active) setLoadError('Applicant records could not be refreshed. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 30000);
    return () => { active = false; window.clearInterval(timer); };
  }, [token, reloadKey]);

  useEffect(() => {
    if (!selectedApplicant) return undefined;
    const closeOnEscape = (event) => { if (event.key === 'Escape') setSelectedApplicant(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedApplicant]);

  const values = (key) => [...new Set(data.applicants.map((applicant) => applicant[key]).filter(Boolean))].sort();
  const barangayOptions = municipality === 'All Municipalities'
    ? [...new Set(barangaysData.map((item) => item.name))]
    : [...new Set(barangaysData.filter((item) => item.municipalityCode === municipalitiesData.find((item) => item.name === municipality)?.code).map((item) => item.name))];
  const filtered = data.applicants.filter((applicant) => {
    const matchesQuery = `${applicant.name} ${applicant.email} ${applicant.controlNo}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === 'All Status' || applicant.status === status) && (municipality === 'All Municipalities' || applicant.municipality === municipality) && (schoolYear === 'All School Years' || applicant.schoolYear === schoolYear) && (barangay === 'All Barangays' || applicant.barangay === barangay);
  });
  const getSortValue = (applicant, key) => {
    if (key === 'registered' || key === 'lastLogin') return applicant[key] ? new Date(applicant[key]).getTime() : 0;
    return String(applicant[key] || '').toLowerCase();
  };
  const sortedApplicants = [...filtered].sort((left, right) => {
    const leftValue = getSortValue(left, sortConfig.key);
    const rightValue = getSortValue(right, sortConfig.key);
    if (leftValue === rightValue) return 0;
    const comparison = leftValue > rightValue ? 1 : -1;
    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });
  const pageCount = Math.max(1, Math.ceil(sortedApplicants.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedApplicants = sortedApplicants.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const metricCards = [['Total Applicants', data.stats.total, UsersRound, 'users'], ['Scheduled for Exam', data.stats.scheduled, CalendarDays, 'calendar'], ['Exam Completed', data.stats.completed, FileCheck2, 'document'], ['Passed Applicants', data.stats.passed, BadgeCheck, 'passed']];

  const hasActiveFilters = query || status !== 'All Status' || municipality !== 'All Municipalities' || schoolYear !== 'All School Years' || barangay !== 'All Barangays';
  const clearFilters = () => {
    setQuery('');
    setStatus('All Status');
    setMunicipality('All Municipalities');
    setSchoolYear('All School Years');
    setBarangay('All Barangays');
    setPage(1);
  };
  const changeSort = (key) => {
    setSortConfig((current) => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
    setPage(1);
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
  const sortableColumns = [
    ['Applicant', 'name'], ['Control no.', 'controlNo'], ['Email', 'email'], ['Registered', 'registered'], ['Status', 'status'], ['Last login', 'lastLogin'],
  ];

  return <>
    <div className="applicants-management">
      <header className="applicants-heading"><div><span className="applicants-eyebrow">APPLICANT RECORDS</span><h2>Manage Applicants</h2><p>Review registrations, examination progress, and applicant activity.</p></div><button type="button" className="applicants-export" onClick={() => setExportOpen(true)} disabled={!sortedApplicants.length}><Download size={15} />Export CSV</button></header>
      <div className="applicant-metrics">{metricCards.map(([label, value, Icon, tone]) => <article className={tone} key={label}><div><span>{label}</span><strong>{value}</strong><small>{label === 'Total Applicants' ? 'Registered records' : label === 'Scheduled for Exam' ? 'Matched to municipality schedules' : label === 'Exam Completed' ? 'Results submitted' : 'Qualified applicants'}</small></div><i className={`applicant-metric-icon ${tone}`}><Icon size={20} strokeWidth={2.2} /></i></article>)}</div>
      {loadError && <div className="applicants-alert"><TriangleAlert size={17} /><span>{loadError}</span><button type="button" onClick={() => { setLoading(true); setReloadKey((current) => current + 1); }}>Retry</button></div>}
      <section className="applicant-records-panel">
        <div className="applicant-panel-heading"><div><h3>Applicant directory</h3><p>{filtered.length} of {data.stats.total} applicants</p></div>{hasActiveFilters && <button type="button" className="applicant-clear-filters" onClick={clearFilters}><X size={13} />Clear filters</button>}</div>
        <div className="applicant-filters">
          <label className="applicant-filter applicant-search"><span>Search applicants</span><div><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Name, email, or control number" /></div></label>
          <label className="applicant-filter"><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>{['All Status', ...values('status')].map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="applicant-filter"><span>Municipality</span><select value={municipality} onChange={(event) => { setMunicipality(event.target.value); setBarangay('All Barangays'); setPage(1); }}>{['All Municipalities', ...municipalityNames].map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="applicant-filter"><span>School year</span><select value={schoolYear} onChange={(event) => { setSchoolYear(event.target.value); setPage(1); }}>{['All School Years', ...values('schoolYear')].map((option) => <option key={option}>{option}</option>)}</select></label>
          <label className="applicant-filter"><span>Barangay</span><select value={barangay} onChange={(event) => { setBarangay(event.target.value); setPage(1); }}>{['All Barangays', ...barangayOptions].map((option) => <option key={option}>{option}</option>)}</select></label>
        </div>
        <div className="applicant-table-card">
          <table className="applicant-table">
            <thead><tr>{sortableColumns.map(([label, key]) => <th key={key} aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" onClick={() => changeSort(key)}>{label}<ArrowUpDown size={12} /></button></th>)}<th>Action</th></tr></thead>
            <tbody>
              {loading && !data.applicants.length && <tr className="applicant-state-row"><td colSpan="7"><span className="applicant-loading-spinner" />Loading applicant records...</td></tr>}
              {!loading && !loadError && !paginatedApplicants.length && <tr className="applicant-state-row"><td colSpan="7"><Search size={22} /><strong>No applicants found</strong><span>Adjust the current filters to see more records.</span>{hasActiveFilters && <button type="button" onClick={clearFilters}>Clear filters</button>}</td></tr>}
              {paginatedApplicants.map((applicant) => <tr key={applicant.id}>
                <td data-label="Applicant"><div className="applicant-name"><b>{applicant.initials}</b><span><strong>{applicant.name}</strong><small>{applicant.username}</small></span></div></td>
                <td data-label="Control no."><code className="applicant-control-number">{applicant.controlNo}</code></td>
                <td data-label="Email"><span className="applicant-email" title={applicant.email}>{applicant.email}</span></td>
                <td data-label="Registered">{formatDate(applicant.registered)}</td>
                <td data-label="Status"><span className={`applicant-status ${applicant.status.toLowerCase().replace(/\s+/g, '-')}`}>{applicant.status}</span></td>
                <td data-label="Last login">{formatDateTime(applicant.lastLogin)}</td>
                <td data-label="Action"><button type="button" className="applicant-view" aria-label={`View ${applicant.name}`} onClick={() => setSelectedApplicant(applicant)}><Eye size={13} />View</button></td>
              </tr>)}
            </tbody>
          </table>
          {!!sortedApplicants.length && <footer className="applicant-table-footer"><span>Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedApplicants.length)} of {sortedApplicants.length}</span><nav className="applicant-pagination" aria-label="Applicant pages"><button type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>‹</button>{paginationItems.map((item) => typeof item === 'number' ? <button type="button" aria-label={`Page ${item}`} aria-current={item === currentPage ? 'page' : undefined} className={item === currentPage ? 'active' : ''} key={item} onClick={() => setPage(item)}>{item}</button> : <span key={item}>…</span>)}<button type="button" aria-label="Next page" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>›</button></nav></footer>}
        </div>
      </section>
      {exportOpen && <CsvExportModal title="Export applicant records" description="Choose the applicant fields to include. Current filters and sorting will be preserved." columns={applicantExportColumns} rowCount={sortedApplicants.length} onClose={() => setExportOpen(false)} onExport={(columns) => downloadCsv({ filename: `applicants-${new Date().toISOString().slice(0, 10)}.csv`, rows: buildRecordRows(sortedApplicants, columns) })} />}
    </div>
    {selectedApplicant && <div className="applicant-drawer-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedApplicant(null); }}><aside className="applicant-detail-drawer" role="dialog" aria-modal="true" aria-labelledby="applicant-detail-title"><button type="button" className="applicant-drawer-close" onClick={() => setSelectedApplicant(null)} aria-label="Close applicant details"><X size={19} /></button><div className="applicant-drawer-profile"><span className="applicant-drawer-avatar">{selectedApplicant.initials}</span><div><span className="applicants-eyebrow">APPLICANT RECORD</span><h3 id="applicant-detail-title">{selectedApplicant.name}</h3><p>{selectedApplicant.controlNo}</p></div></div><span className={`applicant-status applicant-drawer-status ${selectedApplicant.status.toLowerCase().replace(/\s+/g, '-')}`}>{selectedApplicant.status}</span><div className="applicant-detail-section"><h4>Contact information</h4><dl><div><dt>Email address</dt><dd>{selectedApplicant.email || 'Not provided'}</dd></div><div><dt>Username</dt><dd>{selectedApplicant.username || 'Not available'}</dd></div></dl></div><div className="applicant-detail-section"><h4>Application details</h4><dl><div><dt>Municipality</dt><dd>{selectedApplicant.municipality}</dd></div><div><dt>Barangay</dt><dd>{selectedApplicant.barangay}</dd></div><div><dt>School year</dt><dd>{selectedApplicant.schoolYear}</dd></div></dl></div><div className="applicant-detail-section"><h4>Account activity</h4><dl><div><dt>Registered</dt><dd>{formatDateTime(selectedApplicant.registered)}</dd></div><div><dt>Last login</dt><dd>{formatDateTime(selectedApplicant.lastLogin)}</dd></div></dl></div></aside></div>}
  </>;
}

const examVenueDefaults = {
  Daet: 'Camarines Norte State College',
  Basud: 'Basud National High School',
  Labo: 'Labo Municipal Hall',
  Mercedes: 'Mercedes Central School',
  Paracale: 'Paracale Community Center',
  Vinzons: 'Vinzons Pilot Elementary School',
  'Jose Panganiban': 'J. Panganiban Gymnasium',
  Capalonga: 'Capalonga Municipal Hall',
};

const formatExamScheduleDate = (date) => date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

const formatStoredExamDate = (value, fallback = '') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback || String(value) : formatExamScheduleDate(date);
};

const formatExamDateRange = (startValue, endValue) => {
  if (!startValue) return 'Schedule not set';
  const start = new Date(startValue);
  const end = new Date(endValue || startValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return endValue && endValue !== startValue ? `${startValue} – ${endValue}` : startValue;
  if (start.toDateString() === end.toDateString()) return formatExamScheduleDate(start);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${start.getFullYear()}`;
  }
  return `${formatExamScheduleDate(start)} – ${formatExamScheduleDate(end)}`;
};

const examList = municipalitiesData.map((municipality, index) => ({
  municipality: municipality.name,
  venue: examVenueDefaults[municipality.name] || `${municipality.name} Municipal Hall`,
  date: `July ${12 + index}, 2026`,
  endDate: `July ${12 + index}, 2026`,
}));

function ExaminationManagement({ token }) {
  const [examinations, setExaminations] = useState(() => {
    try {
      const savedExaminations = JSON.parse(localStorage.getItem('examVenueData') || 'null');
      const savedThumbnails = JSON.parse(localStorage.getItem('examVenueThumbnails') || '{}');
      if (Array.isArray(savedExaminations)) {
        return examList.map((exam, index) => {
          const saved = savedExaminations[index] || {};
          const date = saved.date || exam.date;
          return { ...exam, ...saved, date, endDate: saved.endDate || date, thumbnail: saved.thumbnail || savedThumbnails[exam.municipality] || '' };
        });
      }
      return examList.map((exam) => ({ ...exam, thumbnail: savedThumbnails[exam.municipality] || '' }));
    } catch {
      return examList;
    }
  });
  const [applicants, setApplicants] = useState([]);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const [selectedExam, setSelectedExam] = useState(null);
  const [examQuery, setExamQuery] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState('all');
  const [showDeactivateAllDialog, setShowDeactivateAllDialog] = useState(false);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [scheduleSaveError, setScheduleSaveError] = useState('');
  const [activeExamMunicipalities, setActiveExamMunicipalities] = useState(() => {
    try { return JSON.parse(localStorage.getItem('activeExamMunicipalities') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/examinations/management`, { headers: authHeaders(token), cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load the saved examination schedules.');
        return response.json();
      })
      .then((payload) => {
        if (!active) return;
        const savedSchedules = Array.isArray(payload?.examinations) ? payload.examinations : [];
        if (savedSchedules.length) {
          const scheduleByMunicipality = new Map(savedSchedules.map((exam) => [exam.municipality, exam]));
          setExaminations((current) => examList.map((defaultExam) => {
            const localExam = current.find((exam) => exam.municipality === defaultExam.municipality) || defaultExam;
            const savedExam = scheduleByMunicipality.get(defaultExam.municipality);
            if (!savedExam) return localExam;
            const date = formatStoredExamDate(savedExam.date, localExam.date);
            return {
              ...localExam,
              venue: savedExam.venue || localExam.venue,
              date,
              endDate: formatStoredExamDate(savedExam.endDate, date),
            };
          }));
          setActiveExamMunicipalities(savedSchedules.filter((exam) => exam.isActive).map((exam) => exam.municipality));
        }
        setScheduleSaveError('');
      })
      .catch((error) => {
        if (active) setScheduleSaveError(`${error.message || 'Unable to load examination schedules'} Local schedule data remains available.`);
      })
      .finally(() => { if (active) setScheduleReady(true); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!scheduleReady) return undefined;
    const saveTimer = window.setTimeout(() => {
      fetch(`${API_BASE}/examinations/management`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders(token) },
        body: JSON.stringify({
          examinations: examinations.map((exam) => ({
            municipality: exam.municipality,
            venue: exam.venue,
            date: exam.date,
            endDate: exam.endDate || exam.date,
            isActive: activeExamMunicipalities.includes(exam.municipality),
          })),
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || 'Unable to save examination schedules.');
          }
          setScheduleSaveError('');
        })
        .catch((error) => setScheduleSaveError(error.message || 'Unable to save examination schedules.'));
    }, 450);
    return () => window.clearTimeout(saveTimer);
  }, [activeExamMunicipalities, examinations, scheduleReady, token]);

  useEffect(() => {
    if (!showDeactivateAllDialog) return undefined;
    const closeDialog = (event) => {
      if (event.key === 'Escape') setShowDeactivateAllDialog(false);
    };
    window.addEventListener('keydown', closeDialog);
    return () => window.removeEventListener('keydown', closeDialog);
  }, [showDeactivateAllDialog]);

  const toggleExamActivation = (municipality) => {
    setActiveExamMunicipalities((current) => {
      const next = current.includes(municipality)
        ? current.filter((item) => item !== municipality)
        : [...current, municipality];
      localStorage.setItem('activeExamMunicipalities', JSON.stringify(next));
      const exam = examinations.find((item) => item.municipality === municipality);
      if (exam && !current.includes(municipality)) localStorage.setItem('activeExamDetails', JSON.stringify({ municipality: exam.municipality, venue: exam.venue, date: exam.date, endDate: exam.endDate || exam.date }));
      if (current.includes(municipality)) localStorage.removeItem('activeExamDetails');
      window.dispatchEvent(new Event('exam-activation-changed'));
      return next;
    });
  };

  const allExaminationsActive = examinations.length > 0
    && examinations.every((exam) => activeExamMunicipalities.includes(exam.municipality));

  const applyAllExamActivation = (activate) => {
    const next = activate
      ? [...new Set(examinations.map((exam) => exam.municipality))]
      : [];
    setActiveExamMunicipalities(next);
    localStorage.setItem('activeExamMunicipalities', JSON.stringify(next));
    if (activate && examinations[0]) {
      const firstExam = examinations[0];
      localStorage.setItem('activeExamDetails', JSON.stringify({ municipality: firstExam.municipality, venue: firstExam.venue, date: firstExam.date, endDate: firstExam.endDate || firstExam.date }));
    } else {
      localStorage.removeItem('activeExamDetails');
    }
    window.dispatchEvent(new Event('exam-activation-changed'));
  };

  const setAllExamActivation = (activate) => {
    if (!activate && activeExamMunicipalities.length > 0) {
      setShowDeactivateAllDialog(true);
      return;
    }
    applyAllExamActivation(activate);
  };

  useEffect(() => {
    try {
      localStorage.setItem('examVenueData', JSON.stringify(examinations));
      window.dispatchEvent(new Event('exam-schedule-changed'));
    } catch {
      // Large base64 thumbnails can exceed browser storage limits. Preserve text data.
      try {
        const textOnlyExaminations = examinations.map((exam) => {
          const textOnlyExam = { ...exam };
          delete textOnlyExam.thumbnail;
          return textOnlyExam;
        });
        localStorage.removeItem('examVenueData');
        localStorage.setItem('examVenueData', JSON.stringify(textOnlyExaminations));
      } catch {
        // Storage is optional; the current React state remains usable.
      }
    }
  }, [examinations]);

  const updateThumbnail = (index, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setExaminations((current) => current.map((exam, examIndex) => (
        examIndex === index ? { ...exam, thumbnail: reader.result } : exam
      )));
      try {
        const savedThumbnails = JSON.parse(localStorage.getItem('examVenueThumbnails') || '{}');
        savedThumbnails[examinations[index].municipality] = reader.result;
        localStorage.setItem('examVenueThumbnails', JSON.stringify(savedThumbnails));
      } catch {
        // Keep the preview available for the current session if storage is unavailable.
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/applicants/management`, { headers: authHeaders(token) })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active) setApplicants(data?.applicants || []); })
      .catch(() => { if (active) setApplicants([]); });
    return () => { active = false; };
  }, [token]);

  const beginEdit = (index, field) => {
    setEditing({ index, field });
    setDraft(examinations[index][field]);
  };

  const saveEdit = () => {
    if (!editing) return;
    const value = draft.trim();
    if (value) {
      setExaminations((current) => current.map((exam, index) => (
        index === editing.index ? { ...exam, [editing.field]: value } : exam
      )));
    }
    setEditing(null);
  };

  const renderEditable = (index, field, className = '') => {
    const isEditing = editing?.index === index && editing?.field === field;
    if (isEditing) {
      if (field === 'date') {
        const startDate = new Date(examinations[index].date);
        const endDate = examinations[index].endDate ? new Date(examinations[index].endDate) : null;
        return <DatePicker className={`exam-inline-input ${className}`} startDate={Number.isNaN(startDate.getTime()) ? null : startDate} endDate={endDate && !Number.isNaN(endDate.getTime()) ? endDate : null} onChange={([start, end]) => { if (start) { setExaminations((current) => current.map((exam, examIndex) => examIndex === index ? { ...exam, date: formatExamScheduleDate(start), endDate: end ? formatExamScheduleDate(end) : '' } : exam)); if (end) setEditing(null); } }} selectsRange dateFormat="MMMM d, yyyy" autoFocus popperPlacement="top-start" placeholderText="Select start and end dates" />;
      }
      return <input className={`exam-inline-input ${className}`} value={draft} autoFocus onChange={(event) => setDraft(event.target.value)} onBlur={saveEdit} onKeyDown={(event) => { if (event.key === 'Enter') saveEdit(); if (event.key === 'Escape') setEditing(null); }} />;
    }
    return <button type="button" className={`exam-editable ${className}`} onClick={() => beginEdit(index, field)}><span>{field === 'date' ? formatExamDateRange(examinations[index].date, examinations[index].endDate) : examinations[index][field]}</span><FilePenLine size={13} aria-hidden="true" /></button>;
  };

  const normalizedExamQuery = examQuery.trim().toLowerCase();
  const filteredExaminations = examinations
    .map((exam, index) => ({ exam, index }))
    .filter(({ exam }) => {
      const isActive = activeExamMunicipalities.includes(exam.municipality);
      const matchesStatus = examStatusFilter === 'all'
        || (examStatusFilter === 'active' && isActive)
        || (examStatusFilter === 'inactive' && !isActive);
      const matchesQuery = !normalizedExamQuery
        || exam.municipality.toLowerCase().includes(normalizedExamQuery)
        || exam.venue.toLowerCase().includes(normalizedExamQuery);
      return matchesStatus && matchesQuery;
    });

  const assignedApplicants = applicants.filter((applicant) => (
    examinations.some((exam) => exam.municipality === applicant.municipality)
  )).length;

  return (
    <div className="examination-management">
      <header className="exam-page-heading">
        <div>
          <span className="exam-page-eyebrow">EXAMINATION OPERATIONS</span>
          <h2>Examination Management</h2>
          <p>Manage venue schedules, assigned applicants, and examination access in one place.</p>
        </div>
        <div className="exam-heading-summary"><span>{activeExamMunicipalities.length} of {examinations.length}</span><small>examinations active</small></div>
      </header>
      {scheduleSaveError && <div className="dashboard-overview-alert"><TriangleAlert size={17} /><span>{scheduleSaveError}</span></div>}
      <div className="exam-status-grid">
        <article className="total"><div className="exam-stat-icon"><ClipboardList size={20} /></div><div><span>Total Venues</span><strong>{examinations.length}</strong><small>Configured examination locations</small></div></article>
        <article className="active"><div className="exam-stat-icon"><Power size={20} /></div><div><span>Active Examinations</span><strong>{activeExamMunicipalities.length}</strong><small>Currently accessible to applicants</small></div></article>
        <article className="assigned"><div className="exam-stat-icon"><UsersRound size={20} /></div><div><span>Assigned Applicants</span><strong>{assignedApplicants}</strong><small>Matched to an examination venue</small></div></article>
      </div>
      <div className="exam-list-heading">
        <div><h3>Examination venues</h3><p>{filteredExaminations.length} {filteredExaminations.length === 1 ? 'venue' : 'venues'} shown</p></div>
        <div className="exam-master-control" role="group" aria-label="Control all examinations">
          <div><span>Global examination access</span><small>{allExaminationsActive ? 'All venues are active' : activeExamMunicipalities.length ? `${activeExamMunicipalities.length} of ${examinations.length} venues active` : 'All venues are inactive'}</small></div>
          <button type="button" className="activate" onClick={() => setAllExamActivation(true)} disabled={allExaminationsActive}><Power size={14} />Activate all</button>
          <button type="button" className="deactivate" onClick={() => setAllExamActivation(false)} disabled={!activeExamMunicipalities.length}><Power size={14} />Deactivate all</button>
        </div>
      </div>
      <section className="exam-list-panel">
        <div className="exam-toolbar">
          <label className="exam-search"><Search size={16} aria-hidden="true" /><input value={examQuery} onChange={(event) => setExamQuery(event.target.value)} placeholder="Search municipality or venue" aria-label="Search examination venues" /></label>
          <select value={examStatusFilter} onChange={(event) => setExamStatusFilter(event.target.value)} aria-label="Filter examinations by activation status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Not active</option></select>
        </div>
        <div className="exam-card-grid">
          {filteredExaminations.map(({ exam, index }) => {
            const isActive = activeExamMunicipalities.includes(exam.municipality);
            const venueApplicantCount = applicants.filter((applicant) => applicant.municipality === exam.municipality).length;
            return (
            <article className={`exam-card ${isActive ? 'is-active' : ''}`} key={`${exam.municipality}-${index}`}>
              <div className="exam-thumbnail">
                {exam.thumbnail ? <img src={exam.thumbnail} alt={`${exam.municipality} venue`} /> : <div className="exam-thumbnail-placeholder"><School size={24} /><span>Venue photo</span></div>}
                <span className={`exam-status-badge ${isActive ? 'active' : ''}`}><i aria-hidden="true" />{isActive ? 'Active' : 'Not active'}</span>
                <label className="exam-thumbnail-upload" htmlFor={`exam-thumbnail-${index}`} aria-label={`Upload thumbnail for ${exam.municipality}`}><FilePenLine size={14} /><span>{exam.thumbnail ? 'Change' : 'Add photo'}</span></label>
                <input id={`exam-thumbnail-${index}`} type="file" accept="image/*" onChange={(event) => updateThumbnail(index, event.target.files?.[0])} />
              </div>
              <div className="exam-card-content">
                <div className="exam-card-title"><h4>{renderEditable(index, 'municipality')}</h4><span>{venueApplicantCount} {venueApplicantCount === 1 ? 'applicant' : 'applicants'}</span></div>
                <div className="exam-detail-row"><MapPin size={16} aria-hidden="true" /><div><small>Venue</small>{renderEditable(index, 'venue')}</div></div>
                <div className="exam-detail-row"><CalendarDays size={16} aria-hidden="true" /><div><small>Examination date range</small>{renderEditable(index, 'date')}</div></div>
                <div className="exam-card-actions"><button type="button" className={`exam-toggle-button ${isActive ? 'active' : ''}`} onClick={() => toggleExamActivation(exam.municipality)}><Power size={14} />{isActive ? 'Deactivate' : 'Activate'}</button><button type="button" className="exam-view-button" onClick={() => setSelectedExam(exam)}><Eye size={15} />View applicants</button></div>
              </div>
            </article>
          );})}
          {!filteredExaminations.length && <div className="exam-no-results"><Search size={24} /><strong>No examination venues found</strong><span>Try another search term or status filter.</span><button type="button" onClick={() => { setExamQuery(''); setExamStatusFilter('all'); }}>Clear filters</button></div>}
        </div>
      </section>
      {selectedExam && (
        <div className="exam-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedExam(null); }}>
          <section className="exam-applicant-modal" role="dialog" aria-modal="true" aria-labelledby="exam-applicant-modal-title">
            <div className="exam-modal-header"><div><span>ASSIGNED APPLICANTS</span><h3 id="exam-applicant-modal-title">{selectedExam.municipality}</h3><p>{selectedExam.venue} · {formatExamDateRange(selectedExam.date, selectedExam.endDate)}</p></div><button type="button" className="exam-modal-close" onClick={() => setSelectedExam(null)} aria-label="Close applicant list">×</button></div>
            <div className="exam-activation-panel"><div><strong>Exam Activation</strong><small>{activeExamMunicipalities.includes(selectedExam.municipality) ? 'Applicants can access this examination.' : 'Applicants cannot access this examination yet.'}</small></div><button type="button" className={`exam-activation-button ${activeExamMunicipalities.includes(selectedExam.municipality) ? 'active' : ''}`} onClick={() => toggleExamActivation(selectedExam.municipality)}>{activeExamMunicipalities.includes(selectedExam.municipality) ? 'Deactivate Exam' : 'Activate Exam'}</button></div>
            <div className="exam-applicant-list">{applicants.filter((applicant) => applicant.municipality === selectedExam.municipality).length ? applicants.filter((applicant) => applicant.municipality === selectedExam.municipality).map((applicant) => <div className="exam-applicant-row" key={applicant.id}><span className="exam-applicant-avatar">{applicant.initials || applicant.name?.slice(0, 2).toUpperCase() || 'AP'}</span><div><strong>{applicant.name || 'Unnamed applicant'}</strong><small>{applicant.email || applicant.controlNo || 'No contact information'}</small></div><span className="exam-applicant-status">Assigned</span></div>) : <p className="exam-empty-state">No applicants are currently assigned to this venue.</p>}</div>
          </section>
        </div>
      )}
      {showDeactivateAllDialog && (
        <div className="admin-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDeactivateAllDialog(false); }}>
          <section className="admin-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="deactivate-all-title" aria-describedby="deactivate-all-description">
            <div className="admin-confirm-icon warning"><TriangleAlert size={24} /></div>
            <div className="admin-confirm-copy">
              <span>GLOBAL EXAMINATION ACCESS</span>
              <h3 id="deactivate-all-title">Deactivate all examinations?</h3>
              <p id="deactivate-all-description">Applicants in every municipality will immediately lose access to their examinations. You can activate the venues again at any time.</p>
            </div>
            <div className="admin-confirm-actions">
              <button type="button" className="cancel" onClick={() => setShowDeactivateAllDialog(false)}>Keep examinations active</button>
              <button type="button" className="danger" onClick={() => { applyAllExamActivation(false); setShowDeactivateAllDialog(false); }}><Power size={15} />Deactivate all</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ExaminationWorkspace({ token, initialView = 'schedules' }) {
  const [view, setView] = useState(initialView);
  return (
    <div className="examination-workspace">
      <nav className="examination-workspace-tabs" aria-label="Examination management views">
        <button type="button" className={view === 'schedules' ? 'active' : ''} onClick={() => setView('schedules')}>Schedules & assignments</button>
        <button type="button" className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>Results</button>
      </nav>
      {view === 'schedules' ? <ExaminationManagement token={token} /> : <ResultsManagement token={token} />}
    </div>
  );
}

function Dashboard({ activeSection = 'Dashboard', user, token, onSectionChange, onLogout }) {
  if (activeSection === 'Dashboard' && ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'].includes(user?.role)) {
    return <DashboardOverview token={token} onSectionChange={onSectionChange} />;
  }
  if (activeSection === 'Applicants' && ['SuperAdmin', 'RegularAdmin', 'BillingPayrollAdmin'].includes(user?.role)) return <ApplicantsManagement token={token} />;
  if (activeSection === 'Examination Management' || activeSection === 'Results Management') return <ExaminationWorkspace token={token} initialView={activeSection === 'Results Management' ? 'results' : 'schedules'} />;
  if (activeSection === 'Scholars') return <ScholarsManagement token={token} />;
  if (activeSection === 'Billing') return <BillingPayrollManagement key="billing" token={token} mode="billing" userRole={user?.role} />;
  if (activeSection === 'Payroll') return <BillingPayrollManagement key="payroll" token={token} mode="payroll" userRole={user?.role} />;
  if (activeSection === 'Announcements') return <AnnouncementsManagement token={token} />;
  if (activeSection === 'Activity Logs' && user?.role === 'SuperAdmin') return <ActivityLogsManagement token={token} />;
  if (activeSection === 'Staff' && user?.role === 'SuperAdmin') return <StaffManagement token={token} onLogout={onLogout} />;
  if (activeSection === 'Document Reviews' && ['Moderator', 'SuperAdmin'].includes(user?.role)) return <DocumentReviewManagement token={token} />;
  if (activeSection === 'School Catalog' && user?.role === 'SuperAdmin') return <SchoolCatalogManagement token={token} />;
  if (activeSection === 'Reports') return <ReportsManagement token={token} />;
  if (activeSection === 'Settings') return <SettingsManagement token={token} user={user} />;

  const view = sectionViews[activeSection] || sectionViews.Dashboard;

  return (
    <div className="dashboard-shell">
      <div className="dashboard-grid">
        {view.metrics.map((item) => (
          <article key={item.label} className="dashboard-card">
            <div className={`dashboard-card-icon dashboard-card-icon-${item.tone}`}>
              <IconForMetric label={item.label} />
            </div>
            <div>
              <p className="dashboard-card-label">{item.label}</p>
              <h3>{item.value}</h3>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-panel-grid">
        <section className="dashboard-panel">
          <div className="panel-heading">
            <h3>{view.primaryTitle}</h3>
            <a href="#">{view.primaryLink}</a>
          </div>
          <ul className="activity-list">
            {view.primaryItems.map((item) => (
              <li key={item.name} className="activity-item">
                <div>
                  <strong>{item.name}</strong>
                  <p>{item.detail}</p>
                </div>
                <div className="activity-meta">
                  <span className={`status-badge status-badge-${item.status.toLowerCase().replace(/\s+/g, '-')}`}>
                    {item.status}
                  </span>
                  <small>{item.time}</small>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <h3>{view.secondaryTitle}</h3>
          </div>
          <div className="focus-card">
            <div className="focus-pill">{view.secondaryTag}</div>
            <h4>{view.secondaryHeadline}</h4>
            <p>{view.secondaryText}</p>
          </div>
          <div className="focus-list">
            {view.secondaryItems.map((item) => (
              <div key={item} className="focus-row">
                <span>•</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function IconForMetric({ label }) {
  const Icon = metricIconByLabel[label] || Info;
  return <Icon aria-hidden="true" size={20} strokeWidth={2.25} />;
}

export default Dashboard;

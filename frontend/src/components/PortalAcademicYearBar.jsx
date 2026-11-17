import { CalendarDays } from 'lucide-react';
import '../styles/portal-academic-year.css';

export default function PortalAcademicYearBar({ period, loading = false, unavailable = false }) {
  const schoolYear = period?.schoolYear;
  const value = loading ? 'Loading…'
    : unavailable ? 'Unavailable'
      : schoolYear ? `${schoolYear}${period.semester ? ` · ${period.semester}` : ''}`
        : period === null ? 'Not configured' : 'Unavailable';

  return (
    <section className={`portal-academic-year-bar${loading || unavailable || !schoolYear ? ' is-unavailable' : ''}`} role="status" aria-live="polite" aria-atomic="true">
      <span className="portal-academic-year-label"><CalendarDays size={16} aria-hidden="true" />Current Academic Year</span>
      <strong>{value}</strong>
    </section>
  );
}

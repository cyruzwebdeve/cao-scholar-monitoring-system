import { CalendarDays, MapPin, Info } from 'lucide-react';
import { scheduleTime, PAYOUT_CLAIM_NOTICE } from '../utils/payoutSchedules';
import './PayoutSchedules.css';
export default function PayoutScheduleCard({ schedule, reference, children, preview = false }) {
  const cancelled = schedule.status === 'cancelled';
  const date = new Date(schedule.startsAt);
  const validDate = schedule.startsAt && Number.isFinite(+date);
  const month = validDate ? date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', month: 'short' }) : '--';
  const day = validDate ? date.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', day: '2-digit' }) : '--';
  const context = [reference || schedule.reference, schedule.schoolYear, schedule.semester].filter(Boolean).join(' / ');
  return <article className={`payout-schedule-card payout-ticket ${cancelled ? 'is-cancelled' : ''}`}>
    <header><div className="payout-ticket-heading"><div className="payout-date-stamp" aria-hidden="true"><span>{month}</span><strong>{day}</strong></div><div><small>{context}</small><h3>{schedule.title}</h3></div></div><span className={`payout-status payout-status--${preview ? 'draft' : schedule.status}`}>{preview ? 'Preview' : cancelled ? 'Cancelled' : schedule.status === 'draft' ? 'Draft' : 'Published'}</span></header>
    <div className="payout-card-facts">
      <div className="payout-card-detail"><CalendarDays size={18} aria-hidden="true" /><div><span className="payout-detail-label">Date &amp; time</span><p>{scheduleTime(schedule.startsAt)}{schedule.endsAt ? ` - ${scheduleTime(schedule.endsAt)}` : ''}</p><small>Philippine time</small></div></div>
      <div className="payout-card-detail"><MapPin size={18} aria-hidden="true" /><div><span className="payout-detail-label">Venue</span><p>{schedule.venue}</p></div></div>
    </div>
    {schedule.instructions && <div className="payout-instructions"><span className="payout-detail-label">Instructions</span><p>{schedule.instructions}</p></div>}
    {!cancelled && <aside className="payout-claim-notice"><Info size={18} aria-hidden="true" /><div><strong>Important notice:</strong><p>{PAYOUT_CLAIM_NOTICE}</p></div></aside>}
    {cancelled && <p className="payout-cancel-note"><strong>This schedule is cancelled.</strong> {schedule.cancellationReason}</p>}
    {children}
  </article>;
}

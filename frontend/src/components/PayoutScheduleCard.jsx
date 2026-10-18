import { CalendarDays, MapPin, Info } from 'lucide-react';
import { scheduleTime, PAYOUT_CLAIM_NOTICE } from '../utils/payoutSchedules';
import './PayoutSchedules.css';
export default function PayoutScheduleCard({ schedule, reference, children, preview = false }) {
  const cancelled = schedule.status === 'cancelled';
  const context = [reference || schedule.reference, schedule.schoolYear, schedule.semester].filter(Boolean).join(' / ');
  return <article className={`payout-schedule-card ${cancelled ? 'is-cancelled' : ''}`}>
    <header><div><small>{context}</small><h3>{schedule.title}</h3></div><span className={`payout-status payout-status--${preview ? 'draft' : schedule.status}`}>{preview ? 'Preview' : cancelled ? 'Cancelled' : schedule.status === 'draft' ? 'Draft' : 'Published'}</span></header>
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

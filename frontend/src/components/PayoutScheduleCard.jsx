import { CalendarDays, MapPin } from 'lucide-react';
import { scheduleTime } from '../utils/payoutSchedules';
import './PayoutSchedules.css';
export default function PayoutScheduleCard({ schedule, reference, children, preview = false }) {
  const cancelled = schedule.status === 'cancelled';
  return <article className={`payout-schedule-card ${cancelled ? 'is-cancelled' : ''}`}>
    <header><div><small>{reference || schedule.reference} · {schedule.schoolYear} {schedule.semester}</small><h3>{schedule.title}</h3></div><span className={`payout-status payout-status--${preview ? 'draft' : schedule.status}`}>{preview ? 'Preview' : cancelled ? 'Cancelled' : schedule.status === 'draft' ? 'Draft' : 'Published'}</span></header>
    <p className="payout-card-detail"><CalendarDays size={17} aria-hidden="true" /><span>{scheduleTime(schedule.startsAt)}{schedule.endsAt ? ` – ${scheduleTime(schedule.endsAt)}` : ''}<small>Philippine time</small></span></p>
    <p className="payout-card-detail"><MapPin size={17} aria-hidden="true" /><span>{schedule.venue}</span></p>
    {schedule.instructions && <p className="payout-instructions">{schedule.instructions}</p>}
    {cancelled && <p className="payout-cancel-note"><strong>This schedule is cancelled.</strong> {schedule.cancellationReason}</p>}
    {children}
  </article>;
}

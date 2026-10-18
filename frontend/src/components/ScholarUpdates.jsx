import { Bell, ChevronRight, ExternalLink, Info, CalendarDays } from 'lucide-react';

import { PAYOUT_CLAIM_NOTICE } from '../utils/payoutSchedules';
import './PayoutNotice.css';

const postedDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(+date) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
};

export default function ScholarUpdates({ personal, announcement, onMarkRead, onOpenHistory }) {
  const schedule = personal?.type === 'payout_schedule';
  const hasClaimNotice = schedule && personal.message?.includes(PAYOUT_CLAIM_NOTICE);
  const message = hasClaimNotice ? personal.message.replace(PAYOUT_CLAIM_NOTICE, '').trim() : personal?.message;
  return <section id="scholar-updates" tabIndex={-1} className="scholar-panel scholar-updates" aria-labelledby="scholar-updates-title">
    <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">STAY INFORMED</p><h2 id="scholar-updates-title">Updates &amp; announcements</h2></div><button type="button" className="scholar-history-button" onClick={onOpenHistory}><Bell size={15} aria-hidden="true" />Notification history</button></div>
    {personal && <article className={`scholar-update-item personal-notice ${schedule ? 'scholar-payout-notice' : ''}`}>
      <div className="scholar-update-meta"><span className="scholar-update-label">{schedule ? 'PAYOUT SCHEDULE UPDATE' : 'PERSONAL UPDATE'}</span><time>{postedDate(personal.createdAt)}</time></div>
      <div className="scholar-personal-heading">{schedule && <span className="scholar-payout-icon"><CalendarDays size={24} aria-hidden="true" /></span>}<div><p className="scholar-update-kicker">Your latest update</p><h3>{personal.title}</h3></div></div>
      <div className={`scholar-personal-content ${hasClaimNotice ? 'has-reminder' : ''}`}>
      <p className="scholar-personal-message">{message}</p>
      {hasClaimNotice && <aside className="scholar-payout-reminder"><Info size={18} aria-hidden="true" /><div><strong>Important notice</strong><p>{PAYOUT_CLAIM_NOTICE}</p></div></aside>}
      </div>
      <footer className="scholar-personal-footer">{personal.reference && <small className="scholar-update-reference">List reference: <strong>{personal.reference}</strong></small>}{!personal.isRead && <button type="button" className="scholar-text-button" onClick={() => onMarkRead(personal.id)}>Mark as read <ChevronRight size={15} aria-hidden="true" /></button>}</footer>
    </article>}
    {announcement && <article className={`scholar-update-item priority-${announcement.priority || 'normal'}`}><div className="scholar-update-meta"><span className="scholar-update-label">CAO ANNOUNCEMENT</span><span>{announcement.priority === 'urgent' ? 'Urgent' : announcement.priority === 'high' ? 'Important' : 'General'}</span></div><h3>{announcement.title}</h3><p>{announcement.content}</p>{announcement.imageData && <img className="portal-announcement-image" src={announcement.imageData} alt={announcement.imageName || announcement.title} loading="lazy" />}{announcement.externalUrl && <a href={announcement.externalUrl} target="_blank" rel="noopener noreferrer" className="scholar-text-button">View official Facebook post <ExternalLink size={15} aria-hidden="true" /></a>}</article>}
    {!personal && !announcement && <div className="scholar-updates-empty"><Bell size={23} aria-hidden="true" /><div><strong>No new updates to show</strong><p>New CAO announcements and personal schedule notices will appear here.</p></div></div>}
  </section>;
}

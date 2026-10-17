import { Bell, ChevronRight, ExternalLink } from 'lucide-react';

const postedDate = value => {
  const date = new Date(value);
  return value && Number.isFinite(+date) ? date.toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable';
};

export default function ScholarUpdates({ personal, announcement, onMarkRead, onOpenHistory }) {
  const schedule = personal?.type === 'payout_schedule';
  return <section className="scholar-panel scholar-updates" aria-labelledby="scholar-updates-title">
    <div className="scholar-panel-heading"><div><p className="scholar-eyebrow">STAY INFORMED</p><h2 id="scholar-updates-title">Updates &amp; announcements</h2></div><button type="button" className="scholar-history-button" onClick={onOpenHistory}><Bell size={15} aria-hidden="true" />Notification history</button></div>
    {personal && <article className="scholar-update-item personal-notice"><div className="scholar-update-meta"><span className="scholar-update-label">{schedule ? 'PAYOUT SCHEDULE UPDATE' : 'PERSONAL UPDATE'}</span><time>{postedDate(personal.createdAt)}</time></div><p className="scholar-update-kicker">Your latest update</p><h3>{personal.title}</h3><p>{personal.message}</p>{personal.reference && <small className="scholar-update-reference">List reference: {personal.reference}</small>}{!personal.isRead && <button type="button" className="scholar-text-button" onClick={() => onMarkRead(personal.id)}>Mark as read <ChevronRight size={15} aria-hidden="true" /></button>}</article>}
    {announcement && <article className={`scholar-update-item priority-${announcement.priority || 'normal'}`}><div className="scholar-update-meta"><span className="scholar-update-label">CAO ANNOUNCEMENT</span><span>{announcement.priority === 'urgent' ? 'Urgent' : announcement.priority === 'high' ? 'Important' : 'General'}</span></div><h3>{announcement.title}</h3><p>{announcement.content}</p>{announcement.imageData && <img className="portal-announcement-image" src={announcement.imageData} alt={announcement.imageName || announcement.title} loading="lazy" />}{announcement.externalUrl && <a href={announcement.externalUrl} target="_blank" rel="noopener noreferrer" className="scholar-text-button">View official Facebook post <ExternalLink size={15} aria-hidden="true" /></a>}</article>}
    {!personal && !announcement && <div className="scholar-updates-empty"><Bell size={23} aria-hidden="true" /><div><strong>No new updates to show</strong><p>New CAO announcements and personal schedule notices will appear here.</p></div></div>}
  </section>;
}

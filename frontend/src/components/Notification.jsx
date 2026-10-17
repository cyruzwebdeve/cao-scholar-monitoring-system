import { BadgeCheck, Info, LoaderCircle, TriangleAlert, X } from 'lucide-react';
import './Notification.css';

const variants = {
  success: { Icon: BadgeCheck, title: 'Completed' },
  error: { Icon: TriangleAlert, title: 'Unable to complete action' },
  warning: { Icon: TriangleAlert, title: 'Attention needed' },
  info: { Icon: Info, title: 'Please note' },
  progress: { Icon: LoaderCircle, title: 'Processing' },
};

export default function Notification({ tone = 'info', title, children, onDismiss, action }) {
  const variant = variants[tone] || variants.info;
  const { Icon } = variant;
  return <div className={`system-notice system-notice--${variants[tone] ? tone : 'info'}`} role={tone === 'error' ? 'alert' : 'status'} aria-atomic="true">
    <span className="system-notice-icon" aria-hidden="true"><Icon size={18} /></span>
    <div className="system-notice-copy"><strong>{title || variant.title}</strong><div className="system-notice-message">{children}</div></div>
    {onDismiss && <button type="button" className="system-notice-dismiss" aria-label="Dismiss notification" onClick={onDismiss}><X size={16} aria-hidden="true" /></button>}
    {action && <div className="system-notice-actions">{action}</div>}
  </div>;
}

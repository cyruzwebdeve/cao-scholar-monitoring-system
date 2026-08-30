import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ListChecks,
} from 'lucide-react';
import '../styles/portal-guidance.css';

const formatGuidanceDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const stateCopy = {
  action_required: 'ACTION NEEDED',
  waiting: 'WAITING FOR CAO',
  complete: 'UP TO DATE',
};

function PortalGuidance({ guidance, resolveRoute, children }) {
  if (!guidance) return null;

  const tone = ['action_required', 'waiting', 'complete'].includes(guidance.state)
    ? guidance.state
    : 'waiting';
  const StateIcon = tone === 'action_required'
    ? AlertCircle
    : tone === 'complete'
      ? CheckCircle2
      : Clock3;

  return (
    <section className={`portal-guidance portal-guidance-${tone}`} aria-labelledby="portal-guidance-title">
      <div className="portal-guidance-heading">
        <div>
          <p>{stateCopy[tone]}</p>
          <h2 id="portal-guidance-title">{guidance.headline}</h2>
        </div>
        <span className="portal-guidance-state-icon"><StateIcon size={21} aria-hidden="true" /></span>
      </div>
      <p className="portal-guidance-description">{guidance.description}</p>
      {children}

      <div className="portal-guidance-actions" aria-label="Personalized next actions">
        {(guidance.actions || []).map((action) => {
          const href = resolveRoute?.(action.route, action) || null;
          return (
            <article className={`portal-guidance-action priority-${action.priority || 'normal'}`} key={action.id}>
              <span className="portal-guidance-action-icon"><ListChecks size={17} aria-hidden="true" /></span>
              <div>
                <strong>{action.title}</strong>
                <span>{action.description}</span>
              </div>
              {href && <a href={href}>Open <ChevronRight size={15} aria-hidden="true" /></a>}
            </article>
          );
        })}
      </div>

      {guidance.timeline?.length > 0 && (
        <div className="portal-guidance-timeline" aria-label="Scholarship application timeline">
          <h3>Your application timeline</h3>
          <ol>
            {guidance.timeline.map((item) => {
              const completedDate = formatGuidanceDate(item.completedAt);
              return (
                <li className={`portal-guidance-stage ${item.status}`} key={item.id}>
                  <span className="portal-guidance-stage-marker" aria-hidden="true">
                    {item.status === 'completed' ? <CheckCircle2 size={16} /> : item.status === 'current' ? <span /> : null}
                  </span>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{completedDate || item.detail}</span>
                  </div>
                  <em>{item.status === 'completed' ? 'Completed' : item.status === 'current' ? 'Current' : 'Upcoming'}</em>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}

export default PortalGuidance;

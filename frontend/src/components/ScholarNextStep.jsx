import { ArrowRight, CheckCircle2, Clock3, FileCheck2 } from 'lucide-react';

export default function ScholarNextStep({ step, timeline = [], onOpenRequirements }) {
  const Icon = step.tone === 'complete' ? CheckCircle2 : step.tone === 'attention' ? FileCheck2 : Clock3;
  return <section id="scholar-next-step" tabIndex={-1} className={`scholar-next-step tone-${step.tone}`} aria-labelledby="scholar-next-step-title">
    <div className="scholar-next-step-main"><span className="scholar-next-step-icon"><Icon size={25} aria-hidden="true" /></span>
      <div><p className="scholar-eyebrow">YOUR NEXT STEP</p><h2 id="scholar-next-step-title">{step.title}</h2><p>{step.description}</p></div>
      {step.action && <a className="scholar-primary-action" href="#requirements" onClick={() => onOpenRequirements(step.tab)}>{step.action}<ArrowRight size={17} aria-hidden="true" /></a>}
    </div>
    {!!timeline.length && <details className="scholar-compact-timeline"><summary>View application progress</summary><ol>{timeline.map(item => <li key={item.id} className={item.status}><CheckCircle2 size={15} aria-hidden="true" /><div><strong>{item.label}</strong><span>{item.detail}</span></div><small>{item.status === 'completed' ? 'Completed' : item.status === 'current' ? 'Current' : 'Upcoming'}</small></li>)}</ol></details>}
  </section>;
}

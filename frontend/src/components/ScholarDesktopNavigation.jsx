import { useEffect, useState } from 'react';
import { currentScholarSection, scholarSections } from '../utils/scholarSectionNavigation';
import '../styles/scholar-desktop-navigation.css';

export default function ScholarDesktopNavigation() {
  const [active, setActive] = useState('scholar-overview');
  useEffect(() => {
    const media = window.matchMedia('(min-width: 761px)');
    let frame;
    const update = () => {
      frame = undefined;
      if (!media.matches) return;
      const positions = scholarSections.map(section => {
        const target = document.getElementById(section.id);
        return target ? { id: section.id, top: target.getBoundingClientRect().top } : null;
      }).filter(Boolean);
      const atBottom = window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      setActive(currentScholarSection(positions, Math.min(160, window.innerHeight * .25), atBottom));
    };
    const schedule = () => { if (frame === undefined) frame = window.requestAnimationFrame(update); };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const content = document.querySelector('.scholar-dashboard-main');
    if (content) observer?.observe(content);
    schedule();
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); observer?.disconnect(); if (frame !== undefined) window.cancelAnimationFrame(frame); };
  }, []);
  return <nav className="scholar-desktop-navigation" aria-label="Scholar portal sections">
    <span className="scholar-section-nav-caption">ON THIS PAGE</span>
    <div>{scholarSections.map(section => <a key={section.id} href={`#${section.id}`} aria-current={active === section.id ? 'location' : undefined} onClick={() => setActive(section.id)}>{section.label}</a>)}</div>
  </nav>;
}

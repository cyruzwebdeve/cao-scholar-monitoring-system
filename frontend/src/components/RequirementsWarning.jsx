import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';

export default function RequirementsWarning({ name }) {
  const tooltipId = useId();
  const trigger = useRef(null);
  const closeTimer = useRef(null);
  const [position, setPosition] = useState(null);

  const cancelClose = () => window.clearTimeout(closeTimer.current);
  const open = () => {
    cancelClose();
    const rect = trigger.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)),
      top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 48)),
    });
  };
  const closeSoon = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setPosition(null), 120);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!position) return undefined;
    const close = () => setPosition(null);
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    // Keyboard focus can scroll the queue to reveal the warning button.
    const onViewportChange = () => {
      if (document.activeElement !== trigger.current) { close(); return; }
      const rect = trigger.current.getBoundingClientRect();
      setPosition({
        left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)),
        top: Math.max(8, Math.min(rect.bottom + 8, window.innerHeight - 48)),
      });
    };
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [position]);

  return <>
    <button
      ref={trigger}
      type="button"
      className="billing-requirements-icon"
      aria-label={`Incomplete requirements for ${name}`}
      aria-describedby={position ? tooltipId : undefined}
      onMouseEnter={open}
      onMouseLeave={closeSoon}
      onFocus={open}
      onBlur={() => { cancelClose(); setPosition(null); }}
      onClick={open}
    ><TriangleAlert size={16} aria-hidden="true" /></button>
    {position && createPortal(
      <span id={tooltipId} role="tooltip" className="billing-requirements-tooltip" style={position} onMouseEnter={cancelClose} onMouseLeave={closeSoon}>
        Incomplete requirements
      </span>, document.body,
    )}
  </>;
}

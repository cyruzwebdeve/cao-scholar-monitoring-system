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
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
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

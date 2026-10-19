import Notification from './components/Notification';
import { useEffect, useRef, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
export default function LaptopPhoneCapture({ scholar, token, busy, onPages, onConnectionChange }) {
  const [session, setSession] = useState(null), [notice, setNotice] = useState(null), [creating, setCreating] = useState(false), [closing, setClosing] = useState(false);
  const sessionRef = useRef(null), callback = useRef(onPages), alive = useRef(true);
  useEffect(() => { callback.current = onPages; }, [onPages]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; onConnectionChange(false); if (sessionRef.current) fetch(`${API_BASE}/phone-capture/sessions/${sessionRef.current.id}?discard=1`, { method: 'DELETE', headers: authHeaders(token), keepalive: true }).catch(() => {}); };
  }, [token, onConnectionChange]);
  const close = async () => {
    if (!sessionRef.current) return;
    setClosing(true);
    try {
      const id = sessionRef.current.id;
      const frozen = await fetch(`${API_BASE}/phone-capture/sessions/${id}/freeze`, { method: 'POST', headers: authHeaders(token) });
      if (frozen.ok) {
        const body = await frozen.json();
        const received = await callback.current(body.pages || []);
        if ((body.pages || []).some((page) => !received.includes(page.id))) throw new Error('Capture stopped. Some pages still need space or a category correction on this laptop. Resolve them, then end the connection again.');
      } else if (frozen.status === 404) {
        const existing = await fetch(`${API_BASE}/phone-capture/sessions/${id}`, { headers: authHeaders(token), cache: 'no-store' });
        if (existing.ok || ![404,410].includes(existing.status)) throw new Error('The transfer update is not ready. Keep this session open and retry after backend deployment.');
      } else if (frozen.status !== 410) throw new Error('Unable to stop new transfers. Retry before uploading.');
      const response = await fetch(`${API_BASE}/phone-capture/sessions/${id}`, { method: 'DELETE', headers: authHeaders(token) });
      if (!response.ok && ![404,410].includes(response.status)) throw new Error('Unable to close the phone connection. Retry before uploading.');
      if (alive.current) { sessionRef.current = null; onConnectionChange(false); setSession(null); setNotice({ tone: 'success', text: 'Phone connection closed. Received draft pages remain on this laptop.' }); }
    } finally { if (alive.current) setClosing(false); }
  };
  const create = async () => {
    setCreating(true); setNotice(null);
    try {
      const response = await fetch(`${API_BASE}/phone-capture/sessions`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ applicantId: scholar.applicantId, academicPeriodId: scholar.academicPeriodId }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to connect phone camera.');
      if (!alive.current) { fetch(`${API_BASE}/phone-capture/sessions/${body.session.id}?discard=1`, { method: 'DELETE', headers: authHeaders(token) }).catch(() => {}); return; }
      sessionRef.current = body.session; onConnectionChange(true);
      if (alive.current) setSession(body.session);
    } catch (error) { if (alive.current) { setSession(sessionRef.current); setNotice({ tone: 'error', text: error.message || 'Unable to connect phone camera.' }); } }
    finally { if (alive.current) setCreating(false); }
  };
  useEffect(() => {
    if (!session || busy || closing) return;
    let active = true, inFlight = false;
    const poll = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await fetch(`${API_BASE}/phone-capture/sessions/${session.id}?receive=1`, { headers: authHeaders(token), cache: 'no-store' });
        const body = await response.json(); if (!active) return;
        if (!response.ok) { setNotice({ tone: 'error', text: body.message || 'Phone connection unavailable.' }); if ([404,410,409].includes(response.status)) { sessionRef.current = null; onConnectionChange(false); setSession(null); } return; }
        const received = await callback.current(body.pages || []);
        if (!active) return;
        if (received.length) {
          const ack = await fetch(`${API_BASE}/phone-capture/sessions/${session.id}/received`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ pageIds: received }) });
          if (!ack.ok) throw new Error('Pages received; temporary queue cleanup will retry.');
          setNotice({ tone: 'success', text: 'Phone pages received. Review their category, page order and readability before approval.' });
        }
      } catch (error) { if (active) setNotice({ tone: 'error', text: error.message || 'Connection interrupted. Reconnecting automatically…' }); }
      finally { inFlight = false; }
    };
    poll(); const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session, token, busy, closing, onConnectionChange]);
  return <div className="laptop-phone-capture"><div className="capture-actions">{!session ? <button type="button" disabled={busy || creating} onClick={create}><Smartphone size={15} />{creating ? 'Connecting…' : 'Use phone camera'}</button> : <button type="button" disabled={busy || closing} onClick={() => close().catch((error) => setNotice({ tone: 'error', text: error.message }))}><X size={14} />{closing ? 'Receiving final pages…' : 'End phone connection'}</button>}</div>{session && <div className="phone-pairing"><div><strong>Connect your phone camera</strong><p>Sign in with the same Admin account. Photos appear here for laptop review.</p><p>{session.scholarName} · {session.periodLabel}</p><p>Expires at {new Date(session.expiresAt).toLocaleTimeString()}.</p><a href={`${window.location.origin}/phone-capture?session=${encodeURIComponent(session.id)}`} target="_blank" rel="noopener noreferrer">Open phone capture link</a><p>End the phone connection before confirming and uploading.</p></div></div>}{notice && <Notification tone={notice.tone} title="Phone connection update" onDismiss={() => setNotice(null)}>{notice.text}</Notification>}</div>;
}

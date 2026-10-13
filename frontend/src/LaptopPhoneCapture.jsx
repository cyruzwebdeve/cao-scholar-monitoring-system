import { useEffect, useRef, useState } from 'react';
import { Smartphone, X } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
export default function LaptopPhoneCapture({ scholar, token, busy, onPages, onConnectionChange }) {
  const [session, setSession] = useState(null), [qr, setQr] = useState(''), [notice, setNotice] = useState(''), [creating, setCreating] = useState(false);
  const sessionRef = useRef(null), callback = useRef(onPages), alive = useRef(true);
  useEffect(() => { callback.current = onPages; }, [onPages]);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; onConnectionChange(false); if (sessionRef.current) fetch(`${API_BASE}/phone-capture/sessions/${sessionRef.current.id}`, { method: 'DELETE', headers: authHeaders(token), keepalive: true }).catch(() => {}); };
  }, [token, onConnectionChange]);
  const close = async () => {
    if (!sessionRef.current) return;
    const response = await fetch(`${API_BASE}/phone-capture/sessions/${sessionRef.current.id}`, { method: 'DELETE', headers: authHeaders(token) });
    if (!response.ok && ![404,410].includes(response.status)) throw new Error('Unable to close the phone connection. Retry before uploading.');
    sessionRef.current = null; onConnectionChange(false); setSession(null); setQr(''); setNotice('Phone connection closed. Received draft pages remain on this laptop.');
  };
  const create = async () => {
    setCreating(true); setNotice('');
    try {
      const response = await fetch(`${API_BASE}/phone-capture/sessions`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ applicantId: scholar.applicantId, academicPeriodId: scholar.academicPeriodId }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to connect phone camera.');
      if (!alive.current) { fetch(`${API_BASE}/phone-capture/sessions/${body.session.id}`, { method: 'DELETE', headers: authHeaders(token) }).catch(() => {}); return; }
      sessionRef.current = body.session; onConnectionChange(true);
      const { default: QRCode } = await import('qrcode');
      const url = `${window.location.origin}/phone-capture?session=${encodeURIComponent(body.session.id)}`;
      const encoded = await QRCode.toDataURL(url, { width: 200, margin: 2 });
      if (alive.current) { setQr(encoded); setSession(body.session); }
    } catch (error) { if (alive.current) { setSession(sessionRef.current); setNotice(error.message || 'Unable to generate pairing code.'); } }
    finally { if (alive.current) setCreating(false); }
  };
  useEffect(() => {
    if (!session || busy) return;
    let active = true, inFlight = false;
    const poll = async () => {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const response = await fetch(`${API_BASE}/phone-capture/sessions/${session.id}?receive=1`, { headers: authHeaders(token), cache: 'no-store' });
        const body = await response.json(); if (!active) return;
        if (!response.ok) { setNotice(body.message || 'Phone connection unavailable.'); if ([404,410,409].includes(response.status)) { sessionRef.current = null; onConnectionChange(false); setSession(null); setQr(''); } return; }
        const received = await callback.current(body.pages || []);
        if (!active) return;
        if (received.length) {
          const ack = await fetch(`${API_BASE}/phone-capture/sessions/${session.id}/received`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ pageIds: received }) });
          if (!ack.ok) throw new Error('Pages received; temporary queue cleanup will retry.');
          setNotice('Phone pages received. Review their category, page order and readability before approval.');
        }
      } catch (error) { if (active) setNotice(error.message || 'Connection interrupted. Reconnecting automatically…'); }
      finally { inFlight = false; }
    };
    poll(); const timer = window.setInterval(poll, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [session, token, busy, onConnectionChange]);
  return <div className="laptop-phone-capture"><div className="capture-actions">{!session ? <button type="button" disabled={busy || creating} onClick={create}><Smartphone size={15} />{creating ? 'Connecting…' : 'Use phone camera'}</button> : <button type="button" disabled={busy} onClick={() => close().catch((error) => setNotice(error.message))}><X size={14} />End phone connection</button>}</div>{session && <div className="phone-pairing">{qr && <img src={qr} alt="QR code for authenticated phone camera connection" />}<div><strong>Scan with your phone camera</strong><p>Sign in with the same Admin account. Photos appear here for laptop review.</p><p>{session.scholarName} · {session.periodLabel}</p><p>Expires at {new Date(session.expiresAt).toLocaleTimeString()}.</p><a href={`${window.location.origin}/phone-capture?session=${encodeURIComponent(session.id)}`} target="_blank" rel="noopener noreferrer">Open phone capture link</a><p>End the phone connection before confirming and uploading.</p></div></div>}{notice && <p role="status" className="capture-notice">{notice}</p>}</div>;
}

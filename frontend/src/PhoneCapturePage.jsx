import CapturePhotoTips from './CapturePhotoTips';
import { useEffect, useRef, useState } from 'react';
import { Camera, RotateCw, Send } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import AuthPageShell from './components/AuthPageShell';
import LoginForm from './components/LoginForm';
import { readCaptureFile, renderCapture } from './utils/documentCapture';
import './styles/document-capture.css';
const labels = { tax_exemption: 'Certificate of Tax Exemption', indigency: 'Barangay Indigency', valid_id: 'Photocopy of ID', grades: 'Certificate of Grades', registration_form: 'Registration Form', tuition_receipt: 'Official Receipt of Tuition Fee' };
export default function PhoneCapturePage({ token, user, onLogin, onLogout }) {
  const sessionId = new URLSearchParams(window.location.search).get('session') || '';
  const [session, setSession] = useState(null), [key, setKey] = useState(''), [photo, setPhoto] = useState(null), [notice, setNotice] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [camera, setCamera] = useState(false), [expired, setExpired] = useState(false);
  const [noticeSuccess, setNoticeSuccess] = useState(false);
  const stream = useRef(null), video = useRef(null), alive = useRef(true), generation = useRef(0);
  const authorized = token && ['SuperAdmin', 'RegularAdmin'].includes(user?.role) && (user.role === 'SuperAdmin' || !Array.isArray(user.sectionAccess) || user.sectionAccess.includes('scholars'));
  const stop = () => { generation.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); };
  useEffect(() => {
    alive.current = true;
    const cleanup = () => { generation.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
    const hidden = () => { if (document.hidden) { cleanup(); setCamera(false); } };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', cleanup);
    return () => { alive.current = false; cleanup(); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', cleanup); };
  }, []);
  useEffect(() => { if (camera && video.current) video.current.srcObject = stream.current; }, [camera]);
  useEffect(() => {
    if (!authorized || !sessionId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/phone-capture/sessions/${sessionId}`, { headers: authHeaders(token), cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) { if (active) { generation.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); setExpired(true); setError(body.message || 'Capture connection unavailable.'); } return; }
        if (active) { setSession(body.session); if (body.session.accepting === false) { generation.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); } setExpired(body.session.accepting === false); setError(''); setKey((current) => body.session.requirementKeys.includes(current) ? current : body.session.requirementKeys[0]); }
      } catch { if (active) setError('Unable to reach the laptop session. Reconnect and retry.'); }
    };
    load(); const timer = window.setInterval(() => { if (!document.hidden) load(); }, 10_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [authorized, sessionId, token]);
  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => { setExpired(true); generation.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); }, session.remainingMs ?? Math.max(0, new Date(session.expiresAt).getTime() - Date.now()));
    return () => window.clearTimeout(timer);
  }, [session]);
  const act = async (action) => { setBusy(true); setNotice(''); setNoticeSuccess(false); try { await action(); } catch (failure) { if (alive.current) setNotice(failure.message || 'Unable to capture. Try again.'); } finally { if (alive.current) setBusy(false); } };
  const capture = (source) => act(async () => { const imageData = await renderCapture(source); if (alive.current) { setPhoto({ pageId: crypto.randomUUID(), imageData }); stop(); } });
  const live = async () => {
    stop(); const attempt = generation.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Unavailable');
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2200 } } });
      if (!alive.current || generation.current !== attempt) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (alive.current) { setNoticeSuccess(false); setNotice('Live camera unavailable. Use Take photo below.'); } }
  };
  const send = () => act(async () => {
    const response = await fetch(`${API_BASE}/phone-capture/sessions/${sessionId}/pages`, { method: 'POST', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ ...photo, requirementKey: key }) });
    const body = await response.json(); if (!response.ok) throw new Error(body.message || 'Unable to send this photo.');
    if (alive.current) { setPhoto(null); setNoticeSuccess(true); setNotice('Photo sent. Review and approve it in the System.'); }
  });
  const switchAccount = () => { stop(); setSession(null); setPhoto(null); setError(''); setNotice(''); setNoticeSuccess(false); setExpired(false); onLogout(); };
  if (!token) return <AuthPageShell><h2>Connect your phone camera</h2><p>Sign in with the same Admin account used on your laptop. The QR code does not grant access.</p><LoginForm onLogin={onLogin} /></AuthPageShell>;
  if (!authorized) return <main className="phone-capture-page"><h2>Admin access required</h2><p>Use the Admin account with Scholars access that created the laptop session.</p><button type="button" onClick={switchAccount}>Switch Admin account</button></main>;
  return <main className="phone-capture-page"><section className="document-capture"><header><h2>Phone camera</h2><button type="button" onClick={switchAccount}>Switch Admin account</button></header>{session ? <p><strong>{session.scholarName}</strong><br />{session.periodLabel}<br />Connection expires at {new Date(session.expiresAt).toLocaleTimeString()}.</p> : <p>{sessionId ? 'Connecting to laptop…' : 'Scan a new QR code from the laptop.'}</p>}
    <p className="capture-help">Photos transfer temporarily to the laptop for review. Sending does not upload an approved requirement. Keep the laptop intake open.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status" className={`capture-notice${noticeSuccess ? ' capture-notice-success' : ''}`}>{notice}</p>}{expired && <p role="status">Connection closed or expired. Create a new QR code on the laptop.</p>}
    <fieldset disabled={busy || !session || expired || Boolean(error)}><legend>Capture a page</legend><label className="phone-requirement">Requirement<select aria-label="Requirement" value={key} onChange={(event) => { setKey(event.target.value); setPhoto(null); stop(); }}>{session?.requirementKeys.map((item) => <option key={item} value={item}>{labels[item]}</option>)}</select></label>
      <div className="capture-actions"><button type="button" onClick={camera ? stop : live}><Camera size={14} />{camera ? 'Stop camera' : 'Open live camera'}</button><label className="capture-file"><Camera size={14} />Take photo<input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; act(async () => { if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 12 * 1024 * 1024) throw new Error('Choose a JPG or PNG below 12 MB.'); const imageData = await renderCapture(await readCaptureFile(file)); if (alive.current) { setPhoto({ pageId: crypto.randomUUID(), imageData }); stop(); } }); }} /></label></div>
      {camera && <div className="capture-camera"><video ref={video} autoPlay playsInline muted aria-label="Phone document camera preview" /><button type="button" onClick={() => capture(video.current)}>Capture page</button></div>}
      {photo && <><div className="capture-preview"><img src={photo.imageData} alt="Photo to upload to the System" /></div><CapturePhotoTips source={photo.imageData} /><div className="capture-actions"><button type="button" onClick={() => act(async () => { const imageData = await renderCapture(photo.imageData, { rotate: true }); setPhoto({ pageId: crypto.randomUUID(), imageData }); })}><RotateCw size={14} />Rotate</button><button type="button" onClick={() => setPhoto(null)}>Retake</button><button type="button" className="capture-submit" onClick={send}><Send size={14} />Upload</button></div></>}
    </fieldset></section></main>;
}

import CapturePhotoTips from './CapturePhotoTips';
import LaptopPhoneCapture from './LaptopPhoneCapture';
import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Crop, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import { buildCapturePdf, captureReady, MAX_CAPTURE_PAGES, MAX_DOCUMENT_BYTES, readCaptureFile, renderCapture } from './utils/documentCapture';
import './styles/document-capture.css';
export default function InitialRequirementCapture({ scholar, token, onSaved }) {
  const documents = scholar.initialDocuments || scholar.documents || [];
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  const [saved, setSaved] = useState({});
  const [key, setKey] = useState(documents[0]?.requirementKey || '');
  const [pageIndex, setPageIndex] = useState(0);
  const [crop, setCrop] = useState([0, 0, 0, 0]);
  const [camera, setCamera] = useState(false);
  const [working, setWorking] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [notice, setNotice] = useState('');
  const [progress, setProgress] = useState('');
  const receivedPages = useRef(new Set());
  const draftsRef = useRef({});
  const [phoneConnected, setPhoneConnected] = useState(false);
  const storeDrafts = (next) => { draftsRef.current = next; setDrafts(next); };
  const video = useRef(null), stream = useRef(null), alive = useRef(true), cameraRequest = useRef(0), request = useRef(null);
  const draft = drafts[key] || { pages: [] };
  const stopCamera = () => { cameraRequest.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); };
  useEffect(() => {
    alive.current = true;
    const stop = () => { cameraRequest.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
    const hidden = () => { if (document.hidden) { stop(); setCamera(false); } };
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', hidden);
    return () => { alive.current = false; stop(); request.current?.abort(); window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (camera && video.current) video.current.srcObject = stream.current; }, [camera]);
  useEffect(() => {
    if (!Object.keys(drafts).length && !phoneConnected) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [drafts, phoneConnected]);
  const edit = (next) => { storeDrafts({ ...draftsRef.current, [key]: next }); setConfirmed(false); };
  const choose = (nextKey) => { stopCamera(); setKey(nextKey); setPageIndex(0); setCrop([0, 0, 0, 0]); setNotice(''); };
  const startCamera = async () => {
    stopCamera(); const generation = cameraRequest.current; setNotice('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable. Use Take photo or choose an existing file.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2200 }, height: { ideal: 1600 } } });
      if (!alive.current || generation !== cameraRequest.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (alive.current) setNotice('Camera unavailable or permission denied. Use Take photo on your phone, or choose an existing file.'); }
  };
  const addPage = async (source) => {
    if ((draft.pages?.length || 0) >= MAX_CAPTURE_PAGES) throw new Error(`Maximum ${MAX_CAPTURE_PAGES} pages per requirement.`);
    const page = await renderCapture(source);
    const bytes = Object.values(drafts).reduce((total, item) => total + (item.pages || []).reduce((sum, value) => sum + value.length, 0) + (item.file?.fileData.length || 0), 0);
    if (bytes + page.length > 32 * 1024 * 1024) throw new Error('The capture set is too large for this session. Remove duplicate pages or use a smaller capture set.');
    if (!alive.current) return;
    edit({ pages: [...(draft.pages || []), page] }); setPageIndex(draft.pages?.length || 0); setCrop([0, 0, 0, 0]);
  };
  const act = async (action) => { setWorking(true); setNotice(''); try { await action(); } catch (error) { if (alive.current) setNotice(error.message); } finally { if (alive.current) { setWorking(false); setProgress(''); } } };
  const pick = (file, photo = false) => act(async () => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', ...(photo ? [] : ['application/pdf'])].includes(file.type)) throw new Error('Use a JPG, PNG, or PDF file.');
    if (file.size > (file.type === 'application/pdf' ? MAX_DOCUMENT_BYTES : 12 * 1024 * 1024)) throw new Error('Use a PDF below 6 MB or a photo below 12 MB.');
    const data = await readCaptureFile(file);
    if (file.type === 'application/pdf') { edit({ pages: [], file: { fileName: file.name, fileData: data } }); setPageIndex(0); }
    else await addPage(data);
  });
  const transform = (rotate) => act(async () => {
    const updated = await renderCapture(draft.pages[pageIndex], { rotate, crop: rotate ? [0, 0, 0, 0] : crop });
    edit({ pages: draft.pages.map((page, index) => index === pageIndex ? updated : page) }); setCrop([0, 0, 0, 0]);
  });
  const receivePhonePages = async (pages) => {
    const received = [], next = { ...draftsRef.current };
    let total = Object.values(next).reduce((sum, item) => sum + (item.pages || []).reduce((bytes, image) => bytes + image.length, 0) + (item.file?.fileData.length || 0), 0);
    for (const item of pages) {
      if (receivedPages.current.has(item.id)) { received.push(item.id); continue; }
      if (!documents.some((doc) => doc.requirementKey === item.requirementKey) || saved[item.requirementKey]) { setNotice('A phone page targets an already uploaded or unavailable requirement. End the connection and review before continuing.'); continue; }
      const current = next[item.requirementKey] || { pages: [] };
      if (current.file || current.pages.length >= MAX_CAPTURE_PAGES || total + item.imageData.length > 32 * 1024 * 1024) { setNotice('A phone page is waiting: its category has a PDF, too many pages or the draft set is full. Resolve it before receiving more.'); continue; }
      next[item.requirementKey] = { pages: [...current.pages, item.imageData] }; total += item.imageData.length;
      receivedPages.current.add(item.id); received.push(item.id);
    }
    if (received.length) { storeDrafts(next); setConfirmed(false); }
    return received;
  };
  const movePage = (direction) => {
    const destination = pageIndex + direction;
    const pages = [...draft.pages];
    [pages[pageIndex], pages[destination]] = [pages[destination], pages[pageIndex]];
    edit({ pages }); setPageIndex(destination); setCrop([0, 0, 0, 0]);
  };
  const publish = () => act(async () => {
    stopCamera();
    if (phoneConnected) throw new Error('End the phone connection before reviewing and uploading the final set.');
    if (!confirmed || !captureReady(documents, drafts, saved)) throw new Error('Review every requirement and confirm readability before uploading.');
    const pending = [];
    // Validate every generated PDF before making any request.
    for (const doc of documents) {
      const item = drafts[doc.requirementKey];
      if (!item || saved[doc.requirementKey]) continue;
      setProgress(`Preparing ${doc.label}…`);
      pending.push({ key: doc.requirementKey, ...(item.file || { fileName: `initial-${doc.requirementKey}.pdf`, fileData: await buildCapturePdf(item.pages) }) });
    }
    if (!pending.length) throw new Error('Capture at least one new document. Existing approved files can be retained.');
    let success = 0;
    request.current = new AbortController();
    try {
      for (const item of pending) {
        if (!alive.current) return;
        setProgress(`Uploading ${++success} of ${pending.length} documents…`);
        const response = await fetch(`${API_BASE}/scholars/${scholar.applicantId}/requirements/${item.key}`, { method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, signal: request.current.signal,
          body: JSON.stringify({ academicPeriodId: scholar.academicPeriodId, fileName: item.fileName, fileData: item.fileData }) });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || 'Upload failed. Retry the remaining documents.');
        if (!alive.current) return;
        setSaved((current) => ({ ...current, [item.key]: true }));
        const next = { ...draftsRef.current }; delete next[item.key]; storeDrafts(next);
      }
      setNotice('Initial documents uploaded and approved. Their previous versions remain available.'); setConfirmed(false);
    } finally { if (alive.current) { setProgress(''); await onSaved(); } }
  });
  const ready = captureReady(documents, drafts, saved);
  const selected = documents.find((item) => item.requirementKey === key);
  const page = draft.pages?.[pageIndex];
  const close = () => { if ((Object.keys(drafts).length || phoneConnected) && !window.confirm('Discard received drafts and any phone photos that have not been uploaded?')) return; stopCamera(); storeDrafts({}); receivedPages.current.clear(); setSaved({}); setConfirmed(false); setOpen(false); };
  if (!open) return <button type="button" className="capture-start" disabled={!['Public', 'Private'].includes(scholar.schoolType)} onClick={() => setOpen(true)}><Camera size={15} />Capture initial requirements</button>;
  return <section className="document-capture" aria-label="Initial document camera intake" aria-busy={working}>
    <header><div><h4>Capture initial requirements</h4><p>{scholar.name} · {scholar.controlNumber || scholar.scholarId}<br />{scholar.schoolYear} · {scholar.semester}</p></div><button type="button" disabled={working} onClick={close} aria-label="Close camera intake"><X size={16} /></button></header>
    <p className="capture-help">Capture each document, check every page, then confirm the set. Drafts stay in this tab until uploaded; closing the drawer or leaving Overview discards them. Use phone camera to pair with this laptop, or capture directly on this device.</p>
    {notice && <p role="status" className="capture-notice">{notice}</p>}
    {progress && <p role="status">{progress}</p>}
    <LaptopPhoneCapture scholar={scholar} token={token} busy={working} onPages={receivePhonePages} onConnectionChange={setPhoneConnected} />
    <div className="capture-checklist">{documents.map((doc) => <button type="button" key={doc.requirementKey} aria-pressed={key === doc.requirementKey} disabled={working} onClick={() => choose(doc.requirementKey)}><span>{doc.label}</span><small>{saved[doc.requirementKey] ? 'Uploaded · Approved' : drafts[doc.requirementKey]?.file ? 'PDF ready' : drafts[doc.requirementKey]?.pages.length ? `${drafts[doc.requirementKey].pages.length} page(s) captured` : doc.submitted && ['approved', 'complete', 'completed'].includes(String(doc.status).toLowerCase()) ? 'Keep existing approved file' : 'Capture needed'}</small></button>)}</div>
    <fieldset disabled={working || Boolean(saved[key])}>
      <legend>{selected?.label}</legend>
      {saved[key] ? <p><CheckCircle2 size={16} /> Uploaded and approved. Close and reopen intake to capture a correction.</p> : <>
        <div className="capture-actions"><button type="button" onClick={camera ? stopCamera : startCamera}><Camera size={14} />{camera ? 'Stop camera' : 'Open live camera'}</button><label className="capture-file"><Camera size={14} />Take photo<input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { pick(event.target.files?.[0], true); event.target.value = ''; }} /></label><label className="capture-file"><Upload size={14} />Choose file<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
        {camera && <div className="capture-camera"><video ref={video} autoPlay muted playsInline aria-label="Live document camera preview" /><button type="button" onClick={() => act(() => addPage(video.current))}>Capture page</button></div>}
        {draft.file && <div className="capture-pdf"><p>{draft.file.fileName} · Existing PDF</p><iframe title="Selected PDF preview" src={draft.file.fileData} /><button type="button" onClick={() => edit({ pages: [] })}>Remove PDF</button></div>}
        {draft.pages?.length > 0 && <>
          <div className="capture-pages">{draft.pages.map((source, index) => <button type="button" key={index} aria-pressed={index === pageIndex} onClick={() => { setPageIndex(index); setCrop([0, 0, 0, 0]); }}><img src={source} alt={`Captured page ${index + 1}`} /><span>Page {index + 1}</span></button>)}</div>
          {page && <><div className="capture-preview"><img src={page} alt={`Full preview of page ${pageIndex + 1}`} /><div className="capture-crop-guide" style={{ left: `${crop[0]}%`, top: `${crop[1]}%`, right: `${crop[2]}%`, bottom: `${crop[3]}%` }} /></div><CapturePhotoTips source={page} /><div className="capture-crop-controls">{['Left', 'Top', 'Right', 'Bottom'].map((edge, index) => <label key={edge}>{edge} trim: {crop[index]}%<input type="range" min="0" max="40" value={crop[index]} onChange={(event) => setCrop((current) => current.map((value, i) => i === index ? Number(event.target.value) : value))} /></label>)}</div><div className="capture-actions"><button type="button" onClick={() => transform(false)}><Crop size={14} />Apply crop</button><button type="button" onClick={() => transform(true)}><RotateCw size={14} />Rotate page</button><button type="button" onClick={() => { edit({ pages: draft.pages.filter((_, index) => index !== pageIndex) }); setPageIndex(0); setCrop([0, 0, 0, 0]); }}><Trash2 size={14} />Remove / retake page</button><button type="button" disabled={pageIndex === 0} onClick={() => movePage(-1)}>Move page earlier</button><button type="button" disabled={pageIndex === draft.pages.length - 1} onClick={() => movePage(1)}>Move page later</button></div></>}
        </>}
        <p className="capture-help">Add pages in reading order, up to {MAX_CAPTURE_PAGES} per requirement. Photo pages become one PDF per requirement. Choosing a PDF replaces its photo draft; adding a photo replaces its PDF draft.</p>
      </>}
    </fieldset>
    <label className="capture-confirm"><input type="checkbox" checked={confirmed} disabled={working || phoneConnected || !ready} onChange={(event) => setConfirmed(event.target.checked)} /><span>I checked every requirement for this scholar, including retained files. All pages are readable, complete and ready for approval. Captured documents replace any existing file in the selected period.</span></label>
    <button type="button" className="capture-submit" disabled={working || phoneConnected || !confirmed || !ready || !Object.keys(drafts).length} onClick={publish}>{working ? 'Processing…' : 'Confirm, upload & approve initial set'}</button>
  </section>;
}

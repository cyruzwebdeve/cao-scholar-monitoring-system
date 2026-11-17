import { validateDocumentFile, documentDataUrl, DOCUMENT_FILE_ACCEPT, DOCUMENT_FILE_HELP, CAPTURE_FILE_HELP } from './utils/documentFilePolicy';
import Notification from './components/Notification';
import DocumentViewButton from './components/DocumentViewButton';
import CapturePhotoTips from './CapturePhotoTips';
import LaptopPhoneCapture from './LaptopPhoneCapture';
import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Crop, Eye, Plus, RotateCw, Trash2, Upload, X } from 'lucide-react';
import { API_BASE, authHeaders } from './services/api';
import { buildCapturePdf, MAX_CAPTURE_PAGES, renderCapture } from './utils/documentCapture';
import { assignCaptureRequirement, captureDraftBytes, captureDraftHasContent, captureDraftUploadReady, createCaptureDraft, getCaptureUploadBatch, getCaptureUploadTarget, MAX_CAPTURE_DRAFT_BYTES, updateCaptureDraftContent } from './utils/adminDocumentCapture';
import './styles/document-capture.css';
export default function InitialRequirementCapture({ scholar, token, onSaved }) {
  const documents = scholar.initialDocuments || scholar.documents || [];
  const captureId = `capture-${scholar.applicantId}-${scholar.academicPeriodId}`;
  const [open, setOpen] = useState(false);
  const [captureTab, setCaptureTab] = useState('scan');
  const [drafts, setDrafts] = useState(() => ({ 'capture-1': createCaptureDraft('capture-1', 1) }));
  const [saved, setSaved] = useState({});
  const [uploadErrors, setUploadErrors] = useState({});
  const [draftId, setDraftId] = useState('capture-1');
  const [pageIndex, setPageIndex] = useState(0);
  const [crop, setCrop] = useState([0, 0, 0, 0]);
  const [camera, setCamera] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState('warning');
  const [progress, setProgress] = useState('');
  const receivedPages = useRef(new Set());
  const draftsRef = useRef(drafts), draftNumber = useRef(1), workingRef = useRef(false);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const storeDrafts = (next) => { draftsRef.current = next; setDrafts(next); };
  const video = useRef(null), stream = useRef(null), alive = useRef(true), cameraRequest = useRef(0), request = useRef(null);
  const draft = drafts[draftId] || { pages: [], requirementKey: '' };
  const stopCamera = () => { cameraRequest.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; setCamera(false); };
  const changeTab = next => {
    if (workingRef.current || !['scan', 'assign'].includes(next)) return false;
    if (next !== 'scan') stopCamera();
    setCaptureTab(next);
    return true;
  };
  const onTabKeyDown = event => {
    if (workingRef.current) return;
    const tabs = ['scan', 'assign'];
    const index = tabs.indexOf(captureTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1
      : ['ArrowLeft', 'ArrowRight'].includes(event.key) ? (index + 1) % tabs.length : null;
    if (next === null) return;
    event.preventDefault();
    if (changeTab(tabs[next])) event.currentTarget.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  useEffect(() => {
    alive.current = true;
    const stop = () => { cameraRequest.current += 1; stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; };
    const hidden = () => { if (document.hidden) { stop(); setCamera(false); } };
    window.addEventListener('pagehide', stop); document.addEventListener('visibilitychange', hidden);
    return () => { alive.current = false; stop(); request.current?.abort(); window.removeEventListener('pagehide', stop); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (camera && video.current) video.current.srcObject = stream.current; }, [camera]);
  useEffect(() => {
    if (!Object.values(drafts).some(captureDraftHasContent) && !phoneConnected) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [drafts, phoneConnected]);
  const edit = (next, id = draftId) => storeDrafts(updateCaptureDraftContent(draftsRef.current, id, next));
  const choose = (id, keepCamera = false) => { if (!keepCamera) stopCamera(); setDraftId(id); setPageIndex(0); setCrop([0, 0, 0, 0]); setNotice(''); };
  const freshDraft = () => { const number = ++draftNumber.current; return createCaptureDraft(`capture-${number}`, number); };
  const newDocument = () => {
    const empty = Object.values(draftsRef.current).find(item => !captureDraftHasContent(item));
    if (empty) { choose(empty.id, true); return; }
    const next = freshDraft(); storeDrafts({ ...draftsRef.current, [next.id]: next }); choose(next.id, true);
  };
  const removeDocument = () => {
    if (captureDraftHasContent(draft) && !window.confirm('Discard this scanned document?')) return;
    const next = { ...draftsRef.current }; delete next[draftId];
    if (!Object.keys(next).length) { const empty = freshDraft(); next[empty.id] = empty; }
    storeDrafts(next); choose(Object.keys(next)[0]);
  };
  const assign = (requirementKey, selectedDraftId) => {
    if (workingRef.current) return;
    try {
      storeDrafts(assignCaptureRequirement(draftsRef.current, requirementKey, selectedDraftId, documents, saved));
      setUploadErrors(current => { const next = { ...current }; delete next[requirementKey]; return next; });
      setNotice('');
    }
    catch (error) { setNoticeTone('warning'); setNotice(error.message); }
  };
  const startCamera = async () => {
    stopCamera(); const generation = cameraRequest.current; setNotice('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera is unavailable. Use Take photo or choose an existing file.');
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 2200 }, height: { ideal: 1600 } } });
      if (!alive.current || generation !== cameraRequest.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; setCamera(true);
    } catch { if (alive.current) { setNoticeTone('warning'); setNotice('Camera unavailable or permission denied. Use Take photo on your phone, or choose an existing file.'); } }
  };
  const addPage = async (source, id = draftId) => {
    if ((draftsRef.current[id]?.pages?.length || 0) >= MAX_CAPTURE_PAGES) throw new Error(`Maximum ${MAX_CAPTURE_PAGES} pages per document.`);
    const page = await renderCapture(source);
    if (!alive.current) return;
    const current = draftsRef.current[id];
    if (!current || (current.pages?.length || 0) >= MAX_CAPTURE_PAGES) throw new Error(`Maximum ${MAX_CAPTURE_PAGES} pages per document.`);
    edit({ pages: [...(current.pages || []), page], file: null }, id); setPageIndex(current.pages?.length || 0); setCrop([0, 0, 0, 0]);
  };
  const act = async (action) => { if (workingRef.current) return; workingRef.current = true; setWorking(true); setNotice(''); try { await action(); } catch (error) { if (alive.current) { setNoticeTone('error'); setNotice(error.message); } } finally { workingRef.current = false; if (alive.current) { setWorking(false); setProgress(''); } } };
  const pick = (file, photo = false) => act(async () => {
    if (!file) return;
    const type = await validateDocumentFile(file, { capturePhoto: true, imagesOnly: photo });
    const data = await documentDataUrl(file, type);
    if (!alive.current) return;
    if (type === 'application/pdf') { edit({ pages: [], file: { fileName: file.name, fileData: data } }); setPageIndex(0); }
    else await addPage(data);
  });
  const transform = (rotate) => act(async () => {
    const source = draftsRef.current[draftId]?.pages?.[pageIndex];
    const updated = await renderCapture(source, { rotate, crop: rotate ? [0, 0, 0, 0] : crop });
    if (!alive.current) return;
    const current = draftsRef.current[draftId];
    if (current?.pages?.[pageIndex] !== source) throw new Error('This page changed while editing. Review it and try again.');
    edit({ pages: current.pages.map((page, index) => index === pageIndex ? updated : page) }); setCrop([0, 0, 0, 0]);
  });
  const receivePhonePages = async (pages) => {
    const received = [], next = { ...draftsRef.current };
    let total = captureDraftBytes(next);
    for (const item of pages) {
      if (receivedPages.current.has(item.id)) { received.push(item.id); continue; }
      if (!documents.some((doc) => doc.requirementKey === item.requirementKey) || saved[item.requirementKey]) { setNoticeTone('warning'); setNotice('A phone page targets an already uploaded or unavailable requirement. End the connection and review before continuing.'); continue; }
      const current = Object.values(next).find(draft => draft.phoneSourceKey === item.requirementKey) || { ...freshDraft(), phoneSourceKey: item.requirementKey };
      if (current.file || current.pages.length >= MAX_CAPTURE_PAGES || total + item.imageData.length > MAX_CAPTURE_DRAFT_BYTES) { setNoticeTone('warning'); setNotice('A phone page is waiting: its document has a PDF, too many pages or the draft set is full. Resolve it before receiving more.'); continue; }
      next[current.id] = { ...current, pages: [...current.pages, item.imageData] }; total += item.imageData.length;
      receivedPages.current.add(item.id); received.push(item.id);
    }
    if (received.length) { storeDrafts(next); }
    return received;
  };
  const movePage = (direction) => {
    const destination = pageIndex + direction;
    const pages = [...draft.pages];
    [pages[pageIndex], pages[destination]] = [pages[destination], pages[pageIndex]];
    edit({ pages }); setPageIndex(destination); setCrop([0, 0, 0, 0]);
  };
  const publishDocument = async ({ draftId: uploadDraftId, requirementKey: expectedRequirementKey }, position) => {
    if (!alive.current) return false;
    const requirementKey = getCaptureUploadTarget(draftsRef.current, uploadDraftId, documents, saved);
    if (requirementKey !== expectedRequirementKey) throw new Error('This requirement assignment changed. Review the selected document before uploading.');
    const item = draftsRef.current[uploadDraftId];
    const label = documents.find(document => document.requirementKey === requirementKey)?.label || requirementKey;
    setProgress(`Preparing ${label} (${position})...`);
    const file = item.file || { fileName: `initial-${requirementKey}.pdf`, fileData: await buildCapturePdf(item.pages) };
    if (!alive.current) return false;
    if (draftsRef.current[uploadDraftId] !== item) throw new Error('This scanned document changed while preparing. Review it before uploading.');
    if (getCaptureUploadTarget(draftsRef.current, uploadDraftId, documents, saved) !== expectedRequirementKey) throw new Error('This requirement assignment changed. Review the selected document before uploading.');
    request.current = new AbortController();
    setProgress(`Uploading ${label} (${position})...`);
    try {
      const response = await fetch(`${API_BASE}/${scholar.isPasser ? 'passers' : 'scholars'}/${scholar.applicantId}/requirements/${requirementKey}`, {
        method: 'PUT', headers: { ...authHeaders(token), 'Content-Type': 'application/json' }, signal: request.current.signal,
        body: JSON.stringify({ academicPeriodId: scholar.academicPeriodId, ...file }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || 'Upload failed. This document can be retried.');
      if (!alive.current) return false;
      setSaved(current => ({ ...current, [requirementKey]: true }));
      const next = { ...draftsRef.current }; delete next[uploadDraftId];
      if (!Object.keys(next).length) { const empty = freshDraft(); next[empty.id] = empty; }
      storeDrafts(next);
      return true;
    } finally { request.current = null; }
  };
  const publishBatch = () => act(async () => {
    stopCamera();
    if (phoneConnected) throw new Error('End the phone connection before uploading assigned documents.');
    const batch = getCaptureUploadBatch(draftsRef.current, documents, saved);
    if (!batch.length) throw new Error('Assign a scanned document to a requirement before uploading.');
    setUploadErrors({});
    let uploaded = 0;
    const failures = {};
    for (const [index, item] of batch.entries()) {
      if (!alive.current) return;
      try { if (await publishDocument(item, `${index + 1}/${batch.length}`)) uploaded += 1; }
      catch (error) {
        if (!alive.current) return;
        failures[item.requirementKey] = error.message || 'Upload failed. This document can be retried.';
        setUploadErrors({ ...failures });
      }
    }
    if (!alive.current) return;
    if (!draftsRef.current[draftId]) choose(Object.keys(draftsRef.current)[0]);
    let refreshFailed = false;
    if (uploaded) {
      setProgress('Refreshing requirement statuses...');
      try { refreshFailed = await onSaved() === false; }
      catch { refreshFailed = true; }
    }
    if (!alive.current) return;
    const failed = Object.keys(failures).length;
    setNoticeTone(failed ? uploaded ? 'warning' : 'error' : refreshFailed ? 'warning' : 'success');
    const result = `${uploaded} document${uploaded === 1 ? '' : 's'} uploaded and approved.`;
    const retry = failed ? ` ${failed} failed. Check the messages below, preview the retained scans and click Upload & approve again to retry them.` : ' Unassigned scans remain available.';
    setNotice(`${result}${retry}${refreshFailed ? ' Saved requirement statuses could not be refreshed. Retry the status refresh or reopen this record.' : ''}`);
  });
  const pendingDrafts = Object.values(drafts).filter(item => item.requirementKey && !saved[item.requirementKey]);
  const batchReady = pendingDrafts.length > 0 && pendingDrafts.every(item => captureDraftUploadReady(drafts, item.id, documents, saved));
  const page = draft.pages?.[pageIndex];
  const close = () => { if ((Object.values(drafts).some(captureDraftHasContent) || phoneConnected) && !window.confirm('Discard scanned documents and any phone photos that have not been uploaded?')) return; stopCamera(); storeDrafts({}); receivedPages.current.clear(); setSaved({}); setUploadErrors({}); setCaptureTab('scan'); setOpen(false); };
  if (!open) return <button type="button" className="capture-start" disabled={!['Public', 'Private'].includes(scholar.schoolType)} onClick={() => { newDocument(); setCaptureTab('scan'); setOpen(true); }}><Camera size={15} />Scan and assign initial documents</button>;
  return <section className="document-capture" aria-label="Initial document camera intake" aria-busy={working}>
    <header><div><h4>Scan and assign initial requirements</h4><p>{scholar.name} · {scholar.controlNumber || scholar.scholarId}<br />{scholar.schoolYear} · {scholar.semester}</p></div><button type="button" disabled={working} onClick={close} aria-label="Close document scanner"><X size={16} /></button></header>
    <p className="capture-help">Scan or choose documents in Scan documents, then select a document for each requirement in Assign requirements. Switching tabs keeps your scans; closing the drawer or leaving Overview discards them.</p>
    {notice && <Notification tone={noticeTone} title={noticeTone === 'success' ? 'Initial requirements saved' : 'Capture needs attention'} onDismiss={() => setNotice('')}>{notice}</Notification>}
    {progress && <Notification tone="progress" title="Uploading initial requirements">{progress}</Notification>}
    {documents.some(document => document.requirementKey === 'report_card' && document.optional === false) && <p className="capture-help">Incoming/first-year college: the Grade 12 report card is required. Initial COG is optional.</p>}
    <LaptopPhoneCapture scholar={scholar} token={token} busy={working} onPages={receivePhonePages} onConnectionChange={setPhoneConnected} />
    <nav className="capture-workspace-tabs" role="tablist" aria-label="Initial document upload stages" onKeyDown={onTabKeyDown}>{[['scan', 'Scan documents'], ['assign', 'Assign requirements']].map(([id, label]) => <button key={id} id={`${captureId}-tab-${id}`} type="button" role="tab" aria-selected={captureTab === id} aria-controls={`${captureId}-panel-${id}`} tabIndex={captureTab === id ? 0 : -1} className={captureTab === id ? 'active' : ''} disabled={working} onClick={() => changeTab(id)}>{label}</button>)}</nav>
    <div className="capture-panel" id={`${captureId}-panel-scan`} role="tabpanel" aria-labelledby={`${captureId}-tab-scan`} hidden={captureTab !== 'scan'} tabIndex={0}>
    <div className="capture-document-toolbar"><h5>1. Scan documents</h5><button type="button" disabled={working || phoneConnected} onClick={newDocument}><Plus size={14} />New document</button></div>
    <div className="capture-document-list" aria-label="Scanned documents">{Object.values(drafts).map(item => {
      const assigned = documents.find(document => document.requirementKey === item.requirementKey);
      return <button type="button" key={item.id} aria-pressed={draftId === item.id} disabled={working} onClick={() => choose(item.id)}><strong>{item.label}</strong><small>{item.file ? item.file.fileName : item.pages.length ? `${item.pages.length} scanned page(s)` : 'Ready to scan'}</small><small>{assigned ? `Assigned: ${assigned.label}` : 'Not assigned'}</small></button>;
    })}</div>
    <fieldset disabled={working}>
      <legend>{draft.label || 'Document preview'}</legend>
      <p id="initial-capture-file-policy" className="capture-help">{CAPTURE_FILE_HELP}</p>
        <div className="capture-actions"><button type="button" onClick={camera ? stopCamera : startCamera}><Camera size={14} />{camera ? 'Stop camera' : 'Open live camera'}</button><label className="capture-file"><Camera size={14} />Take photo<input type="file" aria-describedby="initial-capture-file-policy" accept="image/jpeg,image/png" capture="environment" onChange={(event) => { pick(event.target.files?.[0], true); event.target.value = ''; }} /></label><label className="capture-file"><Upload size={14} />Choose file<input type="file" aria-describedby="initial-capture-file-policy" accept={DOCUMENT_FILE_ACCEPT} onChange={(event) => { pick(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
        {camera && <div className="capture-camera"><video ref={video} autoPlay muted playsInline aria-label="Live document camera preview" /><button type="button" onClick={() => act(() => addPage(video.current))}>Capture page</button></div>}
        {draft.file && <div className="capture-pdf"><p>{draft.file.fileName} · PDF document</p><iframe title="Selected PDF preview" src={draft.file.fileData} /><button type="button" onClick={() => edit({ pages: [], file: null })}>Remove PDF</button></div>}
        {draft.pages?.length > 0 && <>
          <div className="capture-pages">{draft.pages.map((source, index) => <button type="button" key={index} aria-pressed={index === pageIndex} onClick={() => { setPageIndex(index); setCrop([0, 0, 0, 0]); }}><img src={source} alt={`Captured page ${index + 1}`} /><span>Page {index + 1}</span></button>)}</div>
          {page && <><div className="capture-preview"><img src={page} alt={`Full preview of page ${pageIndex + 1}`} /><div className="capture-crop-guide" style={{ left: `${crop[0]}%`, top: `${crop[1]}%`, right: `${crop[2]}%`, bottom: `${crop[3]}%` }} /></div><CapturePhotoTips source={page} /><div className="capture-crop-controls">{['Left', 'Top', 'Right', 'Bottom'].map((edge, index) => <label key={edge}>{edge} trim: {crop[index]}%<input type="range" min="0" max="40" value={crop[index]} onChange={(event) => setCrop((current) => current.map((value, i) => i === index ? Number(event.target.value) : value))} /></label>)}</div><div className="capture-actions"><button type="button" onClick={() => transform(false)}><Crop size={14} />Apply crop</button><button type="button" onClick={() => transform(true)}><RotateCw size={14} />Rotate page</button><button type="button" onClick={() => { edit({ pages: draft.pages.filter((_, index) => index !== pageIndex) }); setPageIndex(0); setCrop([0, 0, 0, 0]); }}><Trash2 size={14} />Remove / retake page</button><button type="button" disabled={pageIndex === 0} onClick={() => movePage(-1)}>Move page earlier</button><button type="button" disabled={pageIndex === draft.pages.length - 1} onClick={() => movePage(1)}>Move page later</button></div></>}
        </>}
        <p className="capture-help">Add pages in reading order, up to {MAX_CAPTURE_PAGES} per document. Photo pages become one PDF. Use New document before scanning a different document. Choosing a PDF replaces this document's photo draft; adding a photo replaces its PDF draft.</p>
        <button type="button" onClick={removeDocument}><Trash2 size={14} />Discard this document</button>
    </fieldset>
    </div>
    <div className="capture-panel" id={`${captureId}-panel-assign`} role="tabpanel" aria-labelledby={`${captureId}-tab-assign`} hidden={captureTab !== 'assign'} tabIndex={0}>
    <p className="capture-help">Choose a scanned document in each requirement below and use Preview scan to double-check it. When ready, upload and approve all assigned documents with one click; each document can belong to one requirement.</p>
    {!Object.values(drafts).some(captureDraftHasContent) && <p className="capture-empty">No scanned documents yet. Add documents in the Scan documents tab.</p>}
    <div className="capture-checklist" aria-label="Initial requirement checklist">{documents.map(doc => {
      const assigned = Object.values(drafts).find(item => item.requirementKey === doc.requirementKey);
      const options = Object.values(drafts).filter(captureDraftHasContent);
      const uploaded = Boolean(saved[doc.requirementKey]);
      return <div className="capture-requirement-row" key={doc.requirementKey}>
        <div className="capture-document-status"><span>{doc.label}<small>{doc.optional ? 'Optional' : 'Required'}</small></span><strong>{uploaded ? <><CheckCircle2 size={14} />Uploaded · Approved</> : assigned ? `Assigned · ${assigned.label}` : doc.submitted ? doc.status || 'Submitted' : doc.optional ? 'Optional · not submitted' : 'Awaiting document'}</strong></div>
        <label className="capture-requirement-selection" htmlFor={`${captureId}-document-${doc.requirementKey}`}>Scanned document<select id={`${captureId}-document-${doc.requirementKey}`} aria-label={`Scanned document for ${doc.label}`} value={assigned?.id || ''} disabled={working || uploaded || !options.length} onChange={event => assign(doc.requirementKey, event.target.value)}><option value="">{uploaded ? 'Uploaded in this session' : 'Choose a scanned document'}</option>{options.map(item => <option key={item.id} value={item.id} disabled={Boolean(item.requirementKey && item.requirementKey !== doc.requirementKey)}>{item.label} · {item.file ? item.file.fileName : `${item.pages.length} page(s)`}{item.requirementKey && item.requirementKey !== doc.requirementKey ? ' · Assigned elsewhere' : ''}</option>)}</select></label>
        <div className="capture-requirement-actions"><button type="button" disabled={working || !assigned} onClick={() => { choose(assigned.id); changeTab('scan'); }}><Eye size={14} />Preview scan</button>{doc.submitted && doc.applicationId && <DocumentViewButton token={token} label={`Existing ${doc.label}`} endpoint={`/document-reviews/${doc.applicationId}/${doc.requirementKey}/file?academicPeriodId=${doc.academicPeriodId || scholar.academicPeriodId}&submissionWave=initial`} />}</div>
        {uploadErrors[doc.requirementKey] && <p className="capture-requirement-error">Upload failed: {uploadErrors[doc.requirementKey]}</p>}
      </div>;
    })}</div>
    <p className="capture-file-policy">{DOCUMENT_FILE_HELP}</p>
    <div className="capture-batch-actions"><p id={`${captureId}-batch-help`} className="capture-help">{pendingDrafts.length} assigned document{pendingDrafts.length === 1 ? '' : 's'}. Uploading replaces only the assigned requirements in the selected academic year. Previous versions and unassigned scans are retained.</p><button type="button" className="capture-submit" aria-describedby={`${captureId}-batch-help`} disabled={working || phoneConnected || !batchReady} onClick={publishBatch}><Upload size={15} />{working ? 'Uploading assigned documents…' : `Upload & approve assigned documents (${pendingDrafts.length})`}</button></div>
    </div>
  </section>;
}

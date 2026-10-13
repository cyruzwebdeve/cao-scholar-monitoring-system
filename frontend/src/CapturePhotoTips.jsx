import { useEffect, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { assessCapturePhoto } from './utils/capturePhotoQuality';
export default function CapturePhotoTips({ source }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (!source) return;
    let active = true;
    assessCapturePhoto(source).then((quality) => { if (active) setResult({ source, quality }); })
      .catch(() => { if (active) setResult({ source, unavailable: true }); });
    return () => { active = false; };
  }, [source]);
  if (!source) return null;
  const current = result?.source === source ? result : null;
  const warnings = current?.quality?.tips || [];
  return <aside className={`capture-photo-tips${warnings.length ? ' has-tips' : ''}`} role="status" aria-live="polite" aria-label="Tips for this captured photo">
    <header><Lightbulb size={16} aria-hidden="true" /><strong>Tips for this photo</strong></header>
    {!current ? <p>Checking lighting, detail and image size…</p> : current.unavailable ? <p>Automatic photo check unavailable. Inspect the preview before uploading.</p> : warnings.length ? <ul>{warnings.map((tip) => <li key={tip.id}><strong>{tip.title}</strong><span>{tip.detail}</span></li>)}</ul> : <p>No obvious lighting, detail or image-size warnings from these basic checks.</p>}
    <p className="capture-photo-tips-note">Check all page edges and small text yourself. These tips do not read, verify or approve the document.</p>
  </aside>;
}

import { CheckCircle2, ClipboardCheck, Info } from 'lucide-react';
import { resultAcceptanceNotice } from '../utils/examinationUi';
import '../styles/examination-ui.css';

export default function ResultAcceptanceNotice({ result, initialVerified }) {
  const notice = resultAcceptanceNotice(result, initialVerified);
  const Icon = notice.tone === 'complete' ? CheckCircle2 : notice.tone === 'ready' ? ClipboardCheck : Info;
  return <div id="rm-acceptance-guidance" className={`rm-acceptance-notice ${notice.tone}`} role="status"><Icon size={19} aria-hidden="true" /><div><strong>{notice.title}</strong><p>{notice.message}</p></div></div>;
}

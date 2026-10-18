import { Info } from 'lucide-react';
import '../styles/examination-ui.css';

export default function ResultReviewNotice() {
  return <div className="rm-review-note" role="note"><Info size={18} aria-hidden="true" /><div><strong>Publication reminder</strong><p>Saving keeps the result under review. Correcting a published score hides the outcome until CAO republishes it.</p></div></div>;
}

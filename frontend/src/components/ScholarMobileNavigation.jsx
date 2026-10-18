import { Bell, ClipboardList, FileCheck2 } from 'lucide-react';

export default function ScholarMobileNavigation() {
  return <nav className="scholar-mobile-navigation" aria-label="Scholar portal quick links">
    <a href="#scholar-updates"><Bell size={17} aria-hidden="true" /><span>Updates</span></a>
    <a href="#requirements"><FileCheck2 size={17} aria-hidden="true" /><span>Requirements</span></a>
    <a href="#scholar-summary"><ClipboardList size={17} aria-hidden="true" /><span>Summary</span></a>
  </nav>;
}

import { Search } from 'lucide-react';

export default function ReportLocationFilters({ municipalities, barangays, municipality, barangay, onMunicipalityChange, onBarangayChange, query = '', coverage = 'attention', onQueryChange, onCoverageChange }) {
  return <div className="reports-location-filters" role="group" aria-label="Priority location filters">
    <label>Municipality<select value={municipality} onChange={event => onMunicipalityChange(event.target.value)}><option value="">All municipalities</option>{municipalities.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label>Barangay<select value={barangay} disabled={!municipality} onChange={event => onBarangayChange(event.target.value)}><option value="">{municipality ? 'All barangays' : 'Select a municipality first'}</option>{barangays.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label className="reports-location-search">Search locations<div><Search size={16} aria-hidden="true" /><input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search municipality or barangay" /></div></label>
    <label>Coverage priority<select value={coverage} onChange={event => onCoverageChange(event.target.value)}><option value="attention">Low or no scholars</option><option value="none">No scholars only</option><option value="low">Low coverage only</option></select></label>
  </div>;
}

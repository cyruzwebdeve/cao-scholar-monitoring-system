export default function ReportLocationFilters({ municipalities, barangays, municipality, barangay, onMunicipalityChange, onBarangayChange }) {
  return <div className="reports-location-filters" role="group" aria-label="Priority location filters">
    <label>Municipality<select value={municipality} onChange={event => onMunicipalityChange(event.target.value)}><option value="">All municipalities</option>{municipalities.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
    <label>Barangay<select value={barangay} disabled={!municipality} onChange={event => onBarangayChange(event.target.value)}><option value="">{municipality ? 'All barangays' : 'Select a municipality first'}</option>{barangays.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
  </div>;
}

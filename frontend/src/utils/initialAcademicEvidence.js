export const isFirstYearEntry = value => [
  '1st year', 'first year', '1st year college', 'first year college',
  'incoming 1st year', 'incoming first year', 'incoming 1st year college', 'incoming first year college',
].includes(String(value || '').trim().toLowerCase().replace(/\s+/g, ' '));

export const initialRequirementItemsFor = (academicItems, entryYearLevel, files = {}) => {
  const firstYear = isFirstYearEntry(entryYearLevel);
  const items = [
    { key: 'tax_exemption', label: 'Certificate of Tax Exemption' },
    { key: 'indigency', label: 'Barangay Indigency (optional)', optional: true },
    { key: 'valid_id', label: 'Valid ID' },
    ...academicItems.map(item => item.key === 'grades' && firstYear ? { ...item, label: 'Certificate of Grades (optional for incoming/1st-year college)', optional: true } : item),
  ];
  if (firstYear || files.report_card?.fileName) items.splice(items.findIndex(item => item.key === 'grades') + 1, 0,
    { key: 'report_card', label: firstYear ? 'Grade 12 Report Card (required for incoming/1st-year college)' : 'Grade 12 Report Card (previously recorded)', optional: !firstYear });
  return items;
};

export const initialRequirementProgress = (items, files, entryYearLevel, statusOf) => {
  const required = items.filter(item => !item.optional || (item.key === 'report_card' && isFirstYearEntry(entryYearLevel)));
  return {
    total: required.length,
    approved: required.filter(item => statusOf(files[item.key]) === 'approved').length,
  };
};

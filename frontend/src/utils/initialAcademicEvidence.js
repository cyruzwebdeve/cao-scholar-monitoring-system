export const isFirstYearEntry = value => [
  '1st year', 'first year', '1st year college', 'first year college',
  'incoming 1st year', 'incoming first year', 'incoming 1st year college', 'incoming first year college',
].includes(String(value || '').trim().toLowerCase().replace(/\s+/g, ' '));

export const initialRequirementItemsFor = (academicItems, entryYearLevel, files = {}) => {
  const alternative = isFirstYearEntry(entryYearLevel);
  const items = [
    { key: 'tax_exemption', label: 'Certificate of Tax Exemption' },
    { key: 'indigency', label: 'Barangay Indigency (optional)', optional: true },
    { key: 'valid_id', label: 'Valid ID' },
    ...academicItems.map(item => item.key === 'grades' && alternative ? { ...item, label: 'Certificate of Grades (COG; or Grade 12 report card)', optional: true } : item),
  ];
  if (alternative || files.report_card?.fileName) items.splice(items.findIndex(item => item.key === 'grades') + 1, 0,
    { key: 'report_card', label: 'Grade 12 Report Card (optional, incoming/1st-year college)', optional: true });
  return items;
};

export const initialRequirementProgress = (items, files, entryYearLevel, statusOf) => {
  const required = items.filter(item => !item.optional);
  const alternative = isFirstYearEntry(entryYearLevel);
  return {
    total: required.length + (alternative ? 1 : 0),
    approved: required.filter(item => statusOf(files[item.key]) === 'approved').length
      + (alternative && ['grades', 'report_card'].some(key => statusOf(files[key]) === 'approved') ? 1 : 0),
  };
};

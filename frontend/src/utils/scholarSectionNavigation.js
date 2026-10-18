export const scholarSections = [
  { id: 'scholar-overview', label: 'Overview' },
  { id: 'scholar-summary', label: 'Summary' },
  { id: 'scholar-next-step', label: 'Next step' },
  { id: 'scholar-updates', label: 'Updates' },
  { id: 'requirements', label: 'Requirements' },
];

export const currentScholarSection = (positions, threshold, atBottom = false) => {
  const ordered = positions.filter(item => Number.isFinite(item.top)).sort((a, b) => a.top - b.top);
  if (!ordered.length) return 'scholar-overview';
  if (atBottom) return ordered.at(-1).id;
  return ordered.filter(item => item.top <= threshold).at(-1)?.id || ordered[0].id;
};

const isFirstYearEntry = value => [
  '1st year', 'first year', '1st year college', 'first year college',
  'incoming 1st year', 'incoming first year', 'incoming 1st year college', 'incoming first year college',
].includes(String(value || '').trim().toLowerCase().replace(/\s+/g, ' '));
module.exports = { isFirstYearEntry };

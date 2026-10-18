export const containScholarProfileFocus = (event, dialog, activeElement) => {
  if (event.key !== 'Tab' || !dialog) return;
  const controls = [...dialog.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')];
  const first = controls[0], last = controls.at(-1);
  if (!controls.length) { event.preventDefault(); dialog.focus(); }
  else if (!dialog.contains(activeElement) || (event.shiftKey && activeElement === first)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
  else if (!event.shiftKey && activeElement === last) { event.preventDefault(); first.focus(); }
};

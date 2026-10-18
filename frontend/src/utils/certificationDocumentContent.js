// Keep unsaved preparation documents distinct from saved list certifications.
export function certificationDocumentContent({ records, batch, activePeriod, issuedAt, mode = 'billing', preparationCopy = false }) {
  if (!['billing', 'payroll'].includes(mode)) throw new Error('Invalid list type.');
  if (preparationCopy && mode !== 'payroll') throw new Error('Word preparation export is available for Payroll only.');
  const reference = preparationCopy ? null : batch?.batchNumber || batch?.billingReference;
  if (!records?.length || (!preparationCopy && !reference) || !activePeriod?.schoolYear || !activePeriod?.semester) {
    throw new Error('A saved list reference, academic period and scholar list are required.');
  }
  const date = new Date(issuedAt || batch?.processedAt || batch?.createdAt || Date.now());
  if (Number.isNaN(date.getTime())) throw new Error('The certification date is invalid.');
  const issued = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Manila' });
  const isPayroll = mode === 'payroll';
  return {
    title: preparationCopy ? 'PAYROLL PREPARATION' : 'CERTIFICATION',
    referenceText: `${isPayroll ? 'Payroll' : 'Billing'} reference: ${preparationCopy ? 'Not assigned' : reference}`,
    introduction: school => preparationCopy
      ? `The following students are selected for payroll-list preparation for ${activePeriod.semester}, SY ${activePeriod.schoolYear}. This export does not generate an official payroll list.`
      : `This is to certify that the following students are SCHOLARSHIP GRANTEES of the Camarines Norte Provincial Government College Education Assistance Program (CNPGCEAP) and are enrolled${isPayroll ? ' in their respective schools' : ` at ${school}`} for ${activePeriod.semester}, SY ${activePeriod.schoolYear}. They are included in the ${isPayroll ? 'payroll' : 'certification'} list below.`,
    issuedText: preparationCopy
      ? `Prepared on ${issued} for staff review. Use Generate payroll list to save the list and assign its payroll reference.`
      : `Issued on ${issued} to facilitate processing of the corresponding payroll list and for whatever legal purposes this may serve.`,
    filename: `${String(preparationCopy ? `payroll-preparation-${date.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' })}` : reference).replace(/[^a-z0-9_-]/gi, '_')}.docx`,
  };
}

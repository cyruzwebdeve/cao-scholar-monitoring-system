import { MAX_DOCUMENT_BYTES } from './documentFilePolicy.js';

// Keep this enrollment-certificate wording separate from payroll-list generation.
// Its legacy tuition undertaking does not record or verify a payment release.
export async function buildIndividualScholarCertificationPdf({ snapshot, generatedAt, headerDataUrl }, loadPdf = () => import('jspdf')) {
  const details = { ...snapshot };
  if (!/^PGCEAP-CERT#\d{4,}$/.test(details.reference || '')) {
    throw new Error('Refresh the scholar certification details before generating the PDF.');
  }
  const generatedDate = generatedAt ? new Date(generatedAt) : null;
  if (!generatedDate || Number.isNaN(generatedDate.getTime())) {
    throw new Error('A valid saved certification date is required. Refresh and try again.');
  }
  if (typeof headerDataUrl !== 'string' || !headerDataUrl.startsWith('data:image/png;')) {
    throw new Error('Unable to prepare the official certificate header.');
  }
  const { jsPDF } = await loadPdf();
  const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [215.9, 330.2] });
  document.setCreationDate(generatedDate);
  const pageWidth = document.internal.pageSize.getWidth();
  const margin = 25;
  const contentWidth = pageWidth - (margin * 2);
  const reference = details.reference;
  const scholarName = String(details.name || 'Scholar').toUpperCase();
  const course = details.course || 'the declared program';
  const yearLevel = details.yearLevel || 'enrolled';
  const school = details.school || 'the declared private school';
  const semester = details.semester || 'current semester';
  const schoolYear = details.schoolYear || 'current school year';

  document.addImage(headerDataUrl, 'PNG', 32, 12, pageWidth - 64, 29);
  document.setDrawColor(35, 35, 35);
  document.setLineWidth(0.35);
  document.line(margin, 45, pageWidth - margin, 45);

  document.setTextColor(31, 78, 121);
  document.setFont('times', 'bold');
  document.setFontSize(13);
  document.text('PROVINCIAL GOVERNMENT COLLEGE', pageWidth / 2, 55, { align: 'center' });
  document.text('EDUCATION ASSISTANCE PROGRAM (PGCEAP)', pageWidth / 2, 62, { align: 'center' });

  document.setTextColor(20, 20, 20);
  document.setFontSize(16);
  document.text('CERTIFICATION', pageWidth / 2, 82, { align: 'center' });
  document.setLineWidth(0.3);
  document.line((pageWidth / 2) - 26, 84, (pageWidth / 2) + 26, 84);

  document.setFont('times', 'normal');
  document.setFontSize(10);
  document.text(`Certification No.: ${reference}`, pageWidth - margin, 96, { align: 'right' });

  document.setFont('times', 'bold');
  document.setFontSize(12);
  document.text('TO WHOM IT MAY CONCERN:', margin, 116);

  document.setFont('times', 'normal');
  document.setFontSize(12);
  const firstParagraph = `This is to certify that ${scholarName}, a ${yearLevel} ${course} student of ${school}, is a SCHOLARSHIP GRANTEE under the Provincial Government College Education Assistance Program (PGCEAP) for the ${semester}, School Year ${schoolYear}.`;
  const secondParagraph = 'As such, the Provincial Government assumes payment of the scholar\'s tuition and school fees in an amount not exceeding FIVE THOUSAND PESOS (PHP 5,000.00), subject to the applicable program requirements.';
  const issuedDate = generatedDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
  const thirdParagraph = `Issued this ${issuedDate} for enrollment purposes.`;
  const firstLines = document.splitTextToSize(firstParagraph, contentWidth);
  document.text(firstLines, margin, 132, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.6 });
  const secondY = 132 + (firstLines.length * 7.2) + 8;
  const secondLines = document.splitTextToSize(secondParagraph, contentWidth);
  document.text(secondLines, margin, secondY, { align: 'justify', maxWidth: contentWidth, lineHeightFactor: 1.6 });
  const thirdY = secondY + (secondLines.length * 7.2) + 8;
  document.text(document.splitTextToSize(thirdParagraph, contentWidth), margin, thirdY, { lineHeightFactor: 1.6 });

  const signatureY = Math.max(thirdY + 45, 225);
  document.setFont('times', 'bold');
  document.text('CHRISTABELL ANGELICA R. ABAÑO, RN, MPA', pageWidth / 2, signatureY, { align: 'center' });
  document.setFont('times', 'normal');
  document.text('Community Affairs Officer IV', pageWidth / 2, signatureY + 7, { align: 'center' });

  document.setFontSize(8);
  document.setTextColor(90, 90, 90);
  document.text(`Control No.: ${details.controlNumber || details.scholarId || 'Not available'}`, margin, 310);
  document.text('Official PGCEAP private-scholar certification', pageWidth - margin, 310, { align: 'right' });
  if (document.output('arraybuffer').byteLength > MAX_DOCUMENT_BYTES) throw new Error('The generated certificate exceeds 6 MB. Please retry with a smaller header image.');
  const base64 = document.output('datauristring').split(',')[1];
  if (!base64) throw new Error('Unable to prepare the generated certificate. Please retry.');
  return { fileData: `data:application/pdf;base64,${base64}`, fileName: `${reference}.pdf` };
}

import { certificationDocumentContent } from './certificationDocumentContent';
import { certificationListGroups } from './certificationListGroups';
import templateUrl from '../assets/templates/billing-certification.docx?url';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

// Keep the supplied letter's page setup, typography, artwork and signatory.
// Only the marked paragraphs and scholar table are populated from system records.
export async function createBillingCertificationDocument(options) {
  const { records, mode = 'billing' } = options;
  const content = certificationDocumentContent(options);
  const { default: JSZip } = await import('jszip');
  const response = await fetch(templateUrl);
  if (!response.ok) throw new Error('Unable to load the certification Word template.');
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  const document = new DOMParser().parseFromString(await zip.file('word/document.xml').async('string'), 'application/xml');
  const body = document.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body || document.getElementsByTagName('parsererror').length) throw new Error('Invalid certification template.');
  const section = [...body.children].find((element) => element.localName === 'sectPr').cloneNode(true);
  const letter = [...body.children].filter((element) => element.localName !== 'sectPr').map((element) => element.cloneNode(true));
  const element = (name, attributes = {}) => {
    const node = document.createElementNS(WORD_NS, `w:${name}`);
    Object.entries(attributes).forEach(([key, value]) => node.setAttributeNS(WORD_NS, `w:${key}`, String(value)));
    return node;
  };
  const paragraph = (text) => {
    const p = element('p');
    const spacing = element('pPr');
    spacing.append(element('spacing', { before: 0, after: 60, line: 240, lineRule: 'auto' }));
    p.append(spacing);
    const run = element('r');
    const properties = element('rPr');
    properties.append(element('sz', { val: 22 }));
    run.append(properties);
    const t = element('t'); t.textContent = String(text ?? ''); run.append(t); p.append(run);
    return p;
  };
  const table = (scholars) => {
    const node = element('tbl');
    const properties = element('tblPr');
    properties.append(element('tblW', { w: 9360, type: 'dxa' }));
    properties.append(element('tblLayout', { type: 'fixed' }));
    const borders = element('tblBorders');
    ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].forEach((edge) => borders.append(element(edge, { val: 'nil' })));
    properties.append(borders); node.append(properties);
    const widths = [4680, 4680];
    const grid = element('tblGrid'); widths.forEach((width) => grid.append(element('gridCol', { w: width }))); node.append(grid);
    const rows = [];
    for (let index = 0; index < scholars.length; index += 2) {
      rows.push([
        `${index + 1}. ${scholars[index].name}`,
        scholars[index + 1] ? `${index + 2}. ${scholars[index + 1].name}` : '',
      ]);
    }
    rows.forEach((values) => {
      const row = element('tr'); const rowProperties = element('trPr');
      rowProperties.append(element('cantSplit'));
      row.append(rowProperties);
      values.forEach((value, cellIndex) => {
        const cell = element('tc'); const cellProperties = element('tcPr');
        cellProperties.append(element('tcW', { w: widths[cellIndex], type: 'dxa' }));
        cell.append(cellProperties, paragraph(value)); row.append(cell);
      });
      node.append(row);
    });
    return node;
  };
  const groups = certificationListGroups(records, mode);
  body.replaceChildren();
  groups.forEach(({ school, scholars }, index) => {
    if (index) { const p = element('p'); const run = element('r'); run.append(element('br', { type: 'page' })); p.append(run); body.append(p); }
    const replacements = {
      'CERTIFICATION': content.title,
      '{{CERTIFICATION_INTRO}}': content.introduction(school),
      '{{BILLING_REFERENCE}}': content.referenceText,
      '{{ISSUED_DATE}}': content.issuedText,
    };
    letter.forEach((original) => {
      const node = original.cloneNode(true);
      const text = [...node.getElementsByTagNameNS(WORD_NS, 't')].map((t) => t.textContent).join('');
      if (text === '{{SCHOLAR_LIST}}') { body.append(table(scholars)); return; }
      if (Object.hasOwn(replacements, text)) node.getElementsByTagNameNS(WORD_NS, 't')[0].textContent = replacements[text];
      body.append(node);
    });
  });
  body.append(section);
  zip.file('word/document.xml', new XMLSerializer().serializeToString(document));
  return zip.generateAsync({ type: 'blob', mimeType: MIME, compression: 'DEFLATE' });
}

export async function downloadBillingCertificationDocument(options) {
  const blob = await createBillingCertificationDocument(options);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = certificationDocumentContent(options).filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

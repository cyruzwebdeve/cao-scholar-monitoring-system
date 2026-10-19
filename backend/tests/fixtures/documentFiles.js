const makePdf = () => {
  let pdf = '%PDF-1.4\n', offsets = [0];
  for (const [index, object] of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>'].entries()) {
    offsets.push(Buffer.byteLength(pdf)); pdf += `${index+1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += 'xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
};
const pdf = makePdf();
const png = require('pngjs').PNG.sync.write({width:2,height:2,data:Buffer.alloc(16,255)});
const jpg = require('jpeg-js').encode({width:2,height:2,data:Buffer.alloc(16,255)},80).data;
const dataUrl = (bytes = pdf, type = 'application/pdf') => `data:${type};base64,${bytes.toString('base64')}`;
module.exports = { pdf, png, jpg, dataUrl };

import { loadCaptureImage } from './documentCapture.js';
// Lightweight visual hints, not OCR or a certificate of document readability.
export const assessCapturePixels = ({ data, width, height, originalWidth = width, originalHeight = height }) => {
  if (width < 3 || height < 3 || data.length !== width * height * 4) throw new Error('Invalid photo sample.');
  const count = width * height, gray = new Float32Array(count), histogram = new Uint32Array(256);
  const blocks = Array.from({ length: 9 }, () => ({ sum: 0, count: 0 }));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = y * width + x, offset = index * 4;
    const value = 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
    gray[index] = value; histogram[Math.round(value)] += 1;
    const block = blocks[Math.min(2, Math.floor(y * 3 / height)) * 3 + Math.min(2, Math.floor(x * 3 / width))]; block.sum += value; block.count += 1;
  }
  const percentile = (fraction) => { let sum = 0; for (let value = 0; value < 256; value += 1) { sum += histogram[value]; if (sum >= count * fraction) return value; } return 255; };
  let sum = 0, square = 0, detailed = 0, interior = 0;
  for (let y = 1; y < height - 1; y += 1) for (let x = 1; x < width - 1; x += 1) {
    const i = y * width + x;
    const laplacian = gray[i - 1] + gray[i + 1] + gray[i - width] + gray[i + width] - 4 * gray[i];
    const gradient = Math.abs(gray[i + 1] - gray[i - 1]) + Math.abs(gray[i + width] - gray[i - width]);
    sum += laplacian; square += laplacian * laplacian; detailed += gradient > 6 ? 1 : 0; interior += 1;
  }
  const contrast = percentile(0.99) - percentile(0.01);
  const sharpness = square / interior - (sum / interior) ** 2;
  const edgeRatio = detailed / interior;
  const brightness = percentile(0.5), upperBrightness = percentile(0.9);
  const blockMeans = blocks.filter((block) => block.count).map((block) => block.sum / block.count);
  const lightingRange = Math.max(...blockMeans) - Math.min(...blockMeans);
  const tips = [];
  if (Math.min(originalWidth, originalHeight) < 700 || originalWidth * originalHeight < 1000000) tips.push({ id: 'resolution', title: 'Small image', detail: 'Move closer while keeping all document edges visible. Use the camera’s full resolution and avoid digital zoom.' });
  if (brightness < 95 && upperBrightness < 155) tips.push({ id: 'dark', title: 'Photo looks dim', detail: 'Move to a brighter, evenly lit area. Keep your phone and hands from casting a shadow over the text.' });
  if (contrast < 25 && edgeRatio < 0.005) tips.push({ id: 'detail', title: 'Very little detail detected', detail: 'Position the printed side clearly in the frame and tap the text to focus. Check that writing is visible before retaking.' });
  else if (contrast < 55) tips.push({ id: 'contrast', title: 'Details have low contrast', detail: 'Use even lighting and inspect the smallest or faded text. Retake if letters blend into the page.' });
  else if (sharpness < 25 && edgeRatio > 0.005) tips.push({ id: 'focus', title: 'Details may be soft', detail: 'Hold the camera steady, tap the printed text to focus, and wait briefly before taking another photo.' });
  if (lightingRange > 75 && Math.min(...blockMeans) < 155) tips.push({ id: 'lighting', title: 'Lighting varies across the photo', detail: 'Check darker areas for hidden text. Move away from strong shadows and use light spread evenly across the page.' });
  return { tips: tips.slice(0, 3), width: originalWidth, height: originalHeight };
};
export const assessCapturePhoto = async (source) => {
  const image = await loadCaptureImage(source);
  const scale = Math.min(1, 384 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(3, Math.round(image.naturalWidth * scale)), height = Math.max(3, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Photo check unavailable.');
  context.drawImage(image, 0, 0, width, height);
  return assessCapturePixels({ data: context.getImageData(0, 0, width, height).data, width, height, originalWidth: image.naturalWidth, originalHeight: image.naturalHeight });
};

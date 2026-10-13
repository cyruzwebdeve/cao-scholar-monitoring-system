import test from 'node:test';
import assert from 'node:assert/strict';
import { assessCapturePixels } from '../src/utils/capturePhotoQuality.js';
const sample = (pixel, dimensions = {}) => {
  const width = 96, height = 96, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const value = pixel(x,y), i = (y * width + x) * 4;
    data[i] = value; data[i+1] = value; data[i+2] = value; data[i+3] = 255;
  }
  return assessCapturePixels({ data, width, height, originalWidth:1600, originalHeight:2200, ...dimensions }).tips.map((tip)=>tip.id);
};
const checker = (x,y) => (Math.floor(x/8)+Math.floor(y/8))%2 ? 255 : 0;
test('Well-lit sharp detail produces no warning while small source resolution produces a targeted tip',()=>{
 assert.deepEqual(sample(checker),[]);
 assert.ok(sample(checker,{originalWidth:320,originalHeight:480}).includes('resolution'));
});
test('Dim image yields lighting advice; a bright white page is not labeled dark or glared',()=>{
 assert.ok(sample((x,y)=>checker(x,y) ? 50 : 15).includes('dark'));
 const blank=sample(()=>245);assert.ok(blank.includes('detail'));assert.equal(blank.includes('dark'),false);assert.equal(blank.includes('lighting'),false);
});
test('Low-contrast and smooth-detail images get different advice',()=>{
 assert.ok(sample((x,y)=>checker(x,y) ? 250 : 230).includes('contrast'));
 assert.ok(sample((x)=>Math.min(255,x*4)).includes('focus'));
});
test('Uneven exposure gets conditional advice with at most three tips',()=>{
 const tips=sample((x,y)=>x<32?25:checker(x,y),{originalWidth:320,originalHeight:480});assert.ok(tips.includes('lighting'));assert.ok(tips.length<=3);
});
test('Invalid/empty pixel samples fail explicitly, rather than claim good quality',()=>{
 assert.throws(()=>assessCapturePixels({data:[],width:1,height:1}),/Invalid/);
});

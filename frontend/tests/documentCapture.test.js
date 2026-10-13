import test from 'node:test';
import assert from 'node:assert/strict';
import { captureReady } from '../src/utils/documentCapture.js';
const docs = [{ requirementKey:'grades', submitted:false }, { requirementKey:'registration_form',submitted:true,status:'Approved' }];
test('Capture confirmation requires every applicable requirement, retaining approved originals',()=>{
 assert.equal(captureReady(docs,{},{}),false);
 assert.equal(captureReady(docs,{grades:{pages:['fixture']}},{}),true);
 assert.equal(captureReady(docs,{grades:{file:{fileName:'fixture.pdf'}}},{}),true);
 assert.equal(captureReady([{...docs[1],status:'Pending'}],{},{}),false);
});
test('Successful uploads satisfy completion without resending discarded drafts',()=>{
 assert.equal(captureReady(docs,{}, {grades:true}),true);
 assert.equal(captureReady([{requirementKey:'tuition_receipt',submitted:false}],{},{}),false);
});

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildScholarReportRows, filterScholarReportRows, scholarReportColumns } from '../src/utils/reportScholarSearch.js';
const scholar={applicantId:7,name:'Ana María Santos',controlNumber:'TEST-007',school:'Current Synthetic College',municipality:'Daet',barangay:'Common',course:'Nursing',status:'Inactive',academicPeriodId:10,schoolYear:'2027-2028',semester:'2nd Semester',inPayroll:true,payReference:'PAY-0010',email:'private@example.test',initialDocuments:[{fileName:'private.pdf'}],financialHistory:[{academicPeriodId:10,isActivePeriod:true,schoolYear:'2027-2028',inPayroll:true,payReference:'PAY-0010'},{academicPeriodId:9,schoolYear:'2026-2027',semester:'1st Semester',billed:true,billingReference:'BILL-0009',claimAmount:5000}]};
test('historical references retain their period and current membership is not duplicated',()=>{
 const source=structuredClone(scholar);source.financialHistory.push({...source.financialHistory[1]});const original=structuredClone(source);const rows=buildScholarReportRows([source]);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.historical).reference,'BILL-0009');assert.equal(rows.find(row=>row.historical).schoolYear,'2026-2027');assert.equal(rows.find(row=>!row.historical).listStatus,'Payroll listed');assert.equal(rows[0].accountStatus,'Inactive');assert.deepEqual(source,original);
});
test('search covers name/control/school/reference with accents, whitespace, combined terms and exact school year',()=>{
 const rows=buildScholarReportRows([scholar]);for(const query of [' SANTOS   maria ','test-007','nursing Daet','current synthetic','inactive'])assert.equal(filterScholarReportRows(rows,query).length,2,query);assert.equal(filterScholarReportRows(rows,'bill-0009').length,1);assert.equal(filterScholarReportRows(rows,'PAY-0010','2026-2027').length,0);assert.equal(filterScholarReportRows(rows,'Santos','2026-2027').length,1);assert.equal(filterScholarReportRows(rows,'no-match').length,0);assert.equal(filterScholarReportRows(rows,'').length,2);
});
test('table and export projection omit private documents, email and monetary release data',()=>{
 const rows=buildScholarReportRows([scholar]);assert.ok(scholarReportColumns.map(column=>column.value(rows[0])).includes('Current Synthetic College'));assert.equal(scholarReportColumns.every(column=>column.group==='Scholar records' && column.defaultSelected===false),true);for(const row of rows)for(const key of ['email','financialHistory','initialDocuments','claimAmount','allowance'])assert.equal(key in row,false,key);assert.equal(scholarReportColumns.some(column=>/amount|disburs|payment|release/i.test(column.label)),false);
});
test('unlisted and legacy rows remain searchable without inventing a reference',()=>{
 const rows=buildScholarReportRows([{...scholar,inPayroll:false,payReference:null,financialHistory:[{academicPeriodId:null,schoolYear:'Legacy period',semester:'Not specified',inPayroll:true,payReference:'PAY-LEGACY'}]}]);assert.equal(rows.find(row=>!row.historical).listStatus,'Not listed');assert.equal(rows.find(row=>!row.historical).reference,'');assert.equal(filterScholarReportRows(rows,'pay-legacy').length,1);assert.equal(filterScholarReportRows(rows,'pay-legacy','2027-2028').length,0);
});
let server,Search;
before(async()=>{server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),server:{middlewareMode:true,hmr:false},appType:'custom',optimizeDeps:{noDiscovery:true,include:[]}});Search=(await server.ssrLoadModule('/src/components/ReportScholarSearch.jsx')).default;});
after(async()=>{await server?.close();});
const render=props=>renderToStaticMarkup(createElement(Search,{rows:[],total:0,query:'',onQuery(){},onPage(){},...props}));
test('directory provides labelled search, count, escaped text and ten-row pagination',()=>{
 const rows=Array.from({length:13},(_,i)=>({...buildScholarReportRows([scholar])[0],id:String(i),name:`Synthetic <Scholar> ${i+1}`}));const first=render({rows,total:13});assert.match(first,/Search scholar records/);assert.match(first,/13 of 13 records/);assert.match(first,/Synthetic &lt;Scholar&gt; 1/);assert.doesNotMatch(first,/Synthetic &lt;Scholar&gt; 11/);assert.match(first,/Page 1 of 2/);const second=render({rows,total:13,page:2});assert.match(second,/Synthetic &lt;Scholar&gt; 13/);assert.doesNotMatch(second,/Synthetic &lt;Scholar&gt; 1<\/strong>/);assert.match(second,/Page 2 of 2/);
});
test('empty results, disabled controls and current-versus-historical guidance are explicit',()=>{
 assert.match(render({query:'missing'}),/No scholar records match your search/);assert.match(render(),/No scholar records for this school year/);const html=render({disabled:true,query:'a'});assert.match(html,/disabled=""/);assert.match(html,/Clear scholar search/);assert.match(html,/Names, school, course and account status are current/);
});

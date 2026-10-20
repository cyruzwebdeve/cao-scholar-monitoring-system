import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { buildScholarReportRows, filterScholarReportRows, scholarReportColumns, summarizePayrollReport, reportMoneyCents, formatReportMoney } from '../src/utils/reportScholarSearch.js';
const scholar={applicantId:7,name:'Ana María Santos',controlNumber:'TEST-007',school:'Current Synthetic College',municipality:'Daet',barangay:'Common',course:'Nursing',status:'Inactive',academicPeriodId:10,schoolYear:'2027-2028',semester:'2nd Semester',inPayroll:true,payReference:'PAY-0010',claimAmount:6000.55,tuitionFeeAssistance:3500.25,allowance:2500.30,claimed_date:'legacy-payment-date',email:'private@example.test',initialDocuments:[{fileName:'private.pdf'}],financialHistory:[{academicPeriodId:10,isActivePeriod:true,schoolYear:'2027-2028',inPayroll:true,payReference:'PAY-0010'},{academicPeriodId:9,schoolYear:'2026-2027',semester:'1st Semester',billed:true,billingReference:'BILL-0009',claimAmount:5000}]};
test('historical references retain their period and current membership is not duplicated',()=>{
 const source=structuredClone(scholar);source.financialHistory.push({...source.financialHistory[1]});const original=structuredClone(source);const rows=buildScholarReportRows([source]);assert.equal(rows.length,2);assert.equal(rows.find(row=>row.historical).reference,'BILL-0009');assert.equal(rows.find(row=>row.historical).schoolYear,'2026-2027');assert.equal(rows.find(row=>!row.historical).listStatus,'Payroll listed');assert.equal(rows[0].accountStatus,'Inactive');assert.deepEqual(source,original);
});
test('search covers name/control/school/reference with accents, whitespace, combined terms and exact school year',()=>{
 const rows=buildScholarReportRows([scholar]);for(const query of [' SANTOS   maria ','test-007','nursing Daet','current synthetic','inactive'])assert.equal(filterScholarReportRows(rows,query).length,2,query);assert.equal(filterScholarReportRows(rows,'bill-0009').length,1);assert.equal(filterScholarReportRows(rows,'PAY-0010','2026-2027').length,0);assert.equal(filterScholarReportRows(rows,'Santos','2026-2027').length,1);assert.equal(filterScholarReportRows(rows,'no-match').length,0);assert.equal(filterScholarReportRows(rows,'').length,2);
});
test('table and export projection omit private documents, email and monetary release data',()=>{
 const rows=buildScholarReportRows([scholar]);assert.ok(scholarReportColumns.map(column=>column.value(rows[0])).includes('Current Synthetic College'));assert.equal(scholarReportColumns.every(column=>column.group==='Scholar records' && column.defaultSelected===false),true);for(const row of rows)for(const key of ['email','financialHistory','initialDocuments','claimAmount','allowance'])assert.equal(key in row,false,key);assert.equal(scholarReportColumns.some(column=>/disburs|payment|release/i.test(column.label)),false);assert.equal(rows.find(row=>!row.historical).payrollAmount,6000.55);assert.equal(rows.find(row=>row.historical).payrollAmount,null);assert.equal('claimed_date' in rows[0],false);
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
 assert.match(render({query:'missing'}),/No scholar records match your search/);assert.match(render(),/No scholar records for these filters/);const html=render({disabled:true,query:'a'});assert.match(html,/disabled=""/);assert.match(html,/Clear scholar search/);assert.match(html,/Names, school, course and account status are current/);
});

test('payroll summary uses saved membership amounts and integer cents, excluding certification and proposed amounts',()=>{
 const source=[{...scholar,claimAmount:0.1,tuitionFeeAssistance:0,allowance:0.1,financialHistory:[]},{...scholar,applicantId:8,claimAmount:0.2,tuitionFeeAssistance:0,allowance:0.2,financialHistory:[]},{...scholar,applicantId:9,inPayroll:false,billed:true,billingReference:'BILL-OTHER',claimAmount:9999,financialHistory:[]},{...scholar,applicantId:10,inPayroll:false,billed:false,claimAmount:8888,financialHistory:[]}];
 const rows=buildScholarReportRows(source),summary=summarizePayrollReport([...rows,rows[0]]);assert.equal(summary.payrollAmount,0.3);assert.equal(summary.allowanceAmount,0.3);assert.equal(summary.tuitionAmount,0);assert.equal(summary.entries,2);assert.equal(summary.scholars,2);assert.equal(summary.lists,1);
});
test('missing, invalid and inconsistent saved breakdowns remain unknown instead of zero or inferred allowance',()=>{
 for(const fields of [{tuitionFeeAssistance:null,allowance:null},{tuitionFeeAssistance:3500,allowance:1},{tuitionFeeAssistance:-1,allowance:6001},{tuitionFeeAssistance:0,allowance:null}]){
  const rows=buildScholarReportRows([{...scholar,claimAmount:6000,financialHistory:[],...fields}]);assert.equal(rows[0].allowanceAmount,null);assert.equal(rows[0].tuitionAmount,null);const summary=summarizePayrollReport(rows);assert.equal(summary.allowanceAmount,null);assert.equal(summary.missingBreakdowns,1);assert.equal(summary.payrollAmount,6000);
 }
 const rows=buildScholarReportRows([{...scholar,claimAmount:null,financialHistory:[]}]);assert.equal(summarizePayrollReport(rows).missingAmounts,1);assert.equal(rows[0].payrollAmount,null);
 for(const amount of [null,'',' ','0x10','1e3','1,000',true,{},-1,Infinity,'invalid',1.001,100000000])assert.equal(reportMoneyCents(amount),null);
 assert.equal(reportMoneyCents('0.00'),0);assert.equal(formatReportMoney(null),'Not recorded');assert.match(formatReportMoney(0),/0.00/);
});
test('known zero breakdowns and historical snapshots retain exact values independently of current metadata',()=>{
 const rows=buildScholarReportRows([{...scholar,claimAmount:0,tuitionFeeAssistance:0,allowance:0,financialHistory:[{academicPeriodId:9,schoolYear:'2026-2027',semester:'1st Semester',inPayroll:true,payReference:'PAY-HISTORY',claimAmount:7250.25,tuitionFeeAssistance:3500,allowance:3750.25}]}]);
 assert.equal(rows.find(row=>!row.historical).breakdownStatus,'Recorded');assert.equal(rows.find(row=>row.historical).payrollAmount,7250.25);const selected=filterScholarReportRows(rows,'PAY-HISTORY','2026-2027','payroll');assert.equal(summarizePayrollReport(selected).allowanceAmount,3750.25);assert.equal(filterScholarReportRows(rows,'','All School Years','certification').length,0);
});
test('summary and table labels show payroll values and missing breakdown coverage, never released money',()=>{
 const rows=buildScholarReportRows([{...scholar,tuitionFeeAssistance:null,allowance:null,financialHistory:[]}]);const html=render({rows,total:1});assert.match(html,/Payroll list amount/);assert.match(html,/Recorded allowance/);assert.match(html,/Not recorded/);assert.match(html,/totals cover 0 of 1 payroll entries/);assert.doesNotMatch(html,/disbursed|released to|money released/i);assert.match(html,/List status/);
});

test('a current-period saved membership overrides current/default grant values for payroll reporting',()=>{
 const rows=buildScholarReportRows([{...scholar,claimAmount:9999,allowance:6499,financialHistory:[{academicPeriodId:10,isActivePeriod:true,schoolYear:'2027-2028',semester:'2nd Semester',inPayroll:true,payReference:'PAY-SNAPSHOT',claimAmount:5000,tuitionFeeAssistance:3500,allowance:1500}]}]);
 assert.equal(rows.length,1);assert.equal(rows[0].payrollAmount,5000);assert.equal(rows[0].allowanceAmount,1500);assert.equal(rows[0].reference,'PAY-SNAPSHOT');assert.equal(summarizePayrollReport(rows).payrollAmount,5000);
});

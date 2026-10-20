import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollSummaryDetails } from '../src/utils/reportPayrollDetails.js';
import { filterScholarReportRows } from '../src/utils/reportScholarSearch.js';
const row = { id:'7:1:PAY-1', applicantId:7, name:'Synthetic Scholar', controlNumber:'TEST-7', schoolYear:'2025-2026', semester:'1st Semester', reference:'PAY-1', listStatus:'Payroll listed', breakdownStatus:'Recorded', payrollAmount:5000.25, tuitionAmount:3500, allowanceAmount:1500.25 };
const rows = [row, {...row,id:'7:2:PAY-2',schoolYear:'2026-2027',reference:'PAY-2',payrollAmount:3000,breakdownStatus:'Not recorded',tuitionAmount:null,allowanceAmount:null}, {...row,id:'8:1:PAY-1',applicantId:8,name:'Synthetic Zero',payrollAmount:0,tuitionAmount:0,allowanceAmount:0}, {...row,id:'9:1:BILL-1',applicantId:9,listStatus:'Certification listed',payrollAmount:9999}, {...row,id:'10:1:none',applicantId:10,listStatus:'Not listed',payrollAmount:8888}];
test('amount detail lists only contributing unique payroll memberships, including true zero',()=>{
 const details=payrollSummaryDetails([...rows,row],'payroll');assert.equal(details.rows.length,3);assert.match(details.rows[0].amount,/5,000.25/);assert.match(details.rows[2].amount,/0.00/);assert.equal(details.rows.some(row=>/9999|8888/.test(row.amount)),false);assert.match(details.description,/across all pages/);
});
test('allocation cards exclude unknown splits and describe the missing coverage',()=>{
 for(const kind of ['tuition','allowance']){const details=payrollSummaryDetails(rows,kind);assert.equal(details.rows.length,2);assert.match(details.description,/1 entries have no complete saved/);assert.match(details.description,/missing data is not zero/);assert.match(details.rows[1].amount,/0.00/);}
});
test('Scholar details count each person once and retain their matching list references and amount coverage',()=>{
 const details=payrollSummaryDetails([...rows,row],'scholars');assert.equal(details.rows.length,2);assert.equal(details.rows[0].entries,2);assert.equal(details.rows[0].lists,'PAY-1, PAY-2');assert.match(details.rows[0].amount,/8,000.25/);assert.match(details.rows[0].coverage,/2 of 2/);
 const unknown=payrollSummaryDetails([{...row,payrollAmount:null}],'scholars');assert.equal(unknown.rows[0].amount,'Not recorded');assert.match(unknown.rows[0].coverage,/0 of 1/);
});
test('details follow supplied year/query/status filters and handle empty or unknown amounts',()=>{
 const filtered=filterScholarReportRows(rows,'PAY-2','2026-2027','payroll');assert.equal(payrollSummaryDetails(filtered,'payroll').rows.length,1);assert.equal(payrollSummaryDetails(filtered,'scholars').rows[0].entries,1);
 for(const kind of ['payroll','tuition','allowance','scholars'])assert.equal(payrollSummaryDetails([],kind).rows.length,0);
 const unknown=payrollSummaryDetails([{...row,payrollAmount:null}],'payroll');assert.equal(unknown.rows.length,0);assert.match(unknown.description,/1 entries have no valid recorded amount/);
});

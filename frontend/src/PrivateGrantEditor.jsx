import Notification from './components/Notification';
import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function PrivateGrantEditor({ record, period, token, onSaved, onBusyChange, onContinue }) {
  const [tuition,setTuition]=useState(record.tuitionFeeAssistance == null ? '' : String(record.tuitionFeeAssistance));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receiptBusy,setReceiptBusy]=useState(false);
  const receiptUrl=useRef(null);
  const preparedAt=useRef(record.grantPreparedAt || null);
  useEffect(()=>()=>{if(receiptUrl.current)URL.revokeObjectURL(receiptUrl.current);},[]);
  useEffect(() => { onBusyChange?.(busy || receiptBusy); return () => onBusyChange?.(false); }, [busy, receiptBusy, onBusyChange]);
  const total=Number(record.totalGrant ?? 5000);
  const amount=Number(tuition), cents=Math.round(amount*100);
  const valid=tuition.trim()!=='' && Number.isFinite(amount) && amount>=0 && amount<=total && amount===cents/100;
  const allowance=valid ? ((Math.round(total*100)-cents)/100).toFixed(2) : '';
  const save=async(event)=>{
    event.preventDefault();if(!valid||busy||receiptBusy)return;setBusy(true);setError('');
    try{
      const response=await fetch(`${API_BASE}/scholars/${record.applicantId}/grant-preparation`,{method:'PUT',headers:{...authHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({academicPeriodId:Number(period.id),tuitionFeeAssistance:amount,preparedAt:preparedAt.current})});
      const body=await response.json();if(!response.ok)throw new Error(body.message||'Unable to save grant preparation.');
      preparedAt.current = body.grant?.grantPreparedAt || preparedAt.current;
      if (onContinue) await onContinue();
      else await onSaved(body.message);
    }catch(failure){setError(failure.message);}finally{setBusy(false);}
  };
  const openReceipt=async()=>{
    const target=window.open('about:blank','_blank');if(target)target.opener=null;setReceiptBusy(true);setError('');
    try{
      const response=await fetch(`${API_BASE}/scholars/${record.applicantId}/tuition-receipt?academicPeriodId=${period.id}`,{headers:authHeaders(token),cache:'no-store'});
      if(!response.ok){const body=await response.json();throw new Error(body.message||'Unable to open the tuition receipt.');}
      if(!target)throw new Error('Allow pop-ups for this site and open the receipt again.');
      if(receiptUrl.current)URL.revokeObjectURL(receiptUrl.current);receiptUrl.current=URL.createObjectURL(await response.blob());target.location.href=receiptUrl.current;
    }catch(failure){target?.close();setError(failure.message);}finally{setReceiptBusy(false);}
  };
  return <form className="scholar-grant-form" aria-label="Private grant preparation" onSubmit={save}>
    <header className="scholar-grant-heading"><span>PRIVATE GRANT PREPARATION</span><h4>{record.grantPrepared?'Update':'Create'} grant record</h4><p>{period.schoolYear} · {period.semester}</p></header>
    <div className="scholar-grant-receipt-row"><p>Enter the tuition assistance from the submitted receipt.</p><button type="button" disabled={busy||receiptBusy} onClick={openReceipt}>{receiptBusy?'Opening…':'View tuition receipt'}</button></div>
    <div className="scholar-grant-fields">
      <label className="scholar-grant-total"><span>Total Grant (PHP)</span><input value={total.toFixed(2)} readOnly /></label>
      <label className="scholar-grant-tuition"><span>Tuition Fee Assistance (PHP)</span><input required type="number" min="0" max={total} step="0.01" value={tuition} onChange={(event)=>{setTuition(event.target.value);setError('');}} disabled={busy} aria-describedby="scholar-grant-tuition-help" /><small id="scholar-grant-tuition-help">PHP 0–{total.toLocaleString('en-PH')}. Enter 0 if no tuition assistance applies.</small></label>
      <label className="scholar-grant-allowance"><span>Allowance (PHP)</span><input value={allowance} readOnly /><small>Computed automatically.</small></label>
    </div>
    {tuition!==''&&!valid&&<Notification tone="error" title="Check tuition assistance">Use an amount from PHP 0 to PHP {total.toLocaleString('en-PH')} with up to two decimal places.</Notification>}{error&&<Notification tone="error" title="Grant preparation needs attention">{error}</Notification>}
    <button className="scholar-grant-save" type="submit" disabled={busy||receiptBusy||!valid}>{busy?(onContinue?'Adding…':'Saving…'):onContinue?'Add to billing':record.grantPrepared?'Update prepared record':'Save as Prepared'}</button>
  </form>;
}

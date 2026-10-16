import { useEffect, useRef, useState } from 'react';
import { API_BASE, authHeaders } from './services/api';
export default function PrivateGrantEditor({ record, period, token, onSaved, onBusyChange }) {
  const [tuition,setTuition]=useState(record.tuitionFeeAssistance == null ? '' : String(record.tuitionFeeAssistance));
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receiptBusy,setReceiptBusy]=useState(false);
  const receiptUrl=useRef(null);
  useEffect(()=>()=>{if(receiptUrl.current)URL.revokeObjectURL(receiptUrl.current);},[]);
  useEffect(() => { onBusyChange?.(busy || receiptBusy); return () => onBusyChange?.(false); }, [busy, receiptBusy, onBusyChange]);
  const amount=Number(tuition), cents=Math.round(amount*100);
  const valid=tuition.trim()!=='' && Number.isFinite(amount) && amount>=0 && amount<=5000 && amount===cents/100;
  const allowance=valid ? ((500000-cents)/100).toFixed(2) : '';
  const save=async(event)=>{
    event.preventDefault();if(!valid||busy||receiptBusy)return;setBusy(true);setError('');
    try{
      const response=await fetch(`${API_BASE}/scholars/${record.applicantId}/grant-preparation`,{method:'PUT',headers:{...authHeaders(token),'Content-Type':'application/json'},body:JSON.stringify({academicPeriodId:Number(period.id),tuitionFeeAssistance:amount,preparedAt:record.grantPreparedAt||null})});
      const body=await response.json();if(!response.ok)throw new Error(body.message||'Unable to save grant preparation.');
      await onSaved(body.message);
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
  return <form className="private-grant-editor private-grant-inline" aria-label="Private grant preparation" onSubmit={save}>
    <header><span>PRIVATE GRANT PREPARATION</span><h4>{record.grantPrepared?'Update':'Create'} grant record</h4><p>{period.schoolYear} · {period.semester}</p></header>
    <div className="billing-details-modal-body"><p>Read the submitted receipt and enter the tuition assistance. Saving prepares this period’s record; list generation assigns the batch reference.</p><button type="button" className="private-grant-receipt" disabled={busy||receiptBusy} onClick={openReceipt}>{receiptBusy?'Opening receipt…':'View tuition receipt'}</button>
      <div className="billing-details-grid"><label><span>Total Grant (PHP)</span><input value="5000.00" readOnly /></label><label><span>Tuition Fee Assistance (PHP)</span><input required type="number" min="0" max="5000" step="0.01" value={tuition} onChange={(event)=>{setTuition(event.target.value);setError('');}} disabled={busy} /><small>Enter PHP 0–5,000 from the receipt. Zero must be entered explicitly.</small></label><label><span>Allowance (PHP)</span><input value={allowance} readOnly /><small>Total Grant minus Tuition Fee Assistance.</small></label></div>
      {tuition!==''&&!valid&&<p role="alert" className="billing-details-error">Use an amount from PHP 0 to PHP 5,000 with up to two decimal places.</p>}{error&&<p role="alert" className="billing-details-error">{error}</p>}
    </div><footer><button type="submit" disabled={busy||receiptBusy||!valid}>{busy?'Saving…':record.grantPrepared?'Update prepared record':'Save as Prepared'}</button></footer>
  </form>;
}

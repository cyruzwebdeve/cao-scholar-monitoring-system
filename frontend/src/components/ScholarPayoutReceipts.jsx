import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, CalendarCheck, X } from 'lucide-react';
import {
  attendanceLabels,
  localReceiptDate,
  participationRequest,
  receiptLabel,
} from '../utils/payoutParticipation';
import {
  subscribeToVisibleRefresh,
  TIME_SENSITIVE_DATA_REFRESH_MS,
} from '../utils/dataRefresh';
import Notification from './Notification';
import PayoutScheduleCard from './PayoutScheduleCard';
import './PayoutParticipation.css';
function ReceiptDialog({ schedule, token, onClose, onSaved }) {
  const dialog = useRef(null),
    busyRef = useRef(false);
  const [receivedOn, setReceivedOn] = useState(localReceiptDate()),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const correction = schedule.receipt.status === 'received';
  useEffect(() => {
    const el = dialog.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.showModal();
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
      else
        document
          .querySelector(
            `[data-payout-schedule="${schedule.id}"] [data-receipt-trigger]`
          )
          ?.focus();
    };
  }, [schedule.id]);
  const submit = async (event) => {
    event.preventDefault();
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const body = await participationRequest(
        token,
        `/payout-schedules/${schedule.id}/receipt`,
        {
          method: 'PUT',
          body: JSON.stringify({
            action: correction ? 'withdraw' : 'received',
            expectedVersion: schedule.receipt.version,
            scheduleRevision: schedule.revision,
            receivedOn,
            confirmed,
          }),
        }
      );
      onSaved(body.receipt);
      onClose();
    } catch (failure) {
      setError(failure.message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="payout-receipt-dialog"
      aria-labelledby="payout-receipt-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busyRef.current) onClose();
      }}
    >
      <header>
        <div>
          <span className="payout-participation-eyebrow">
            YOUR PAYOUT REPORT
          </span>
          <h2 id="payout-receipt-title">
            {correction ? 'Correct receipt report' : 'Received Payout'}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close receipt confirmation"
        >
          <X size={20} />
        </button>
      </header>
      <form onSubmit={submit}>
        <p>
          <strong>{schedule.title}</strong>
          <br />
          {schedule.reference} · {schedule.schoolYear} · {schedule.semester}
        </p>
        <p>
          CAO will see this as your personal receipt report. It is separate from
          attendance and official payment verification.
        </p>
        {error && (
          <Notification tone="error" title="Receipt report not saved">
            {error}
          </Notification>
        )}
        {correction ? (
          <p>
            You reported receiving this payout on {schedule.receipt.receivedOn}.
            Withdraw this report only if it was recorded by mistake. This will
            return its status to Not confirmed.
          </p>
        ) : (
          <>
            <label className="payout-receipt-date">
              Date you received the payout
              <input
                type="date"
                required
                min={localReceiptDate(schedule.startsAt)}
                max={localReceiptDate()}
                value={receivedOn}
                disabled={busy}
                onChange={(event) => setReceivedOn(event.target.value)}
              />
            </label>
            <label className="payout-receipt-confirm">
              <input
                type="checkbox"
                required
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                I confirm that I personally received the payout for this payroll
                entry.
              </span>
            </label>
          </>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="payout-primary"
            disabled={busy || (!correction && !confirmed)}
          >
            {busy
              ? 'Saving…'
              : correction
                ? 'Withdraw receipt report'
                : 'Confirm Received Payout'}
          </button>
        </footer>
      </form>
    </dialog>,
    document.body
  );
}
export default function ScholarPayoutReceipts({ token }) {
  const [resource, setResource] = useState(null),
    [selected, setSelected] = useState(null),
    [showCancelled, setShowCancelled] = useState(false),
    [notice, setNotice] = useState('');
  const editing = useRef(false);
  const read = useCallback(async () => {
    try {
      const body = await participationRequest(
        token,
        '/payout-schedules/me/participation'
      );
      if (!editing.current) setResource({ data: body.schedules });
    } catch (failure) {
      if (!editing.current) setResource({ error: failure.message });
    }
  }, [token]);
  useEffect(() => {
    const timer = window.setTimeout(read, 0);
    const stop = subscribeToVisibleRefresh(
      () => {
        if (!editing.current) read();
      },
      { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS }
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [read]);
  const records = resource?.data || [],
    visible = records.filter(
      (row) => showCancelled || row.status === 'published'
    );
  const close = () => {
    editing.current = false;
    setSelected(null);
  };
  const open = (row) => {
    editing.current = true;
    setSelected(row);
    setNotice('');
  };
  const saved = (receipt) => {
    setResource((current) => ({
      data: current.data.map((row) =>
        row.payrollEntryId === selected.payrollEntryId
          ? { ...row, receipt }
          : row
      ),
    }));
    setNotice(
      receipt.status === 'received'
        ? 'Your Received Payout report was saved.'
        : 'Your receipt report was withdrawn.'
    );
  };
  return (
    <section
      className="scholar-payout-receipts"
      aria-labelledby="scholar-payout-receipts-title"
    >
      <header>
        <div>
          <span className="payout-participation-eyebrow">
            YOUR SCHEDULED PAYOUTS
          </span>
          <h2 id="scholar-payout-receipts-title">
            <CalendarCheck size={21} aria-hidden="true" />
            Payout attendance &amp; receipt
          </h2>
          <p>
            View your schedule attendance and confirm only payouts you
            personally received.
          </p>
        </div>
      </header>
      {notice && (
        <Notification tone="success" onDismiss={() => setNotice('')}>
          {notice}
        </Notification>
      )}
      {resource?.error ? (
        <Notification
          tone="error"
          title="Unable to load your payout schedules"
          action={
            <button type="button" onClick={read}>
              Retry
            </button>
          }
        >
          {resource.error}
        </Notification>
      ) : !resource ? (
        <p role="status">Loading your payout schedules…</p>
      ) : (
        <>
          {records.some((row) => row.status === 'cancelled') && (
            <label className="payout-history-toggle">
              <input
                type="checkbox"
                checked={showCancelled}
                onChange={(event) => setShowCancelled(event.target.checked)}
              />
              Show cancelled schedules
            </label>
          )}
          <div className="scholar-payout-receipt-list">
            {visible.map((row) => (
              <div key={row.id} data-payout-schedule={row.id}>
                <PayoutScheduleCard schedule={row}>
                  <div className="scholar-payout-response">
                    <dl>
                      <div>
                        <dt>Attendance</dt>
                        <dd>{attendanceLabels[row.attendance.status]}</dd>
                      </div>
                      <div>
                        <dt>Payout status</dt>
                        <dd>
                          <span
                            className={`payout-receipt-badge ${row.receipt.status}`}
                          >
                            {receiptLabel(row.receipt)}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {row.receipt.status === 'received' ? (
                      <div className="payout-receipt-saved">
                        <span>
                          <BadgeCheck size={18} aria-hidden="true" />
                          Received on {row.receipt.receivedOn}
                        </span>
                        <button
                          type="button"
                          data-receipt-trigger
                          onClick={() => open(row)}
                        >
                          Correct receipt report
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="payout-primary"
                          data-receipt-trigger
                          disabled={!row.canConfirm}
                          onClick={() => open(row)}
                        >
                          Received Payout
                        </button>
                        {!row.canConfirm && (
                          <p>
                            {row.status === 'cancelled'
                              ? 'This schedule is cancelled. New receipt confirmations are closed.'
                              : 'Receipt confirmation opens at the scheduled start.'}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </PayoutScheduleCard>
              </div>
            ))}
          </div>
          {!visible.length && (
            <p className="payout-participation-empty">
              {records.length
                ? 'No active payout schedules. Enable Show cancelled schedules to view your history.'
                : 'No published payout schedule has been assigned to you yet.'}
            </p>
          )}
        </>
      )}
      {selected && (
        <ReceiptDialog
          schedule={selected}
          token={token}
          onClose={close}
          onSaved={saved}
        />
      )}
    </section>
  );
}

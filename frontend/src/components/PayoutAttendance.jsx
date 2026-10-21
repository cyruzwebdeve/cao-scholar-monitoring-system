import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RefreshCw, Search, X } from 'lucide-react';
import {
  attendanceLabels,
  participationRequest,
  receiptLabel,
} from '../utils/payoutParticipation';
import { scheduleTime } from '../utils/payoutSchedules';
import {
  subscribeToVisibleRefresh,
  TIME_SENSITIVE_DATA_REFRESH_MS,
} from '../utils/dataRefresh';
import Notification from './Notification';
import './PayoutParticipation.css';
export default function PayoutAttendance({ token, scheduleId, onClose }) {
  const dialog = useRef(null),
    searchRef = useRef(null),
    busyRef = useRef(false),
    draftRef = useRef(null);
  const [resource, setResource] = useState(null),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState(null),
    [notice, setNotice] = useState(null);
  const read = useCallback(async () => {
    try {
      const data = await participationRequest(
        token,
        `/payroll/schedules/${scheduleId}/attendance`
      );
      setResource({ data });
    } catch (error) {
      setResource({ error: error.message });
    }
  }, [token, scheduleId]);
  useEffect(() => {
    const el = dialog.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    el.showModal();
    searchRef.current?.focus();
    return () => {
      el.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(read, 0);
    const stop = subscribeToVisibleRefresh(
      () => {
        if (!busyRef.current && !draftRef.current) read();
      },
      { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS }
    );
    return () => {
      clearTimeout(timer);
      stop();
    };
  }, [read]);
  const data = resource?.data;
  useEffect(() => {
    if (data?.schedule.id) searchRef.current?.focus();
  }, [data?.schedule.id]);
  const rows = useMemo(
    () =>
      data?.rows.filter(
        (row) =>
          (!query.trim() ||
            `${row.name} ${row.municipality}`
              .toLowerCase()
              .includes(query.trim().toLowerCase())) &&
          (filter === 'all' ||
            (filter === 'received'
              ? row.receipt.status === 'received'
              : row.attendance.status === filter))
      ) || [],
    [data, query, filter]
  );
  const pages = Math.max(1, Math.ceil(rows.length / 25)),
    currentPage = Math.min(page, pages);
  const refresh = () => {
    if (busyRef.current) return;
    draftRef.current = null;
    setDraft(null);
    setNotice(null);
    setResource(null);
    read();
  };
  const save = async (pending) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setNotice(null);
    draftRef.current = pending;
    setDraft(pending);
    try {
      const body = await participationRequest(
        token,
        `/payroll/schedules/${scheduleId}/attendance/${pending.applicantId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            attendance: pending.attendance,
            expectedVersion: pending.version,
            scheduleRevision: data.schedule.revision,
          }),
        }
      );
      setResource((current) => ({
        data: {
          ...current.data,
          rows: current.data.rows.map((row) =>
            row.applicantId === pending.applicantId
              ? { ...row, attendance: body.attendance }
              : row
          ),
        },
      }));
      draftRef.current = null;
      setDraft(null);
      setNotice({
        tone: 'success',
        text: 'Attendance saved. Payout receipt status is unchanged.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error.message,
        canRetry: !error.status || error.status >= 500,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="payout-attendance-dialog"
      aria-labelledby="payout-attendance-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busyRef.current) onClose();
      }}
    >
      <header>
        <div>
          <span className="payout-participation-eyebrow">PAYOUT SCHEDULE</span>
          <h2 id="payout-attendance-title">Attendance &amp; payout status</h2>
          {data && (
            <p>
              {data.schedule.title} · {data.schedule.reference}
              <br />
              {scheduleTime(data.schedule.startsAt)} · {data.schedule.venue}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Close attendance"
        >
          <X size={20} />
        </button>
      </header>
      <div className="payout-attendance-body">
        {resource?.error ? (
          <Notification
            tone="error"
            title="Unable to load attendance"
            action={<button onClick={refresh}>Retry</button>}
          >
            {resource.error}
          </Notification>
        ) : !data ? (
          <p role="status">Loading attendance…</p>
        ) : (
          <>
            <p className="payout-participation-help">
              Mark attendance for this schedule. Payout status is reported by
              the Scholar; attendance does not confirm receipt.
            </p>
            {!data.schedule.canRecord && (
              <Notification
                title={
                  data.schedule.status === 'cancelled'
                    ? 'Cancelled schedule · read only'
                    : 'Attendance opens at the scheduled start'
                }
              >
                Saved attendance and receipt reports remain visible.
              </Notification>
            )}
            {notice && (
              <Notification
                tone={notice.tone}
                title="Attendance update"
                action={
                  notice.canRetry && draft ? (
                    <button disabled={busy} onClick={() => save(draft)}>
                      Retry save
                    </button>
                  ) : undefined
                }
              >
                {notice.text}
              </Notification>
            )}
            <div className="payout-attendance-summary">
              {Object.entries(attendanceLabels).map(([key, label]) => (
                <span key={key}>
                  <strong>
                    {
                      data.rows.filter((row) => row.attendance.status === key)
                        .length
                    }
                  </strong>{' '}
                  {label}
                </span>
              ))}
              <span>
                <strong>
                  {
                    data.rows.filter((row) => row.receipt.status === 'received')
                      .length
                  }
                </strong>{' '}
                Scholar-confirmed
              </span>
            </div>
            <div className="payout-attendance-filters">
              <label>
                <span>Find Scholar</span>
                <div>
                  <Search size={16} aria-hidden="true" />
                  <input
                    ref={searchRef}
                    type="search"
                    value={query}
                    maxLength={100}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Name or municipality"
                  />
                </div>
              </label>
              <label>
                <span>Show records</span>
                <select
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All recipients</option>
                  {Object.entries(attendanceLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                  <option value="received">Received — scholar-confirmed</option>
                </select>
              </label>
            </div>
            <p role="status" className="payout-participation-count">
              {rows.length} of {data.rows.length} recipients
            </p>
            <div className="payout-attendance-table">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Scholar</th>
                    <th scope="col">Attendance</th>
                    <th scope="col">Payout status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .slice((currentPage - 1) * 25, currentPage * 25)
                    .map((row) => (
                      <tr key={row.applicantId}>
                        <td data-label="Scholar">
                          <strong>{row.name}</strong>
                          <small>{row.municipality}</small>
                        </td>
                        <td data-label="Attendance">
                          <select
                            aria-label={`Attendance for ${row.name}`}
                            disabled={
                              busy ||
                              !data.schedule.canRecord ||
                              Boolean(draft && notice?.tone === 'error')
                            }
                            value={
                              draft?.applicantId === row.applicantId
                                ? draft.attendance
                                : row.attendance.status
                            }
                            onChange={(event) =>
                              save({
                                applicantId: row.applicantId,
                                attendance: event.target.value,
                                version: row.attendance.version,
                              })
                            }
                          >
                            {Object.entries(attendanceLabels).map(
                              ([key, label]) => (
                                <option value={key} key={key}>
                                  {label}
                                </option>
                              )
                            )}
                          </select>
                          {row.previousAttendance?.scheduleStart && (
                            <small>
                              Previous date (
                              {scheduleTime(
                                row.previousAttendance.scheduleStart
                              )}
                              ):{' '}
                              {attendanceLabels[row.previousAttendance.status]}.
                              Mark attendance for the current date.
                            </small>
                          )}
                        </td>
                        <td data-label="Payout status">
                          <span
                            className={`payout-receipt-badge ${row.receipt.status}`}
                          >
                            {receiptLabel(row.receipt)}
                          </span>
                          {row.receipt.receivedOn && (
                            <small>Received on {row.receipt.receivedOn}</small>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {!rows.length && (
              <p className="payout-participation-empty">
                No recipients match these filters.
              </p>
            )}
          </>
        )}
      </div>
      <footer>
        <button type="button" disabled={busy} onClick={refresh}>
          <RefreshCw size={15} />
          Refresh records
        </button>
        {data && (
          <div>
            <span>
              Page {currentPage} of {pages}
            </span>
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
            >
              Previous
            </button>
            <button
              disabled={currentPage >= pages}
              onClick={() => setPage(currentPage + 1)}
            >
              Next
            </button>
          </div>
        )}
        <button type="button" disabled={busy} onClick={onClose}>
          Close
        </button>
      </footer>
    </dialog>,
    document.body
  );
}

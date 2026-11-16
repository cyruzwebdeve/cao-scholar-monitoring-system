import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { API_BASE, authHeaders } from './api';
import { createExaminationScheduleEditor, examinationThumbnailKey } from '../utils/examinationSchedules';
import { subscribeToVisibleRefresh, TIME_SENSITIVE_DATA_REFRESH_MS } from '../utils/dataRefresh';

export const useExaminationSchedules = (token, templates) => {
  const editor = useMemo(() => {
    const request = async (options) => {
      const response = await fetch(`${API_BASE}/examinations/management`, options);
      const body = await response.json();
      if (!response.ok) throw Object.assign(new Error(body.message || 'Unable to load or save examination schedules.'), { status: response.status });
      return body;
    };
    return createExaminationScheduleEditor({ templates,
      loadSchedules: signal => request({ headers: authHeaders(token), cache: 'no-store', signal }),
      saveSchedules: (payload, signal) => request({ method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders(token) }, body: JSON.stringify(payload), signal }),
      readThumbnails: schoolYear => JSON.parse(localStorage.getItem(examinationThumbnailKey(schoolYear)) || '{}'),
      writeThumbnails: (schoolYear, thumbnails) => localStorage.setItem(examinationThumbnailKey(schoolYear), JSON.stringify(thumbnails)),
      onSaved: () => {
        try { localStorage.setItem('examinationScheduleRevision', String(Date.now())); } catch { /* Refresh remains available. */ }
        window.dispatchEvent(new Event('exam-schedule-persisted'));
      },
    });
  }, [token, templates]);
  const state = useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
  useEffect(() => {
    editor.start();
    void editor.load({ force: true });
    const reload = () => { void editor.load({ force: true }); };
    const stopRefreshing = subscribeToVisibleRefresh(() => editor.load(), { intervalMs: TIME_SENSITIVE_DATA_REFRESH_MS });
    window.addEventListener('academic-period-changed', reload);
    return () => { stopRefreshing(); window.removeEventListener('academic-period-changed', reload); editor.stop(); };
  }, [editor]);
  return { ...state, editor };
};

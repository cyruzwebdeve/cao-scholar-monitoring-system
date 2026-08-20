import { Activity, MonitorSmartphone, RefreshCw, Server, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE } from '../services/api';

const SAMPLE_INTERVAL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 75_000;
const MAX_SAMPLES = 20;

const classifyLatency = (value, thresholds) => {
  if (!Number.isFinite(value)) return 'offline';
  if (value <= thresholds.healthy) return 'healthy';
  if (value <= thresholds.degraded) return 'degraded';
  return 'slow';
};

const statusLabels = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  slow: 'Slow',
  offline: 'Unavailable',
  checking: 'Checking',
};

const averageOf = (samples, key) => {
  const values = samples.map((sample) => sample[key]).filter(Number.isFinite);
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
};

function HealthGraph({ samples, valueKey, color, label }) {
  const values = samples.map((sample) => sample[valueKey]);
  const availableValues = values.filter(Number.isFinite);
  const ceiling = Math.max(10, ...availableValues);
  const width = 320;
  const height = 92;
  const inset = 8;
  const xFor = (index) => inset + (index * (width - inset * 2)) / Math.max(1, values.length - 1);
  const yFor = (value) => height - inset - (value / ceiling) * (height - inset * 2);
  const segments = [];
  let current = [];

  values.forEach((value, index) => {
    if (Number.isFinite(value)) {
      current.push(`${xFor(index)},${yFor(value)}`);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  });
  if (current.length) segments.push(current);

  return (
    <div className="system-health-chart">
      <div className="system-health-axis"><span>{Math.round(ceiling)} ms</span><span>0 ms</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label} latency history`} preserveAspectRatio="none">
        <line x1={inset} y1={height / 2} x2={width - inset} y2={height / 2} className="system-health-gridline" />
        <line x1={inset} y1={height - inset} x2={width - inset} y2={height - inset} className="system-health-gridline" />
        {segments.map((points, index) => (
          <polyline key={`${points[0]}-${index}`} points={points.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {values.map((value, index) => Number.isFinite(value) && (
          <circle key={`${value}-${index}`} cx={xFor(index)} cy={yFor(value)} r="2.7" fill={color} />
        ))}
      </svg>
      {!availableValues.length && <div className="system-health-chart-empty">Waiting for the first sample...</div>}
    </div>
  );
}

function HealthCard({ type, samples, checking }) {
  const isFrontend = type === 'frontend';
  const valueKey = isFrontend ? 'frontendLatency' : 'backendLatency';
  const latest = samples.at(-1);
  const latency = latest?.[valueKey];
  const status = checking && !latest
    ? 'checking'
    : isFrontend
      ? classifyLatency(latency, { healthy: 50, degraded: 150 })
      : latest?.backendOnline === false
        ? 'offline'
        : classifyLatency(latency, { healthy: 800, degraded: 2500 });
  const Icon = isFrontend ? MonitorSmartphone : Server;
  const average = averageOf(samples, valueKey);

  return (
    <article className={`system-health-card ${status}`}>
      <header>
        <span className="system-health-card-icon"><Icon size={18} /></span>
        <div><h4>{isFrontend ? 'Frontend health' : 'Backend health'}</h4><p>{isFrontend ? 'Browser interface responsiveness' : 'API round trip and database check'}</p></div>
        <span className={`system-health-state ${status}`}><i />{statusLabels[status]}</span>
      </header>
      <div className="system-health-reading">
        <div><strong>{Number.isFinite(latency) ? Math.round(latency) : '--'}</strong><span>ms latest</span></div>
        <div><strong>{Number.isFinite(average) ? average : '--'}</strong><span>ms average</span></div>
        {!isFrontend && <div><strong>{Number.isFinite(latest?.databaseLatency) ? Math.round(latest.databaseLatency) : '--'}</strong><span>ms database</span></div>}
      </div>
      <HealthGraph samples={samples} valueKey={valueKey} color={isFrontend ? '#2f86d6' : '#159653'} label={isFrontend ? 'Frontend' : 'Backend'} />
      <footer><span>Last {MAX_SAMPLES} checks</span><span>{latest?.checkedAt ? new Date(latest.checkedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : 'Not checked yet'}</span></footer>
    </article>
  );
}

function SystemHealthPanel() {
  const [samples, setSamples] = useState([]);
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const checkingRef = useRef(false);

  const requestRefresh = useCallback(() => {
    if (!checkingRef.current) setRefreshKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    let nextCheckTimer;
    let activeController;

    const collectSample = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      if (active) setChecking(true);

      const frontendStartedAt = performance.now();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      const frontendLatency = Math.max(0, performance.now() - frontendStartedAt);
      const backendStartedAt = performance.now();
      let backendLatency = null;
      let databaseLatency = null;
      let backendOnline = false;
      activeController = new AbortController();
      const timeout = window.setTimeout(() => activeController?.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_BASE}/health`, { cache: 'no-store', signal: activeController.signal });
        const body = await response.json().catch(() => ({}));
        backendLatency = performance.now() - backendStartedAt;
        databaseLatency = body.databaseLatencyMs == null ? null : Number(body.databaseLatencyMs);
        backendOnline = response.ok && body.status === 'healthy' && body.database === 'connected';
      } catch {
        backendOnline = false;
      } finally {
        window.clearTimeout(timeout);
      }

      if (active) {
        setSamples((current) => [...current, {
          checkedAt: Date.now(),
          frontendLatency,
          backendLatency,
          databaseLatency: Number.isFinite(databaseLatency) ? databaseLatency : null,
          backendOnline,
        }].slice(-MAX_SAMPLES));
        setChecking(false);
        checkingRef.current = false;
        nextCheckTimer = window.setTimeout(collectSample, SAMPLE_INTERVAL_MS);
      }
    };

    collectSample();
    return () => {
      active = false;
      checkingRef.current = false;
      activeController?.abort();
      window.clearTimeout(nextCheckTimer);
    };
  }, [refreshKey]);

  const backendUnavailable = samples.at(-1)?.backendOnline === false;

  return (
    <section className="dashboard-surface system-health-panel">
      <div className="dashboard-surface-header">
        <div><span className="dashboard-panel-icon blue"><Activity size={16} /></span><div><h3>System Health</h3><p>Live responsiveness from this browser and the deployed API.</p></div></div>
        <button type="button" className="system-health-refresh" onClick={requestRefresh} disabled={checking}><RefreshCw size={13} className={checking ? 'spinning' : ''} />{checking ? 'Checking...' : 'Refresh'}</button>
      </div>
      {backendUnavailable && <div className="system-health-warning"><WifiOff size={15} /><span>The API or database did not respond to the latest health check.</span></div>}
      <div className="system-health-grid">
        <HealthCard type="frontend" samples={samples} checking={checking} />
        <HealthCard type="backend" samples={samples} checking={checking} />
      </div>
      <p className="system-health-note">Samples refresh every 30 seconds while this dashboard is open. A long first backend response can indicate a Render cold start.</p>
    </section>
  );
}

export default SystemHealthPanel;

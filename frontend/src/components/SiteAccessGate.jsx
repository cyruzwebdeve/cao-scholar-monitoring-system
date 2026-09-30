import { useCallback, useEffect, useState } from 'react';
import { KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  API_BASE,
  saveSiteAccessToken,
  SITE_ACCESS_REQUIRED_EVENT,
} from '../services/api';
import './SiteAccessGate.css';

export default function SiteAccessGate({ children }) {
  const [state, setState] = useState('checking');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const checkAccess = useCallback(async () => {
    setState('checking');
    try {
      const response = await fetch(`${API_BASE}/site-access/status`, { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.message || 'Unable to verify private access.');
      if (body.authorized) {
        setState('authorized');
        setError('');
      } else {
        saveSiteAccessToken('');
        setState('locked');
      }
    } catch (requestError) {
      setError(requestError.message || 'The private access service is currently unavailable.');
      setState('unavailable');
    }
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(checkAccess, 0);
    const handleRequired = () => {
      setPassword('');
      setError('Your shared access session expired. Enter the password again.');
      setState('locked');
    };
    window.addEventListener(SITE_ACCESS_REQUIRED_EVENT, handleRequired);
    return () => {
      window.clearTimeout(initialCheck);
      window.removeEventListener(SITE_ACCESS_REQUIRED_EVENT, handleRequired);
    };
  }, [checkAccess]);

  const unlock = async (event) => {
    event.preventDefault();
    if (!password) return setError('Enter the tester access code provided by the project administrator.');
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/site-access/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.authorized) throw new Error(body?.message || 'Private access was not authorized.');
      saveSiteAccessToken(body.token || '');
      setPassword('');
      setState('authorized');
    } catch (requestError) {
      setError(requestError.message || 'Private access was not authorized.');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'authorized') return children;

  return (
    <main className="site-access-shell">
      <section className="site-access-card" aria-labelledby="site-access-title">
        <div className="site-access-mark" aria-hidden="true"><ShieldCheck /></div>
        <p className="site-access-kicker">INVITATION-ONLY TESTING</p>
        <h1 id="site-access-title">Authorized tester access</h1>
        {state === 'checking' ? (
          <div className="site-access-status" role="status" aria-live="polite">
            <span className="site-access-spinner" /> Verifying access&hellip;
          </div>
        ) : (
          <>
            <p className="site-access-description">
              This page is a preliminary testing checkpoint, not the PGCEAP account sign-in.
            </p>
            <p className="site-access-warning" id="site-access-warning">
              <strong>Do not enter your applicant, scholar, or administrator password.</strong>
              Enter only the separate tester access code sent directly by the project administrator.
            </p>
            {state === 'unavailable' ? (
              <button type="button" className="site-access-retry" onClick={checkAccess}>
                Retry verification
              </button>
            ) : (
              <form onSubmit={unlock} className="site-access-form">
                <label htmlFor="tester-access-code">Tester access code</label>
                <div className="site-access-input">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="tester-access-code"
                    name="deployment-tester-access-code"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="off"
                    aria-describedby="site-access-warning"
                    maxLength={256}
                  />
                </div>
                <button type="submit" disabled={submitting}>
                  <KeyRound size={17} aria-hidden="true" />
                  {submitting ? 'Verifying…' : 'Continue to account sign-in'}
                </button>
              </form>
            )}
            {error && <p className="site-access-error" role="alert">{error}</p>}
          </>
        )}
        <small>No tester access code? Close this page and contact the project administrator.</small>
      </section>
    </main>
  );
}

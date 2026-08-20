import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import AuthPageShell from './components/AuthPageShell';
import { API_BASE } from './services/api';

const passwordRequirement = 'Use 12–128 characters with an uppercase letter, lowercase letter, and number.';

function PasswordRecoveryPage({ mode }) {
  const [searchParams] = useSearchParams();
  const resetToken = useMemo(() => searchParams.get('token') || '', [searchParams]);
  const isReset = mode === 'reset';
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to request a password reset.');
      setSuccess(body.message || 'If an active account matches those details, a password reset link has been sent.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the password reset service.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    setError('');
    if (!resetToken) {
      setError('This password reset link is incomplete. Request a new link to continue.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (password.length < 12 || password.length > 128 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
      setError(passwordRequirement);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || 'Unable to reset your password.');
      setPassword('');
      setConfirmPassword('');
      setSuccess(body.message || 'Your password has been updated. You can now sign in.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to connect to the password reset service.');
    } finally {
      setLoading(false);
    }
  };

  const title = isReset ? 'Choose a new password' : 'Reset your password';
  const description = isReset
    ? 'Create a strong new password for your PGCEAP portal account.'
    : 'Enter the email address or control number connected to your account.';

  return (
    <AuthPageShell>
      <div className="login-card-header recovery-card-header">
        <span className="recovery-heading-icon" aria-hidden="true">
          {isReset ? <KeyRound size={21} /> : <Mail size={21} />}
        </span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>

      {success ? (
        <div className="recovery-success" role="status">
          <span><CheckCircle2 size={25} /></span>
          <div>
            <strong>{isReset ? 'Password updated' : 'Check your email'}</strong>
            <p>{success}</p>
          </div>
          <Link to="/login">Return to sign in <ArrowRight size={16} /></Link>
        </div>
      ) : isReset ? (
        <form className="login-form recovery-form" onSubmit={handleResetPassword}>
          {!resetToken && (
            <p className="form-error" role="alert">This reset link is incomplete. Request a new password reset email.</p>
          )}
          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <div className="input-with-icon">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter a new password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength="12"
                maxLength="128"
                required
              />
              <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div className="form-field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <div className="input-with-icon">
              <ShieldCheck size={18} aria-hidden="true" />
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Enter the password again"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength="12"
                maxLength="128"
                required
              />
            </div>
          </div>
          <p className="recovery-password-hint">{passwordRequirement}</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading || !resetToken}>
            {loading ? 'Updating password...' : 'Update password'} <ArrowRight size={18} />
          </button>
          <Link className="recovery-back-link" to="/forgot-password"><ArrowLeft size={15} /> Request a new link</Link>
        </form>
      ) : (
        <form className="login-form recovery-form" onSubmit={handleForgotPassword}>
          <div className="form-field">
            <label htmlFor="recovery-identifier">Email or control number</label>
            <div className="input-with-icon">
              <Mail size={18} aria-hidden="true" />
              <input
                id="recovery-identifier"
                type="text"
                autoComplete="username"
                placeholder="Email or e.g. PGCEAP-001"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                maxLength="150"
                required
              />
            </div>
          </div>
          <p className="recovery-privacy-note">For account security, we will show the same confirmation whether or not an account is found.</p>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Sending reset link...' : 'Send reset link'} <ArrowRight size={18} />
          </button>
          <Link className="recovery-back-link" to="/login"><ArrowLeft size={15} /> Back to sign in</Link>
        </form>
      )}
    </AuthPageShell>
  );
}

export default PasswordRecoveryPage;

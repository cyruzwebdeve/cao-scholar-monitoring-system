import { useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { API_BASE } from '../services/api';

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isAdminFormat = email.includes('@');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.message || 'Authentication failed.');
        setLoading(false);
        return;
      }
      onLogin(body.token, body.user);
    } catch {
      setError('Unable to connect to backend.');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div className="form-field">
        <label htmlFor="auth-email">Email or control number</label>
        <div className="input-with-icon">
          <Mail size={18} aria-hidden="true" />
          <input id="auth-email" type="text" placeholder="Email or e.g. PGCEAP-001" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="form-field">
        <label htmlFor="auth-password">Password</label>
        <div className="input-with-icon">
          <LockKeyhole size={18} aria-hidden="true" />
          <input id="auth-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>
      <div className="login-links">
        <button type="button" className="login-forgot" onClick={() => setError('Forgot password support is not yet available.')}>Forgot Password?</button>
      </div>
      <button type="submit" className="login-submit" disabled={loading}>
        {loading ? 'Signing in...' : `Continue as ${email && isAdminFormat ? 'Admin' : 'Applicant / Scholar'}`} <ArrowRight size={18} />
      </button>
        <button type="button" className="login-apply-link" onClick={() => window.open('/application', '_blank', 'noopener,noreferrer')}>
          No account? <span>Apply Here</span>
        </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </form>
  );
}

export default LoginForm;

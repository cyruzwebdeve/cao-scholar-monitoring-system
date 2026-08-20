import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import AuthPageShell from './components/AuthPageShell';
import LoginForm from './components/LoginForm';

function LoginPage({ token, user, onLogin }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (token && user) {
      navigate(user.role === 'Scholar' ? '/scholar-dashboard' : user.role === 'Applicant' ? '/applicant-dashboard' : '/dashboard', { replace: true });
    }
  }, [token, user, navigate]);

  return (
    <AuthPageShell>
        <div className="login-card-header">
          <h2>Welcome back</h2>
          <p>Track your scholarship application and progress.</p>
        </div>
        <LoginForm onLogin={onLogin} />
        <p className="login-security-note"><ShieldCheck size={15} /> Your information is protected and kept confidential.</p>
    </AuthPageShell>
  );
}

export default LoginPage;

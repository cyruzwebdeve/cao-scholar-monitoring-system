// App.jsx
import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import ApplicationPage from './ApplicationPage';
import ScholarDashboard from './ScholarDashboard';
import ApplicantDashboard from './ApplicantDashboard';
import './index.css';
import ExamPage from './ExamPage';

const isAdminRole = (role) =>
  role === 'BillingPayrollAdmin' || role === 'RegularAdmin' || role === 'SuperAdmin' || role === 'Moderator';

const getDefaultSectionForRole = (role) =>
  role === 'Moderator' ? 'Content Management' : 'Dashboard';

const getRoleLabel = (role) => {
  if (role === 'SuperAdmin') return 'Super Administrator';
  if (role === 'Moderator') return 'Content Moderator';
  if (role === 'BillingPayrollAdmin') return 'Billing / Payroll Admin';
  if (role === 'RegularAdmin') return 'Administrator';
  return 'Administrator';
};

const getRoleSubtitle = (role) => {
  if (role === 'SuperAdmin') return 'Administrator';
  if (role === 'Moderator') return 'Moderator';
  if (role === 'BillingPayrollAdmin') return 'Billing and Payroll';
  if (role === 'RegularAdmin') return 'Admin Workspace';
  return 'Admin';
};

const getInitialAuthState = () => {
  try {
    const stored = localStorage.getItem('authState');
    if (!stored) return { token: '', user: null };

    const parsed = JSON.parse(stored);
    if (parsed?.token && parsed?.user) {
      return { token: parsed.token, user: parsed.user };
    }

    return { token: '', user: null };
  } catch (error) {
    console.warn('Unable to restore auth state:', error);
    return { token: '', user: null };
  }
};

function App() {
  const initialAuthState = getInitialAuthState();
  const [authToken, setAuthToken] = useState(initialAuthState.token);
  const [user, setUser] = useState(initialAuthState.user);
  const [activeSection, setActiveSection] = useState(
    getDefaultSectionForRole(initialAuthState.user?.role),
  );

  const persistAuthState = (token, loggedUser) => {
    localStorage.setItem('authState', JSON.stringify({ token, user: loggedUser }));
  };

  const clearAuthState = () => {
    localStorage.removeItem('authState');
  };

  const handleLogin = (token, loggedUser) => {
    setAuthToken(token);
    setUser(loggedUser);
    setActiveSection(getDefaultSectionForRole(loggedUser?.role));
    persistAuthState(token, loggedUser);
  };

  const handleLogout = () => {
    setAuthToken('');
    setUser(null);
    setActiveSection('Dashboard');
    clearAuthState();
  };

  const handleUserUpdate = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('authState', JSON.stringify({ token: authToken, user: updatedUser }));
  };

  const getHomeRedirect = () => {
    if (!authToken || !user) return '/application';
    if (user.role === 'Scholar') return '/scholar-dashboard';
    if (user.role === 'Applicant') return '/applicant-dashboard';
    return isAdminRole(user.role) ? '/dashboard' : '/application';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/examination" element={<ExamPage token={authToken} />} />
        <Route path="/exam" element={<ExamPage token={authToken} />} />
        <Route
          path="/login"
          element={
            authToken && user ? (
              <Navigate to={getHomeRedirect()} replace />
            ) : (
              <LoginPage token={authToken} user={user} onLogin={handleLogin} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            authToken && user ? (
              isAdminRole(user.role) ? (
                <div className="dashboard-page-wrapper">
                  <div className="dashboard-page-header">
                    <div className="dashboard-page-header-inner">
                      <div className="dashboard-page-header-copy">
                        <h1>PGCEAP SCHOLARSHIP MANAGEMENT SYSTEM</h1>
                      </div>
                      <div className="dashboard-page-user">
                        <div className="dashboard-page-user-copy">
                          <strong>{getRoleLabel(user?.role)}</strong>
                          <span>{getRoleSubtitle(user?.role)}</span>
                        </div>
                        <div className="dashboard-page-user-avatar" aria-hidden="true">
                          {user?.role === 'SuperAdmin'
                            ? 'S'
                            : user?.role === 'Moderator'
                              ? 'M'
                              : 'B'}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="app-shell">
                    <Sidebar
                      onLogout={handleLogout}
                      activeSection={activeSection}
                      onSectionChange={setActiveSection}
                      role={user.role}
                    />
                    <main className="dashboard-content">
                      <Dashboard token={authToken} user={user} activeSection={activeSection} onSectionChange={setActiveSection} />
                    </main>
                  </div>
                </div>
              ) : (
                <Navigate to="/application" replace />
              )
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/application"
          element={<ApplicationPage token={authToken} user={user} />}
        />
        <Route
          path="/scholar-dashboard"
          element={
            authToken && user ? (
              user.role === 'Scholar' ? <ScholarDashboard token={authToken} user={user} onLogout={handleLogout} /> : <Navigate to={getHomeRedirect()} replace />
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/applicant-dashboard"
          element={
            authToken && user ? (
              user.role === 'Applicant' ? <ApplicantDashboard token={authToken} user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} /> : <Navigate to={getHomeRedirect()} replace />
            ) : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/"
          element={<Navigate to={getHomeRedirect()} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

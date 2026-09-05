// App.jsx
import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';

const ApplicantDashboard = lazy(() => import('./ApplicantDashboard'));
const ApplicationPage = lazy(() => import('./ApplicationPage'));
const Dashboard = lazy(() => import('./Dashboard'));
const ExamPage = lazy(() => import('./ExamPage'));
const LandingPage = lazy(() => import('./LandingPage'));
const LoginPage = lazy(() => import('./LoginPage'));
const PasswordRecoveryPage = lazy(() => import('./PasswordRecoveryPage'));
const ScholarDashboard = lazy(() => import('./ScholarDashboard'));
const Sidebar = lazy(() => import('./components/Sidebar'));

const isAdminRole = (role) =>
  role === 'BillingPayrollAdmin' || role === 'RegularAdmin' || role === 'SuperAdmin' || role === 'Moderator';

const sectionLabels = {
  dashboard: 'Dashboard', applicants: 'Applicants', examination: 'Examination Management',
  scholars: 'Scholars', billing: 'Billing', payroll: 'Payroll',
  announcements: 'Announcements', reports: 'Reports', settings: 'Settings', documentReviews: 'Document Reviews',
};
const getDefaultSectionForRole = (role, sectionAccess) => {
  if (role === 'SuperAdmin') return 'Dashboard';
  if (Array.isArray(sectionAccess)) return sectionLabels[sectionAccess[0]] || 'Settings';
  return role === 'Moderator' ? 'Document Reviews' : 'Dashboard';
};

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
    getDefaultSectionForRole(initialAuthState.user?.role, initialAuthState.user?.sectionAccess),
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [sidebarOpen]);

  const persistAuthState = (token, loggedUser) => {
    localStorage.setItem('authState', JSON.stringify({ token, user: loggedUser }));
  };

  const clearAuthState = () => {
    localStorage.removeItem('authState');
  };

  const handleLogin = (token, loggedUser) => {
    setAuthToken(token);
    setUser(loggedUser);
    setActiveSection(getDefaultSectionForRole(loggedUser?.role, loggedUser?.sectionAccess));
    persistAuthState(token, loggedUser);
  };

  const handleLogout = () => {
    setAuthToken('');
    setUser(null);
    setActiveSection('Dashboard');
    setSidebarOpen(false);
    clearAuthState();
  };

  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSidebarOpen(false);
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
      <Suspense fallback={<div className="route-loading"><span className="route-loading-mark" />Loading PGCEAP...</div>}>
        <Routes>
        <Route path="/examination" element={<ExamPage token={authToken} />} />
        <Route path="/exam" element={<ExamPage token={authToken} />} />
        <Route path="/forgot-password" element={<PasswordRecoveryPage mode="forgot" />} />
        <Route path="/reset-password" element={<PasswordRecoveryPage mode="reset" />} />
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
                      <button
                        type="button"
                        className="dashboard-mobile-menu"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open dashboard navigation"
                        aria-expanded={sidebarOpen}
                      >
                        <Menu size={21} />
                      </button>
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
                    <button
                      type="button"
                      className={`dashboard-sidebar-backdrop ${sidebarOpen ? 'is-visible' : ''}`}
                      onClick={() => setSidebarOpen(false)}
                      aria-label="Close dashboard navigation"
                      tabIndex={sidebarOpen ? 0 : -1}
                    />
                    <Sidebar
                      onLogout={handleLogout}
                      activeSection={activeSection}
                      onSectionChange={handleSectionChange}
                      role={user.role}
                      sectionAccess={user.sectionAccess}
                      isOpen={sidebarOpen}
                      onClose={() => setSidebarOpen(false)}
                    />
                    <main className="dashboard-content">
                      <Dashboard token={authToken} user={user} activeSection={activeSection} onSectionChange={handleSectionChange} onLogout={handleLogout} />
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
          element={<LandingPage portalPath={authToken && user ? getHomeRedirect() : '/login'} isAuthenticated={Boolean(authToken && user)} />}
        />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;

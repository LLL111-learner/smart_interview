import { lazy, Suspense, type ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Spin } from 'antd';

const Admin = lazy(() => import('@/pages/Admin'));
const Growth = lazy(() => import('@/pages/Growth'));
const Home = lazy(() => import('@/pages/Home'));
const Interview = lazy(() => import('@/pages/Interview'));
const InterviewSetup = lazy(() => import('@/pages/InterviewSetup'));
const Login = lazy(() => import('@/pages/Login'));
const Report = lazy(() => import('@/pages/Report'));

function RouteFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div className="paper-panel" style={{ padding: '24px 28px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 14, color: 'var(--text-secondary)' }}>页面加载中...</div>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

function SessionRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const trialToken = localStorage.getItem('trial_token');

  if (!token && !trialToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/interview/setup" element={<InterviewSetup />} />
        <Route
          path="/interview/:id"
          element={
            <SessionRoute>
              <Interview />
            </SessionRoute>
          }
        />
        <Route
          path="/report/:id"
          element={
            <SessionRoute>
              <Report />
            </SessionRoute>
          }
        />
        <Route
          path="/growth"
          element={
            <ProtectedRoute>
              <Growth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;

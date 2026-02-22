import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import arEG from 'antd/locale/ar_EG';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import LoginPage from './pages/admin/LoginPage';
import DashboardPage from './pages/admin/DashboardPage';
import UserTypesPage from './pages/admin/UserTypesPage';
import UserTypeFormPage from './pages/admin/UserTypeFormPage';
import RequestsPage from './pages/admin/RequestsPage';
import RequestDetailPage from './pages/admin/RequestDetailPage';
import DatabasePage from './pages/admin/DatabasePage';
import FieldsMasterPage from './pages/admin/FieldsMasterPage';
import RequestFormPage from './pages/public/RequestFormPage';
import RequestSuccessPage from './pages/public/RequestSuccessPage';
import AdminLayout from './layouts/AdminLayout';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/admin/login" replace />;
};

const PublicAdminRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/admin/dashboard" replace /> : children;
};

const customTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#6C63FF',
    colorBgBase: '#0a0a1a',
    colorBgContainer: '#12122a',
    colorBgElevated: '#1a1a36',
    colorBorder: '#2a2a4a',
    colorText: '#e0e0ff',
    colorTextSecondary: '#8888bb',
    borderRadius: 10,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  components: {
    Layout: {
      siderBg: '#0d0d20',
      triggerBg: '#12122a',
      headerBg: '#0d0d20',
    },
    Menu: {
      darkItemBg: '#0d0d20',
      darkSubMenuItemBg: '#111128',
      darkItemSelectedBg: 'rgba(108,99,255,0.25)',
    },
    Table: { headerBg: '#12122a' },
    Card: { colorBgContainer: '#12122a' },
  },
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RequestFormPage />} />
      <Route path="/request-success" element={<RequestSuccessPage />} />
      <Route path="/admin/login" element={
        <PublicAdminRoute><LoginPage /></PublicAdminRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><AdminLayout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="user-types" element={<UserTypesPage />} />
        <Route path="user-types/new" element={<UserTypeFormPage />} />
        <Route path="user-types/:id/edit" element={<UserTypeFormPage />} />
        <Route path="requests" element={<RequestsPage />} />
        <Route path="requests/:id" element={<RequestDetailPage />} />
        <Route path="database" element={<DatabasePage />} />
        <Route path="fields-master" element={<FieldsMasterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ConfigProvider theme={customTheme} locale={arEG} direction="rtl">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;

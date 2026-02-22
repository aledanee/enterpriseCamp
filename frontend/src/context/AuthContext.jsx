import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const validateSession = useCallback(async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) { setLoading(false); return; }
    try {
      const res = await authApi.validate();
      setAdmin(res.data.data?.admin || res.data.admin || null);
    } catch {
      localStorage.removeItem('admin_token');
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { validateSession(); }, [validateSession]);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    const { token, admin: adminData } = res.data.data || res.data;
    localStorage.setItem('admin_token', token);
    setAdmin(adminData);
    return adminData;
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    localStorage.removeItem('admin_token');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

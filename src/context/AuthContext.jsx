import { createContext, useContext, useState } from 'react';
import { api } from '../hooks/useApi';

const AuthContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('plawminary_user') || localStorage.getItem('plawminary_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  async function login(studentId, password) {
    try {
      const data = await api.post('/auth/login', { studentId, password });
      setUser(data.user);
      sessionStorage.setItem('plawminary_user', JSON.stringify(data.user));
      localStorage.setItem('plawminary_user', JSON.stringify(data.user));
      return { success: true, user: data.user };
    } catch (err) {
      // Provide a clear, actionable error — no silent mock fallback in production.
      const msg = err.status === 401
        ? 'Invalid ID or password. Please try again.'
        : err.status >= 500 || !err.status
          ? 'The server is currently unavailable. Please ensure it is running and try again.'
          : (err.message || 'Login failed. Please try again.');
      return { success: false, error: msg };
    }
  }

  async function logout() {
    // Attempt server-side session destroy (graceful — ignore failure)
    try { await api.post('/auth/logout'); } catch {}
    setUser(null);
    sessionStorage.removeItem('plawminary_user');
    localStorage.removeItem('plawminary_user');
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoggedIn: !!user, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

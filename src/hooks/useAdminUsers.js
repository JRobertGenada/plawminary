/**
 * useAdminUsers.js — Manages admin user CRUD operations.
 * Returns: { users, loading, error, addUser, deleteUser, resetPassword, refetch }
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from './useApi';

export function useAdminUsers() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/users');
      setUsers(data);
    } catch (err) {
      console.error('[useAdminUsers] Failed to fetch users:', err);
      setError(err.message || 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  async function addUser({ id, name, dept, role, password }) {
    const result = await api.post('/admin/users', { id, name, dept, role, password });
    await fetchUsers();
    return result;
  }

  async function deleteUser(userId) {
    await api.delete(`/admin/users/${userId}`);
    setUsers(prev => prev.filter(u => u.id !== userId));
  }

  async function resetPassword(userId, newPassword) {
    await api.patch(`/admin/users/${userId}/password`, { password: newPassword });
  }

  return { users, loading, error, addUser, deleteUser, resetPassword, refetch: fetchUsers };
}

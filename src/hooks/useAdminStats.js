/**
 * useAdminStats.js — Fetches live dashboard statistics from the backend.
 * Returns: { stats, loading, error, refetch }
 *
 * Covers: ordinanceCount, userCount, commentCount, pendingCount,
 *         weeklyViews, deptStats, topSections, recentComments
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from './useApi';

const EMPTY = {
  ordinanceCount:  0,
  userCount:       0,
  commentCount:    0,
  progressCount:   0,
  pendingCount:    0,
  commentsByType:  [],
  recentComments:  [],
  weeklyViews:     [],
  deptStats:       [],
  topSections:     [],
};

export function useAdminStats() {
  const [stats, setStats]   = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/stats');
      setStats({ ...EMPTY, ...data });
    } catch (err) {
      console.error('[useAdminStats] Failed to fetch stats:', err);
      setError(err.message || 'Failed to load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

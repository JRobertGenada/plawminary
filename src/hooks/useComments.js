/**
 * useComments.js — Student feedback comments for ordinance policies.
 *
 * Behavior:
 * - Tries to fetch/save comments from the backend API (POST /api/comments)
 * - Falls back to localStorage when the server isn't running (dev mode)
 */
import { useState, useEffect, useCallback } from 'react';
import { api } from './useApi';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY = 'plawminary_comments';

// Seed for localStorage fallback so it doesn't look empty on first load
const SEED = {
  1: [
    { id: 'c1', ordinanceId: 1, userId: '2023-0042', userName: 'Maria Santos', userDept: 'Col. of Computing Sciences & Eng.', type: 'revision', body: 'The uniform exemption process should be made digital — submitting physical forms is inconvenient.', agrees: [], createdAt: '2026-04-10T08:22:00' },
    { id: 'c2', ordinanceId: 1, userId: '2022-0310', userName: 'Ana Boral',    userDept: 'Col. of Teacher Education',         type: 'policy',   body: 'Suggestion: add specific provisions for students with disabilities regarding uniform modifications.', agrees: ['2023-0001'], createdAt: '2026-04-09T14:05:00' },
  ],
  2: [
    { id: 'c3', ordinanceId: 2, userId: '2023-0001', userName: 'Juan Dela Cruz', userDept: 'Col. of Business Administration', type: 'revision', body: 'The plagiarism definition should be updated to explicitly cover AI-generated content submitted as original work.', agrees: ['2023-0042', '2024-0188'], createdAt: '2026-04-08T10:30:00' },
  ],
  5: [
    { id: 'c4', ordinanceId: 5, userId: '2023-0077', userName: 'Carl Genada', userDept: 'Col. of Arts and Sciences', type: 'question', body: 'Does a Level 1 offense reset each semester, or does it carry over to the next academic year?', agrees: ['2022-0310'], createdAt: '2026-04-07T16:45:00' },
  ],
};

function loadLocal() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : SEED;
  } catch { return SEED; }
}

function saveLocal(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

/**
 * @param {number|string} ordinanceId — the ordinance whose comments to load
 */
export function useComments(ordinanceId) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [loading, setLoading]   = useState(false);
  const [useLocal, setUseLocal] = useState(false);
  const [allLocal, setAllLocal] = useState(loadLocal);

  // ── Fetch comments ────────────────────────────────────────────────────────
  const fetchComments = useCallback(async () => {
    if (!ordinanceId) return;
    setLoading(true);
    try {
      const data = await api.get(`/comments?ordinanceId=${ordinanceId}`);
      setComments(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setUseLocal(false);
    } catch {
      // Server down — use localStorage
      setUseLocal(true);
      const local = loadLocal();
      setComments((local[ordinanceId] || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
    } finally {
      setLoading(false);
    }
  }, [ordinanceId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  // Keep localStorage in sync when using local mode
  useEffect(() => {
    if (useLocal) saveLocal(allLocal);
  }, [allLocal, useLocal]);

  // ── Add comment ───────────────────────────────────────────────────────────
  async function addComment(userObj, text, type) {
    if (!text?.trim()) return;
    const body = { ordinanceId, type, body: text.trim() };

    if (!useLocal) {
      try {
        const created = await api.post('/comments', body);
        setComments(prev => [created, ...prev]);
        return;
      } catch { setUseLocal(true); }
    }

    // Local fallback
    const newComment = {
      id: `c${Date.now()}`, ordinanceId,
      userId: userObj.id, userName: userObj.name, userDept: userObj.dept,
      type, body: text.trim(), agrees: [],
      createdAt: new Date().toISOString(),
    };
    setComments(prev => [newComment, ...prev]);
    setAllLocal(prev => ({
      ...prev,
      [ordinanceId]: [newComment, ...(prev[ordinanceId] || [])],
    }));
  }

  // ── Toggle agree ──────────────────────────────────────────────────────────
  async function toggleAgree(commentId) {
    if (!user) return;

    if (!useLocal) {
      try {
        const { agrees } = await api.post(`/comments/${commentId}/agree`);
        setComments(prev => prev.map(c => c.id === commentId ? { ...c, agrees } : c));
        return;
      } catch { setUseLocal(true); }
    }

    // Local fallback
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      const agrees = c.agrees.includes(user.id)
        ? c.agrees.filter(id => id !== user.id)
        : [...c.agrees, user.id];
      return { ...c, agrees };
    }));
  }

  const totalCount = comments.length;

  return { comments, addComment, toggleAgree, totalCount, loading };
}

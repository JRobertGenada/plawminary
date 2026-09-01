/**
 * usePdfProgress.js — Tracks student handbook reading progress.
 *
 * Behavior:
 * - Saves progress to /api/progress (per-user, server-persisted)
 * - Falls back to localStorage when server isn't running
 */
import { useState, useEffect, useCallback } from 'react';
import { ALL_HANDBOOK_SECTIONS } from '../data/handbookSections';
import { api } from './useApi';
import { useAuth } from '../context/AuthContext';

const STORAGE_KEY     = 'plawminary_pdf_progress';
const HIGHEST_PAGE_KEY = 'plawminary_highest_page';

export function usePdfProgress() {
  const { user, isLoggedIn } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [highestPage, setHighestPage] = useState(() => {
    try {
      const val = localStorage.getItem(HIGHEST_PAGE_KEY);
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? 1 : parsed;
    } catch { return 1; }
  });

  const [completedSectionIds, setCompletedSectionIds] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  const [serverMode, setServerMode] = useState(false);

  // ── Load progress from server on login ────────────────────────────────────
  useEffect(() => {
    if (!isLoggedIn) return;
    api.get('/progress')
      .then(data => {
        setServerMode(true);
        const ids = Object.keys(data);
        setCompletedSectionIds(ids);
        // Restore highest page from server data
        const maxPage = Math.max(...Object.values(data).map(v => v.page || 1), 1);
        setHighestPage(maxPage);
      })
      .catch(() => {
        // Server unavailable — stay with localStorage
        setServerMode(false);
      });
  }, [isLoggedIn, user?.id]);

  // ── Sync highest page to localStorage ─────────────────────────────────────
  useEffect(() => {
    localStorage.setItem(HIGHEST_PAGE_KEY, String(highestPage));
  }, [highestPage]);

  // ── Sync completed sections to localStorage ───────────────────────────────
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completedSectionIds));
  }, [completedSectionIds]);

  function onPageChange(pageNum) {
    setCurrentPage(pageNum);
    if (pageNum > highestPage) setHighestPage(pageNum);
  }

  const markSectionRead = useCallback((sectionId, page) => {
    if (!sectionId) return;
    setCompletedSectionIds(prev => {
      const safePrev = Array.isArray(prev) ? prev : [];
      if (safePrev.includes(sectionId)) return safePrev;
      // Save to server if available
      if (serverMode && isLoggedIn) {
        api.post('/progress', { sectionKey: sectionId, page: page || currentPage })
          .catch(() => {});
      }
      return [...safePrev, sectionId];
    });
  }, [serverMode, isLoggedIn, currentPage]);

  const sectionsReached = Array.isArray(completedSectionIds) ? completedSectionIds.length : 0;
  const totalSections   = ALL_HANDBOOK_SECTIONS.length;
  const percentage      = totalSections > 0 ? Math.round((sectionsReached / totalSections) * 100) : 0;

  function isSectionRead(section) {
    return Array.isArray(completedSectionIds) && completedSectionIds.includes(section.id);
  }

  async function reset() {
    setHighestPage(1);
    setCurrentPage(1);
    setCompletedSectionIds([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(HIGHEST_PAGE_KEY);
    if (serverMode && isLoggedIn) {
      try { await api.delete('/progress'); } catch {}
    }
  }

  return {
    currentPage,
    highestPage,
    onPageChange,
    sectionsReached,
    totalSections,
    percentage,
    isSectionRead,
    markSectionRead,
    reset,
  };
}

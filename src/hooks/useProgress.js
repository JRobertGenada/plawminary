import { useState, useEffect } from 'react';
import { TOTAL_SECTIONS } from '../data/handbook';

const STORAGE_KEY = 'plawminary_read_sections';

export function useProgress() {
  const [readSections, setReadSections] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...readSections]));
  }, [readSections]);

  const markRead = (sectionId) => {
    setReadSections((prev) => new Set([...prev, sectionId]));
  };

  const isRead = (sectionId) => readSections.has(sectionId);

  const percentage = Math.round((readSections.size / TOTAL_SECTIONS) * 100);

  return { readSections, markRead, isRead, percentage, totalRead: readSections.size };
}

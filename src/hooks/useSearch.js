import { useState, useEffect } from 'react';
import { ALL_SECTIONS } from '../data/handbook';

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    const matches = ALL_SECTIONS.filter(
      ({ section }) =>
        section.title.toLowerCase().includes(q) ||
        section.content.toLowerCase().includes(q) ||
        section.badge.toLowerCase().includes(q)
    ).slice(0, 6);
    setResults(matches);
    setIsOpen(true);
  }, [query]);

  const clear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return { query, setQuery, results, isOpen, setIsOpen, clear };
}

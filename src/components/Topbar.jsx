import { useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useSearch } from '../hooks/useSearch';

export default function Topbar({ onSelectSection, percentage }) {
  const { query, setQuery, results, isOpen, setIsOpen, clear } = useSearch();
  const wrapRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setIsOpen]);

  const handleSelect = (chapter, section) => {
    clear();
    onSelectSection(chapter.id, section.id);
  };

  return (
    <header className="flex-shrink-0 bg-white border-b border-gray-200">
      {/* Main bar */}
      <div className="flex items-center gap-4 px-5 h-14">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-2">
          <div className="w-8 h-8 rounded-lg bg-navy flex items-center justify-center flex-shrink-0">
            <span className="font-serif text-gold font-bold text-sm leading-none">Plw</span>
          </div>
          <span className="font-serif text-navy font-bold text-lg tracking-tight hidden sm:block">
            Plawminary
          </span>
        </div>

        {/* Search */}
        <div className="flex-1 max-w-md relative" ref={wrapRef}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query && setIsOpen(true)}
            placeholder="Search policies, ordinances, keywords…"
            className="w-full h-9 pl-9 pr-8 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-navy focus:bg-white transition-colors"
          />
          {query && (
            <button onClick={clear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dropdown */}
          {isOpen && results.length > 0 && (
            <div className="absolute top-11 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-sm z-50 overflow-hidden">
              {results.map(({ chapter, section }) => (
                <button
                  key={section.id}
                  onClick={() => handleSelect(chapter, section)}
                  className="w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm font-medium text-gray-800">{section.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{chapter.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 ml-auto">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-medium text-gray-700">Juan Dela Cruz</p>
            <p className="text-xs text-gray-400">BAComm · 2nd Year</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-navy flex items-center justify-center flex-shrink-0">
            <span className="text-gold text-xs font-medium">JD</span>
          </div>
        </div>
      </div>

      {/* Progress strip */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-full bg-gold transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </header>
  );
}

import { useState, useEffect } from 'react';
import { ChevronRight, BookOpen } from 'lucide-react';
import { HANDBOOK, TOTAL_SECTIONS } from '../data/handbook';

export default function Sidebar({ currentSection, isRead, totalRead, onSelectSection }) {
  const [openChapters, setOpenChapters] = useState({});

  // Auto-open the chapter containing the current section
  useEffect(() => {
    if (!currentSection) return;
    const ch = HANDBOOK.find((c) => c.sections.some((s) => s.id === currentSection));
    if (ch) setOpenChapters((prev) => ({ ...prev, [ch.id]: true }));
  }, [currentSection]);

  const toggleChapter = (id) => {
    setOpenChapters((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const pct = Math.round((totalRead / TOTAL_SECTIONS) * 100);

  return (
    <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
      {/* Overall progress card */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Your Progress</span>
          <span className="text-xs font-semibold text-navy">{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          {totalRead} of {TOTAL_SECTIONS} sections read
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        <p className="px-4 pt-1 pb-2 text-xs font-medium text-gray-400 uppercase tracking-wide">
          Chapters
        </p>

        {HANDBOOK.map((chapter) => {
          const allDone = chapter.sections.every((s) => isRead(s.id));
          const anyDone = chapter.sections.some((s) => isRead(s.id));
          const isOpen = openChapters[chapter.id];

          return (
            <div key={chapter.id}>
              {/* Chapter header */}
              <button
                onClick={() => toggleChapter(chapter.id)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Status dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 border transition-colors ${
                    allDone
                      ? 'bg-gold border-gold'
                      : anyDone
                      ? 'bg-yellow-200 border-gold'
                      : 'border-gray-300'
                  }`}
                />
                <span className="text-xs font-medium text-gray-700 flex-1 leading-snug">
                  {chapter.title}
                </span>
                <ChevronRight
                  className={`w-3 h-3 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              {/* Sections */}
              {isOpen && (
                <div className="pb-1">
                  {chapter.sections.map((section) => {
                    const done = isRead(section.id);
                    const active = currentSection === section.id;
                    return (
                      <button
                        key={section.id}
                        onClick={() => onSelectSection(chapter.id, section.id)}
                        className={`w-full flex items-start gap-2 pl-8 pr-4 py-1.5 text-left transition-colors ${
                          active
                            ? 'text-navy bg-blue-50'
                            : done
                            ? 'text-gray-400 hover:text-gray-600'
                            : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                        }`}
                      >
                        {/* Check circle */}
                        <span
                          className={`mt-0.5 w-3.5 h-3.5 rounded-full border flex-shrink-0 flex items-center justify-center text-white transition-all ${
                            done ? 'bg-gold border-gold' : 'border-gray-300'
                          }`}
                          style={{ fontSize: '7px' }}
                        >
                          {done && '✓'}
                        </span>
                        <span className={`text-xs leading-snug ${active ? 'font-semibold' : ''}`}>
                          {section.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2 text-gray-400">
          <BookOpen className="w-3 h-3" />
          <span className="text-xs">PLSP · AY 2025–2026</span>
        </div>
      </div>
    </aside>
  );
}

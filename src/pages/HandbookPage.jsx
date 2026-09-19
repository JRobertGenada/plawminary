import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { HANDBOOK_CHAPTERS, ALL_HANDBOOK_SECTIONS, findSectionByPage } from '../data/handbookSections';
import { usePdfProgress } from '../hooks/usePdfProgress';
import PdfViewer from '../components/PdfViewer';
import {
  Book, Menu, X, Search, ChevronRight, Check,
  Download, BookmarkCheck, Trash2, WifiOff, AlertTriangle, Loader2
} from 'lucide-react';
import { searchHandbook } from '../utils/searchUtility';
import { useAuth } from '../context/AuthContext';
import { api } from '../hooks/useApi';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  saveHandbookOffline,
  removeHandbookOffline,
  isHandbookSaved,
  getSavedHandbook,
  syncVersionOutdatedStatus,
  subscribeOfflineChanges
} from '../utils/offlineStorage';

// Fallback local PDF import
import pdfFallbackFile from '../assets/handbook.pdf';

export default function HandbookPage() {
  const { state } = useLocation();
  const { user } = useAuth();
  const [targetPage, setTargetPage] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [openChapters, setOpenChapters] = useState({ ch1: true });
  const [searchQ, setSearchQ] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 992);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeSectionOverride, setActiveSectionOverride] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('/api/handbook/active-pdf');
  const hasJumped = useRef(false); // prevent re-firing the state-based jump

  // Offline handbook states
  const [isSaved, setIsSaved] = useState(false);
  const [savedHandbookInfo, setSavedHandbookInfo] = useState(null);
  const [isOutdated, setIsOutdated] = useState(false);
  const [activeVersion, setActiveVersion] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [isOfflineSource, setIsOfflineSource] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const blobUrlRef = useRef(null);

  const {
    currentPage,
    onPageChange,
    percentage,
    sectionsReached,
    totalSections,
    isSectionRead,
    markSectionRead,
    highestPage,
    reset
  } = usePdfProgress();

  const handlePageChange = useCallback((p) => {
    onPageChange(p);
    // Clear override if we've scrolled away from the overridden page
    setActiveSectionOverride(prev => {
      const sect = findSectionByPage(p);
      return (prev && sect?.page === p) ? prev : null;
    });
  }, [onPageChange]);

  const activeSection = activeSectionOverride || findSectionByPage(currentPage);

  // Mark active section as read if user stays on it
  useEffect(() => {
    if (!activeSection) return;
    const timer = setTimeout(() => {
      markSectionRead(activeSection.id);
    }, 5000); // 5 seconds of engagement marks it as read
    return () => clearTimeout(timer);
  }, [activeSection?.id, markSectionRead]);

  // Update window width on resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Jump to specific page or section on mount if provided in state (fires only once)
  useEffect(() => {
    if (totalPages > 0 && !hasJumped.current) {
      if (state?.page) {
        hasJumped.current = true;
        const pageNum = parseInt(state.page, 10);
        const section = findSectionByPage(pageNum);
        if (section) {
          jumpTo(section);
        } else {
          setTargetPage(null);
          setTimeout(() => setTargetPage(pageNum), 10);
        }
      } else if (state?.sectionId) {
        const section = ALL_HANDBOOK_SECTIONS.find(s => s.id === state.sectionId);
        if (section) {
          hasJumped.current = true;
          jumpTo(section);
        }
      }
    }
  }, [state, totalPages]);

  // Auto-expand chapter if active section changes
  useEffect(() => {
    if (activeSection) {
      setOpenChapters(prev => ({ ...prev, [activeSection.chapterId]: true }));
    }
  }, [activeSection?.chapterId]);

  // Sidebar auto-scroll effect
  useEffect(() => {
    if (activeSection) {
      const el = document.getElementById(`sect-${activeSection.id}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [activeSection?.id]);

  function jumpTo(section) {
    setActiveSectionOverride(section);
    markSectionRead(section.id);
    setTargetPage(null);
    // Use a small timeout to ensure the state change is processed
    setTimeout(() => setTargetPage(section.page), 10);
    if (windowWidth <= 992) setIsSidebarOpen(false);
  }

  function toggleChapter(id) {
    setOpenChapters(prev => ({ ...prev, [id]: !prev[id] }));
  }

  const filtered = useMemo(() => {
    if (!searchQ) return HANDBOOK_CHAPTERS;

    // Search the flat list of all sections
    const results = searchHandbook(ALL_HANDBOOK_SECTIONS, searchQ);

    // Group back by chapter for display
    const grouped = HANDBOOK_CHAPTERS.map(ch => ({
      ...ch,
      sections: results.filter(s => s.chapterId === ch.id),
    })).filter(ch => ch.sections.length > 0);

    return grouped;
  }, [searchQ]);

  const isMobile = windowWidth <= 992;

  // ── Offline Handbook initialization & version sync ────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function initHandbookSource() {
      // 1. Check if handbook is saved in IndexedDB
      try {
        const savedHb = await getSavedHandbook();
        if (cancelled) return;
        if (savedHb?.pdfBlob) {
          setIsSaved(true);
          setSavedHandbookInfo(savedHb);

          // If offline or explicitly navigated with offline flag, render from stored blob
          if (!navigator.onLine || state?.offline) {
            const objectUrl = URL.createObjectURL(savedHb.pdfBlob);
            blobUrlRef.current = objectUrl;
            setPdfUrl(objectUrl);
            setIsOfflineSource(true);
          }
        }
      } catch (err) {
        console.warn('Failed to load offline handbook status:', err);
      }

      // 2. If online, check current active version from server
      if (navigator.onLine) {
        try {
          const ver = await api.get('/handbook/active-version');
          if (cancelled) return;
          setActiveVersion(ver);

          // Sync outdated status safely
          await syncVersionOutdatedStatus(ver);
          const updatedHb = await getSavedHandbook();
          if (cancelled) return;
          if (updatedHb) {
            setSavedHandbookInfo(updatedHb);
            setIsOutdated(!!updatedHb.isOutdated);
          }
        } catch (_) {}
      }
    }

    initHandbookSource();

    // Listen for storage changes across tabs/components
    const unsub = subscribeOfflineChanges(async () => {
      if (cancelled) return;
      const hb = await getSavedHandbook();
      setIsSaved(!!hb?.pdfBlob);
      setSavedHandbookInfo(hb);
      setIsOutdated(!!hb?.isOutdated);
    });

    return () => {
      cancelled = true;
      unsub();
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, [state?.offline]);

  async function handleSaveHandbookOffline() {
    setSaving(true);
    try {
      // 1. Fetch active version metadata
      let ver = activeVersion;
      if (!ver && navigator.onLine) {
        try {
          ver = await api.get('/handbook/active-version');
          setActiveVersion(ver);
        } catch (_) {}
      }

      // 2. Download the approved PDF blob
      let blob = null;
      try {
        const res = await fetch('/api/handbook/active-pdf');
        if (res.ok) {
          blob = await res.blob();
        }
      } catch (_) {}

      // Fallback if server stream is unavailable
      if (!blob && pdfFallbackFile) {
        try {
          const res = await fetch(pdfFallbackFile);
          if (res.ok) blob = await res.blob();
        } catch (_) {}
      }

      if (!blob) throw new Error('Could not download handbook PDF file.');

      // 3. Save actual Blob to IndexedDB
      await saveHandbookOffline({
        pdfBlob: blob,
        versionInfo: ver,
        totalPages,
        studentId: user?.id,
      });

      setIsSaved(true);
      setIsOutdated(false);
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
      setSuccessMessage(`The Student Handbook PDF (${sizeMb} MB) has been saved offline. You can now read it without internet access.`);
      setSuccessModalOpen(true);
    } catch (err) {
      console.error('Failed to save handbook offline:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmRemove() {
    setRemoving(true);
    try {
      await removeHandbookOffline();
      setIsSaved(false);
      setSavedHandbookInfo(null);
      setIsOutdated(false);
      setRemoveModalOpen(false);
      if (isOfflineSource) {
        setPdfUrl('/api/handbook/active-pdf');
        setIsOfflineSource(false);
      }
    } catch (err) {
      console.error('Failed to remove handbook offline:', err);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div style={{ height: 'calc(100vh - 70px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--gray-bg)', position: 'relative' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--g-dark)', flexShrink: 0, zIndex: 100 }}>
        <div style={{ height: 4, background: 'rgba(255,255,255,.15)' }}>
          <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--gold)', transition: 'width .6s ease' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', flexWrap: 'wrap' }}>
          {isMobile && (
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{ background: 'rgba(255,255,255,.1)', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {isSidebarOpen ? <X size={16} /> : <Menu size={16} />}
              <span style={{ fontSize: '.8rem', fontWeight: 600 }}>Index</span>
            </button>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: '"DM Serif Display",serif', color: '#fff', fontSize: isMobile ? '.95rem' : '1.05rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <Book size={18} color="var(--gold)" /> PLSP Handbook
          </span>

          {isOfflineSource && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 999, background: 'rgba(244,197,66,0.2)', color: 'var(--gold)', fontSize: '.72rem', fontWeight: 800, border: '1px solid rgba(244,197,66,0.35)' }}>
              <WifiOff size={12} /> Offline Copy
            </span>
          )}

          {isOutdated && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 999, background: '#FEF3C7', color: '#92400E', fontSize: '.72rem', fontWeight: 800, border: '1px solid #FCD34D' }}>
              <AlertTriangle size={12} />
              <span>Outdated</span>
              <button
                onClick={handleSaveHandbookOffline}
                disabled={saving}
                style={{ background: '#D97706', color: '#fff', border: 'none', borderRadius: 6, padding: '2px 7px', fontSize: '.68rem', fontWeight: 800, cursor: 'pointer' }}
              >
                {saving ? 'Updating...' : 'Update'}
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
            {/* Save Offline / Saved Offline button */}
            {isSaved ? (
              <button
                onClick={() => setRemoveModalOpen(true)}
                title="Handbook is saved for offline reading. Click to manage or remove."
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'rgba(244,197,66,0.18)',
                  border: '1px solid rgba(244,197,66,0.4)',
                  color: 'var(--gold)', fontSize: '.76rem', fontWeight: 700,
                  cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                  transition: 'all .2s'
                }}
              >
                <BookmarkCheck size={14} /> Saved Offline
              </button>
            ) : (
              <button
                onClick={handleSaveHandbookOffline}
                disabled={saving}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 12px', borderRadius: 8,
                  background: 'var(--gold)', color: 'var(--g-dark)',
                  border: 'none', fontSize: '.76rem', fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                  boxShadow: '0 2px 8px rgba(244,197,66,0.3)',
                  transition: 'all .2s'
                }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                {saving ? 'Downloading PDF...' : 'Save Offline'}
              </button>
            )}

            {!isMobile && <span style={{ fontSize: '.78rem', color: 'rgba(255,255,255,.6)' }}>{sectionsReached}/{totalSections} reached</span>}
            <span style={{ background: 'var(--gold)', color: 'var(--g-dark)', padding: '3px 10px', borderRadius: 999, fontSize: '.75rem', fontWeight: 800 }}>{percentage}%</span>
            {highestPage > 0 && !isMobile && (
              <button onClick={reset} style={{ fontSize: '.7rem', color: 'rgba(255,255,255,.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Reset</button>
            )}
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Left: Section index (Sidebar) */}
        <aside style={{
          width: isMobile ? '100%' : 300,
          position: isMobile ? 'absolute' : 'relative',
          top: 0,
          left: isSidebarOpen ? 0 : (isMobile ? '-100%' : -300),
          height: '100%',
          zIndex: 90,
          transition: 'all .3s cubic-bezier(0.4, 0, 0.2, 1)',
          flexShrink: 0,
          background: '#fff',
          borderRight: '1.5px solid var(--gray-mid)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: isMobile && isSidebarOpen ? '0 0 40px rgba(0,0,0,.3)' : 'none'
        }}>

          {/* Search */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-mid)' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)' }}>
                <Search size={14} />
              </span>
              <input type="text" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search sections…"
                style={{ width: '100%', padding: '8px 12px 8px 32px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.82rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)' }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ padding: '10px 14px', background: 'var(--g-pale)', borderBottom: '1px solid #C2E0CE', display: 'flex', gap: 16 }}>
            {[
              [percentage + '%', 'Progress'],
              [totalPages || '—', 'Pages'],
              [currentPage || '—', 'Current'],
            ].map(([val, lbl], i, arr) => (
              <div key={lbl} style={{ textAlign: 'center', flex: 1, ...(i < arr.length - 1 ? { borderRight: '1px solid #C2E0CE', paddingRight: 16 } : {}) }}>
                <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.15rem', color: 'var(--g-dark)' }}>{val}</div>
                <div style={{ fontSize: '.6rem', color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Section list */}
          <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
            {filtered.map(ch => (
              <div key={ch.id}>
                <button onClick={() => toggleChapter(ch.id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: activeSection?.chapterId === ch.id ? 'var(--g-pale)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'background .2s' }}
                >
                  <ChevronRight size={14} style={{ color: 'var(--gray-t)', transition: 'transform .2s', transform: openChapters[ch.id] ? 'rotate(90deg)' : 'none' }} />
                  <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--g-dark)', flex: 1, lineHeight: 1.3 }}>{ch.title}</span>
                  <span style={{ fontSize: '.65rem', color: 'var(--gray-t)', background: 'var(--gray-bg)', padding: '1px 6px', borderRadius: 999 }}>
                    {ch.sections.filter(s => isSectionRead(s)).length}/{ch.sections.length}
                  </span>
                </button>

                {(openChapters[ch.id] || searchQ) && (
                  <div style={{ paddingBottom: 4 }}>
                    {ch.sections.map(s => {
                      const read = isSectionRead(s);
                      const isActive = activeSection?.id === s.id;
                      return (
                        <button key={s.id} id={`sect-${s.id}`} onClick={() => jumpTo(s)}
                          style={{ width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12, padding: '9px 14px 9px 34px', background: isActive ? 'var(--g-pale)' : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'background .15s' }}
                        >
                          <span style={{ width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${isActive ? 'var(--g-primary)' : (read ? 'var(--gold)' : 'var(--gray-mid)')}`, background: isActive ? 'var(--g-primary)' : (read ? 'var(--gold)' : 'transparent'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, color: isActive ? '#fff' : (read ? 'var(--g-dark)' : 'transparent') }}>
                            {isActive ? <div style={{ width: 4, height: 4, background: '#fff', borderRadius: '50%' }} /> : (read ? <Check size={10} /> : null)}
                          </span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '.8rem', color: isActive ? 'var(--g-dark)' : (read ? 'var(--gray-t)' : 'var(--gray-dk)'), lineHeight: 1.35, fontWeight: isActive ? 700 : (read ? 400 : 500) }}>{s.title}</div>
                            <div style={{ fontSize: '.68rem', color: 'var(--gray-t)', marginTop: 2 }}>Page {s.page}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {isMobile && isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', zIndex: 80, backdropFilter: 'blur(2px)' }}
          />
        )}

        {/* Right: PDF Viewer */}
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          width: '100%',
          transition: 'margin-left .3s cubic-bezier(0.4, 0, 0.2, 1)',
          marginLeft: !isMobile && !isSidebarOpen ? -300 : 0
        }}>
          <PdfViewer
            pdfUrl={pdfUrl}
            targetPage={targetPage}
            onScrollDone={() => setTargetPage(null)}
            onPageChange={handlePageChange}
            totalPages={totalPages}
            setTotalPages={setTotalPages}
            isMobile={isMobile}
          />
        </div>
      </div>

      {/* Centered Remove Handbook Confirmation Modal */}
      <ConfirmationModal
        isOpen={removeModalOpen}
        type="danger"
        title="Remove Handbook from Offline Storage"
        message="Are you sure you want to remove the approved Student Handbook PDF from your offline storage? You will need an internet connection to re-download the file."
        confirmText={removing ? "Removing..." : "Remove Handbook"}
        cancelText="Keep Saved"
        loading={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setRemoveModalOpen(false)}
      />

      {/* Centered Save Success Modal */}
      <ConfirmationModal
        isOpen={successModalOpen}
        type="success"
        isResult={true}
        title="Handbook Saved Offline"
        message={successMessage}
        confirmText="Got it"
        onConfirm={() => setSuccessModalOpen(false)}
        onCancel={() => setSuccessModalOpen(false)}
      />
    </div>
  );
}

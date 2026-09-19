import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Book, Bookmark, BookmarkCheck, Trash2, Wifi, WifiOff,
  Search, ExternalLink, ChevronRight, FileText, AlertTriangle,
  Clock, HardDrive, CheckCircle2, RefreshCw, Eye, X, BookOpen,
  ArrowRight, ShieldCheck, Download
} from 'lucide-react';
import { BADGE_MAP } from '../data/ordinances';
import { api } from '../hooks/useApi';
import ConfirmationModal from '../components/ConfirmationModal';
import {
  getAllSavedOrdinances,
  getSavedHandbook,
  removeOrdinanceOffline,
  removeHandbookOffline,
  saveHandbookOffline,
  syncVersionOutdatedStatus,
  subscribeOfflineChanges
} from '../utils/offlineStorage';

// Fallback local PDF import
import pdfFallbackFile from '../assets/handbook.pdf';

export default function OfflineSavedPage() {
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [loading, setLoading] = useState(true);
  const [ordinances, setOrdinances] = useState([]);
  const [handbook, setHandbook] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modal states
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'ordinance'|'handbook', item: ... }
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingHandbook, setUpdatingHandbook] = useState(false);
  const [viewingPolicy, setViewingPolicy] = useState(null); // Policy reader preview modal

  // ── Network status listener ────────────────────────────────────────────────
  useEffect(() => {
    function handleOnline() { setIsOnline(true); }
    function handleOffline() { setIsOnline(false); }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Load saved content from IndexedDB ──────────────────────────────────────
  async function loadSavedData() {
    try {
      const [savedOrds, savedHb] = await Promise.all([
        getAllSavedOrdinances(),
        getSavedHandbook(),
      ]);
      setOrdinances(savedOrds);
      setHandbook(savedHb);

      // If online, check server active version and sync outdated flags
      if (navigator.onLine) {
        try {
          const ver = await api.get('/handbook/active-version');
          if (ver?.id) {
            await syncVersionOutdatedStatus(ver);
            const [refreshedOrds, refreshedHb] = await Promise.all([
              getAllSavedOrdinances(),
              getSavedHandbook(),
            ]);
            setOrdinances(refreshedOrds);
            setHandbook(refreshedHb);
          }
        } catch (_) {}
      }
    } catch (err) {
      console.error('Failed to load offline storage records:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSavedData();

    // Subscribe to storage changes
    const unsub = subscribeOfflineChanges(() => {
      loadSavedData();
    });

    return () => unsub();
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  function requestDeleteOrdinance(ord) {
    setItemToDelete({ type: 'ordinance', item: ord });
    setDeleteModalOpen(true);
  }

  function requestDeleteHandbook() {
    setItemToDelete({ type: 'handbook', item: handbook });
    setDeleteModalOpen(true);
  }

  async function handleConfirmDelete() {
    if (!itemToDelete) return;
    setDeleting(true);

    try {
      if (itemToDelete.type === 'ordinance') {
        await removeOrdinanceOffline(itemToDelete.item.id);
      } else if (itemToDelete.type === 'handbook') {
        await removeHandbookOffline();
      }
      setDeleteModalOpen(false);
      setItemToDelete(null);
      await loadSavedData();
    } catch (err) {
      console.error('Failed to remove item from offline storage:', err);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateHandbook() {
    if (!isOnline) return;
    setUpdatingHandbook(true);
    try {
      const ver = await api.get('/handbook/active-version');
      let blob = null;
      try {
        const res = await fetch('/api/handbook/active-pdf');
        if (res.ok) blob = await res.blob();
      } catch (_) {}

      if (!blob && pdfFallbackFile) {
        const res = await fetch(pdfFallbackFile);
        if (res.ok) blob = await res.blob();
      }

      if (blob) {
        await saveHandbookOffline({
          pdfBlob: blob,
          versionInfo: ver,
          totalPages: handbook?.totalPages || 0,
        });
        await loadSavedData();
      }
    } catch (err) {
      console.error('Failed to update offline handbook:', err);
    } finally {
      setUpdatingHandbook(false);
    }
  }

  // ── Filtering ──────────────────────────────────────────────────────────────
  const categories = useMemo(() => {
    const cats = new Set(ordinances.map(o => o.catK || 'conduct'));
    return ['all', ...Array.from(cats)];
  }, [ordinances]);

  const filteredOrdinances = useMemo(() => {
    return ordinances.filter(o => {
      const matchCat = selectedCategory === 'all' || o.catK === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCat;
      const matchText =
        (o.title || '').toLowerCase().includes(q) ||
        (o.ref || '').toLowerCase().includes(q) ||
        (o.summary || '').toLowerCase().includes(q) ||
        (o.cat || '').toLowerCase().includes(q);
      return matchCat && matchText;
    });
  }, [ordinances, selectedCategory, searchQuery]);

  return (
    <div style={{ background: 'var(--gray-bg)', minHeight: 'calc(100vh - 70px)', paddingBottom: 60 }}>

      {/* Hero Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--g-dark) 0%, var(--g-primary) 65%, var(--g-light) 100%)',
        position: 'relative',
        overflow: 'hidden',
        padding: '40px 20px 48px',
        color: '#fff',
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 30%, rgba(244,197,66,.12) 0%, transparent 60%)' }} />

        <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Top meta pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', padding: '6px 14px', borderRadius: 999, fontSize: '.78rem', fontWeight: 700, border: '1px solid rgba(255,255,255,0.15)' }}>
              <HardDrive size={14} color="var(--gold)" /> Local IndexedDB Storage
            </div>

            {/* Connection Status Pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '6px 14px', borderRadius: 999, fontSize: '.78rem', fontWeight: 800,
              background: isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 197, 66, 0.22)',
              color: isOnline ? '#6EE7B7' : 'var(--gold)',
              border: `1px solid ${isOnline ? 'rgba(110,231,183,0.3)' : 'rgba(244,197,66,0.35)'}`
            }}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span>{isOnline ? '🟢 Connected (Online)' : '🟡 Offline Mode (Reading Local Cache)'}</span>
            </div>
          </div>

          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: 'clamp(1.8rem,4vw,2.6rem)', color: '#fff', lineHeight: 1.2, margin: '0 0 10px' }}>
            Offline Saved Library
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '.95rem', maxWidth: 620, margin: 0, lineHeight: 1.5 }}>
            Access saved student handbook policies and the complete PDF document anytime, even when disconnected from campus Wi-Fi or mobile data.
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div style={{ maxWidth: 1100, margin: '-24px auto 0', padding: '0 20px', position: 'relative', zIndex: 10 }}>

        {/* Top Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}>
          {/* Card 1: Handbook status */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: '20px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: '1.5px solid var(--gray-mid)',
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 12,
              background: handbook ? 'var(--g-pale)' : '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: handbook ? 'var(--g-primary)' : 'var(--gray-t)'
            }}>
              <Book size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray-t)' }}>
                Approved Handbook
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--g-dark)', marginTop: 2 }}>
                {handbook ? 'PDF Saved Offline' : 'Not Saved'}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--gray-t)', marginTop: 2 }}>
                {handbook ? `${(handbook.fileSize / (1024 * 1024)).toFixed(1)} MB • ${handbook.versionLabel || '2025 Revised'}` : 'Click below to download'}
              </div>
            </div>
          </div>

          {/* Card 2: Saved Ordinances count */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: '20px 24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            border: '1.5px solid var(--gray-mid)',
            display: 'flex', alignItems: 'center', gap: 16
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: 12,
              background: 'rgba(244,197,66,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--gold-d)'
            }}>
              <BookmarkCheck size={26} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--gray-t)' }}>
                Saved Policies
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--g-dark)', marginTop: 2 }}>
                {ordinances.length} {ordinances.length === 1 ? 'Ordinance' : 'Ordinances'}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--gray-t)', marginTop: 2 }}>
                Full text & guidelines cached
              </div>
            </div>
          </div>
        </div>

        {/* ── SECTION 1: STUDENT HANDBOOK CARD ──────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1.5px solid var(--gray-mid)',
          padding: '24px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          marginBottom: 32,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ color: 'var(--g-primary)' }}>
                <BookOpen size={22} />
              </div>
              <div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', margin: 0 }}>
                  Student Handbook PDF
                </h2>
                <span style={{ fontSize: '.78rem', color: 'var(--gray-t)' }}>
                  Complete digital handbook document with interactive page index
                </span>
              </div>
            </div>

            {handbook && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  padding: '4px 12px', borderRadius: 999, fontSize: '.74rem', fontWeight: 800,
                  background: handbook.isOutdated ? '#FEF3C7' : '#D1FAE5',
                  color: handbook.isOutdated ? '#92400E' : '#065F46',
                  border: `1px solid ${handbook.isOutdated ? '#FCD34D' : '#A7F3D0'}`
                }}>
                  {handbook.isOutdated ? `⚠️ Outdated (Saved ${handbook.versionLabel})` : `Active: ${handbook.versionLabel || '2025 Revised'}`}
                </span>
              </div>
            )}
          </div>

          {handbook ? (
            <div>
              {/* Outdated alert banner */}
              {handbook.isOutdated && (
                <div style={{
                  background: '#FFFBEB',
                  border: '1.5px solid #FDE68A',
                  borderRadius: 12,
                  padding: '14px 18px',
                  marginBottom: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <div>
                      <div style={{ fontSize: '.84rem', fontWeight: 800, color: '#92400E' }}>
                        Newer Handbook Version Available
                      </div>
                      <div style={{ fontSize: '.78rem', color: '#B45309' }}>
                        Your offline copy is {handbook.versionLabel}. A newer approved version ({handbook.latestVersionLabel || 'Latest'}) is available online.
                      </div>
                    </div>
                  </div>

                  {isOnline && (
                    <button
                      onClick={handleUpdateHandbook}
                      disabled={updatingHandbook}
                      style={{
                        padding: '6px 14px', borderRadius: 8,
                        background: '#D97706', color: '#fff', border: 'none',
                        fontSize: '.78rem', fontWeight: 800, cursor: updatingHandbook ? 'wait' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6
                      }}
                    >
                      {updatingHandbook ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      {updatingHandbook ? 'Updating...' : 'Update Offline PDF'}
                    </button>
                  )}
                </div>
              )}

              {/* Handbook details & actions */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 16, flexWrap: 'wrap',
                background: 'var(--gray-bg)', padding: '16px 20px', borderRadius: 14
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 700, color: 'var(--g-dark)' }}>
                    Pamantasan ng Lungsod ng San Pablo — Student Handbook
                  </div>
                  <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Size: {(handbook.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                    <span>•</span>
                    <span>Saved on: {new Date(handbook.savedAt).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>Offline Status: Ready</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={() => navigate('/handbook', { state: { offline: true } })}
                    style={{
                      padding: '10px 20px', borderRadius: 10,
                      background: 'var(--g-primary)', color: '#fff',
                      fontSize: '.85rem', fontWeight: 800,
                      border: 'none', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      boxShadow: '0 4px 12px rgba(15,79,44,0.25)',
                      transition: 'all .2s'
                    }}
                  >
                    <BookOpen size={16} /> Open Offline Reader
                  </button>

                  <button
                    onClick={requestDeleteHandbook}
                    style={{
                      padding: '10px 14px', borderRadius: 10,
                      background: '#FEE2E2', color: '#DC2626',
                      border: '1px solid #FECACA',
                      fontSize: '.82rem', fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      transition: 'all .2s'
                    }}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '24px 16px',
              background: 'var(--gray-bg)', borderRadius: 14,
              border: '1px dashed var(--gray-mid)'
            }}>
              <p style={{ fontSize: '.9rem', color: 'var(--gray-dk)', margin: '0 0 12px', fontWeight: 600 }}>
                The handbook PDF has not been saved to offline storage yet.
              </p>
              <button
                onClick={() => navigate('/handbook')}
                style={{
                  padding: '9px 18px', borderRadius: 10,
                  background: 'var(--gold)', color: 'var(--g-dark)',
                  fontWeight: 800, fontSize: '.84rem', border: 'none',
                  cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7
                }}
              >
                <Book size={15} /> Go to Handbook & Save Offline
              </button>
            </div>
          )}
        </div>

        {/* ── SECTION 2: SAVED ORDINANCES ──────────────────────────────────── */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          border: '1.5px solid var(--gray-mid)',
          padding: '24px 28px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
        }}>
          {/* Header & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.3rem', color: 'var(--g-dark)', margin: 0 }}>
                Saved Ordinances & Policies ({filteredOrdinances.length})
              </h2>
              <span style={{ fontSize: '.78rem', color: 'var(--gray-t)' }}>
                Offline policy guidelines, procedures, and sanctions
              </span>
            </div>

            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search saved policies..."
                style={{
                  width: '100%', padding: '9px 12px 9px 36px',
                  borderRadius: 10, border: '1.5px solid var(--gray-mid)',
                  fontSize: '.85rem', outline: 'none', fontFamily: '"Plus Jakarta Sans",sans-serif',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Category Filter Pills */}
          {categories.length > 2 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 14, marginBottom: 14 }}>
              {categories.map(catKey => {
                const isSelected = selectedCategory === catKey;
                const label = catKey === 'all' ? 'All Saved' : (BADGE_MAP[catKey]?.color ? catKey.toUpperCase() : catKey);
                return (
                  <button
                    key={catKey}
                    onClick={() => setSelectedCategory(catKey)}
                    style={{
                      padding: '5px 14px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700,
                      border: isSelected ? '1.5px solid var(--g-primary)' : '1px solid var(--gray-mid)',
                      background: isSelected ? 'var(--g-pale)' : '#fff',
                      color: isSelected ? 'var(--g-primary)' : 'var(--gray-dk)',
                      cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Ordinances Grid */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-t)' }}>
              Loading saved offline items...
            </div>
          ) : filteredOrdinances.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
              {filteredOrdinances.map(ord => {
                const s = BADGE_MAP[ord.catK] || { bg: '#F3F4F6', color: '#374151' };
                return (
                  <div
                    key={ord.id}
                    style={{
                      border: '1.5px solid var(--gray-mid)',
                      borderRadius: 16,
                      padding: '18px 20px',
                      background: '#fff',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'all .2s ease',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--g-primary)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-mid)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; }}
                  >
                    <div>
                      {/* Top badges */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <span style={{
                          fontSize: '.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999,
                          background: s.bg, color: s.color, textTransform: 'uppercase', letterSpacing: '.05em'
                        }}>
                          {ord.cat}
                        </span>
                        <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--gray-t)' }}>
                          {ord.ref}
                        </span>
                      </div>

                      {/* Policy Title */}
                      <h3 style={{
                        fontSize: '1rem', fontWeight: 700, color: 'var(--g-dark)',
                        lineHeight: 1.4, margin: '0 0 8px'
                      }}>
                        {ord.title}
                      </h3>

                      {/* Summary */}
                      <p style={{
                        fontSize: '.82rem', color: 'var(--gray-dk)', lineHeight: 1.55,
                        margin: '0 0 14px',
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {ord.summary || ord.desc || 'No summary available.'}
                      </p>
                    </div>

                    {/* Footer Info & Actions */}
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: '.72rem', color: 'var(--gray-t)', padding: '8px 0',
                        borderTop: '1px solid #F3F4F6', marginBottom: 12
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock size={12} /> {new Date(ord.savedAt).toLocaleDateString()}
                        </span>
                        <span>Version {ord.versionLabel || '2025 Revised'}</span>
                      </div>

                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => setViewingPolicy(ord)}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 8,
                            background: 'var(--g-pale)', color: 'var(--g-dark)',
                            fontSize: '.8rem', fontWeight: 800, border: '1px solid var(--g-primary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            transition: 'all .15s'
                          }}
                        >
                          <Eye size={14} /> Quick Read
                        </button>

                        <button
                          onClick={() => navigate(`/ordinances/${ord.id}`)}
                          style={{
                            padding: '8px 12px', borderRadius: 8,
                            background: '#fff', color: 'var(--gray-dk)',
                            fontSize: '.8rem', fontWeight: 700, border: '1px solid var(--gray-mid)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                          title="Open Full Page"
                        >
                          <ExternalLink size={14} />
                        </button>

                        <button
                          onClick={() => requestDeleteOrdinance(ord)}
                          style={{
                            padding: '8px 10px', borderRadius: 8,
                            background: '#FEE2E2', color: '#DC2626',
                            fontSize: '.8rem', fontWeight: 700, border: '1px solid #FECACA',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}
                          title="Remove from Offline Storage"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{
              textAlign: 'center', padding: '48px 20px',
              background: 'var(--gray-bg)', borderRadius: 16, border: '1px dashed var(--gray-mid)'
            }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--gray-t)' }}>
                <Bookmark size={28} />
              </div>
              <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', margin: '0 0 6px' }}>
                {searchQuery ? 'No Matching Saved Policies' : 'No Policies Saved Offline Yet'}
              </h3>
              <p style={{ color: 'var(--gray-t)', fontSize: '.85rem', maxWidth: 420, margin: '0 auto 18px', lineHeight: 1.5 }}>
                {searchQuery
                  ? 'Try searching with different keywords or clear your query filter.'
                  : 'Browse ordinances while online and click "Save Offline" on any policy to store it for offline studying and reference.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => navigate('/ordinances')}
                  style={{
                    padding: '10px 22px', borderRadius: 10,
                    background: 'var(--g-primary)', color: '#fff',
                    fontWeight: 800, fontSize: '.85rem', border: 'none',
                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7
                  }}
                >
                  <Search size={15} /> Browse Ordinances
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── POLICY QUICK READER MODAL ─────────────────────────────────────── */}
      {viewingPolicy && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(3px)', zIndex: 1100,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 700,
            maxHeight: '88vh', overflowY: 'auto',
            boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '28px 32px',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: '.7rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: BADGE_MAP[viewingPolicy.catK]?.bg || '#F3F4F6', color: BADGE_MAP[viewingPolicy.catK]?.color || '#374151', textTransform: 'uppercase' }}>
                    {viewingPolicy.cat}
                  </span>
                  <span style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)' }}>{viewingPolicy.ref}</span>
                  <span style={{ fontSize: '.72rem', color: 'var(--gold)', background: 'var(--g-dark)', padding: '2px 6px', borderRadius: 6, fontWeight: 700 }}>Offline Copy</span>
                </div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: 'var(--g-dark)', margin: 0, lineHeight: 1.3 }}>
                  {viewingPolicy.title}
                </h2>
              </div>
              <button
                onClick={() => setViewingPolicy(null)}
                style={{ background: '#F3F4F6', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--gray-dk)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Policy Summary */}
            <div style={{ background: 'var(--g-pale)', borderLeft: '4px solid var(--g-primary)', padding: '14px 18px', borderRadius: '0 12px 12px 0', marginBottom: 20 }}>
              <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--g-primary)', marginBottom: 4 }}>Key Summary</div>
              <div style={{ fontSize: '.95rem', color: 'var(--g-dark)', lineHeight: 1.55, fontWeight: 500 }}>
                {viewingPolicy.summary}
              </div>
            </div>

            {/* Steps / Procedures if available */}
            {Array.isArray(viewingPolicy.steps) && viewingPolicy.steps.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g-dark)', marginBottom: 10 }}>
                  Procedures & Sanctions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {viewingPolicy.steps.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--g-pale)', color: 'var(--g-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.75rem', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>
                        {idx + 1}
                      </div>
                      <div style={{ fontSize: '.88rem', color: '#374151', lineHeight: 1.5 }}>
                        {typeof step === 'string' ? step : (step.text || step.desc || JSON.stringify(step))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full text if available */}
            {viewingPolicy.full && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: '.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--g-dark)', marginBottom: 10 }}>
                  Official Text
                </div>
                <div style={{ fontSize: '.88rem', color: '#4B5563', lineHeight: 1.65, whiteSpace: 'pre-line', background: 'var(--gray-bg)', padding: '14px 16px', borderRadius: 12 }}>
                  {viewingPolicy.full}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--gray-mid)' }}>
              <button
                onClick={() => navigate(`/ordinances/${viewingPolicy.id}`)}
                style={{
                  padding: '9px 16px', borderRadius: 8,
                  background: 'var(--g-primary)', color: '#fff',
                  fontSize: '.82rem', fontWeight: 800, border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                Go to Full Page <ArrowRight size={14} />
              </button>
              <button
                onClick={() => setViewingPolicy(null)}
                style={{
                  padding: '9px 16px', borderRadius: 8,
                  background: '#F3F4F6', color: 'var(--gray-dk)',
                  fontSize: '.82rem', fontWeight: 700, border: 'none',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CENTRED REMOVE CONFIRMATION MODAL ──────────────────────────────── */}
      <ConfirmationModal
        isOpen={deleteModalOpen}
        type="danger"
        title={itemToDelete?.type === 'handbook' ? 'Remove Handbook from Offline Storage' : 'Remove Ordinance from Offline Storage'}
        message={
          itemToDelete?.type === 'handbook'
            ? 'Are you sure you want to remove the approved Student Handbook PDF from your local offline storage? You will need an active internet connection to download it again.'
            : `Are you sure you want to remove "${itemToDelete?.item?.title}" from your offline saved policies? You will need an internet connection to access it again.`
        }
        confirmText={deleting ? 'Removing...' : 'Remove from Offline'}
        cancelText="Keep Saved"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setItemToDelete(null); }}
      />
    </div>
  );
}

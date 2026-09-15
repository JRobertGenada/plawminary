import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, ChevronRight, ChevronLeft, Filter, SortAsc, X, LayoutGrid, List, BookOpen, Users, Scale, Award, ArrowLeft, SlidersHorizontal, Sparkles, TrendingUp } from 'lucide-react';
import { BADGE_MAP } from '../data/ordinances';
import { searchOrdinances, isScenarioQuery } from '../utils/searchUtility';
import { api } from '../hooks/useApi';

function Badge({ catK, cat }) {
  const s = BADGE_MAP[catK] || { bg: '#F3F4F6', color: '#374151' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 12px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{cat}</span>;
}

const CATS = [
  { k: 'all',        label: 'All Ordinances',   icon: <LayoutGrid size={18} /> },
  { k: 'academic',   label: 'Academic',          icon: <BookOpen size={18} /> },
  { k: 'conduct',    label: 'Student Conduct',   icon: <Users size={18} /> },
  { k: 'discipline', label: 'Student Discipline', icon: <Scale size={18} /> },
  { k: 'rights',     label: 'Rights & Responsibilities', icon: <Award size={18} /> },
];

function SkeletonCard() {
  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--gray-mid)', padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', overflow: 'hidden', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ width: 80, height: 20, background: 'var(--gray-bg)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
        <div style={{ width: 65, height: 18, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
      </div>
      <div style={{ width: '85%', height: 22, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite', marginTop: 4 }} />
      <div style={{ width: '100%', height: 48, background: 'var(--gray-bg)', borderRadius: 6, animation: 'pulse 1.5s infinite' }} />
      <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
        <div style={{ width: '100%', height: 34, background: 'var(--gray-bg)', borderRadius: 10, animation: 'pulse 1.5s infinite' }} />
      </div>
    </div>
  );
}

export default function OrdinancesPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const resultsRef = useRef(null);

  // ── API data state ─────────────────────────────────────────────────────────
  const [ordinances, setOrdinances] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [apiError, setApiError]     = useState(null);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [activeCat, setActiveCat] = useState(params.get('cat') || 'all');
  const [searchQ, setSearchQ]     = useState(params.get('q')   || '');
  const [sort, setSort]           = useState('default');
  const [viewMode, setViewMode]   = useState('grid');
  const [currentPage, setCurrentPage]   = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  // ── Fetch ordinances from API ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setApiError(null);
    api.get('/ordinances')
      .then(data => { if (!cancelled) { setOrdinances(data); setLoading(false); } })
      .catch(err => { if (!cancelled) { console.error('[OrdinancesPage] API error:', err); setApiError(err.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveCat(params.get('cat') || 'all');
    setSearchQ(params.get('q')     || '');
  }, [params]);

  // Reset to page 1 whenever filter, search query, sort, or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCat, searchQ, sort, itemsPerPage]);

  const results = useMemo(() => {
    let d = searchOrdinances(ordinances, searchQ);
    
    if (activeCat !== 'all') {
      d = d.filter(o => o.catK === activeCat);
    }

    if (sort === 'az')  d.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
    if (sort === 'za')  d.sort((a, b) => (b.title || '').localeCompare(a.title || ''));
    if (sort === 'cat') d.sort((a, b) => (a.cat || '').localeCompare(b.cat || ''));
    
    return d;
  }, [ordinances, activeCat, searchQ, sort]);

  // Detect scenario-style query for UI treatment
  const scenarioMode = useMemo(() => isScenarioQuery(searchQ), [searchQ]);

  const totalPages = Math.max(1, Math.ceil(results.length / itemsPerPage));

  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return results.slice(start, start + itemsPerPage);
  }, [results, currentPage, itemsPerPage]);

  const counts = useMemo(() => {
    const map = {};
    const pool = searchOrdinances(ordinances, searchQ);
    
    CATS.forEach(c => {
      if (c.k === 'all') {
        map[c.k] = pool.length;
      } else {
        map[c.k] = pool.filter(o => o.catK === c.k).length;
      }
    });
    return map;
  }, [ordinances, searchQ]);

  // ── Fire page-view event when user navigates to an ordinance ──────────────
  function handleOrdinanceClick(ordinanceId) {
    api.post('/page-views', { targetType: 'ordinance', targetId: String(ordinanceId) })
      .catch(() => {}); // fire-and-forget
    navigate(`/ordinances/${ordinanceId}`);
  }

  function clearAll() {
    setActiveCat('all');
    setSearchQ('');
    setSort('default');
    setCurrentPage(1);
  }

  function handlePageChange(newPage) {
    setCurrentPage(newPage);
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  const startIdx = results.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIdx = Math.min(currentPage * itemsPerPage, results.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 70px)', background: 'var(--gray-bg)' }}>
      <main style={{ flex: 1 }}>

        {/* Hero Search Section */}
        <section className="px-4 py-10 sm:py-14" style={{ background: 'linear-gradient(135deg,var(--g-dark) 0%,var(--g-primary) 60%,var(--g-light) 100%)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%,rgba(244,197,66,.08) 0%,transparent 60%)' }} />
          <div style={{ maxWidth: 1240, margin: '0 auto', position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', color: 'rgba(255,255,255,.6)', marginBottom: 14 }}>
              <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => navigate('/')}>
                <ArrowLeft size={14} /> Home
              </span>
              <ChevronRight size={14} /> 
              <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Ordinance Finder</span>
            </div>
            <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: 'clamp(1.8rem,4.5vw,2.8rem)', color: '#fff', marginBottom: 8 }}>Ordinance Finder</h1>
            <p style={{ color: 'rgba(255,255,255,.8)', marginBottom: 24, fontSize: '.95rem', maxWidth: 600 }}>Search and browse official policies, regulations, and student rights from the PLSP Handbook.</p>
            
            {/* Search Input Box */}
            <div style={{ maxWidth: 720 }}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white rounded-2xl p-1.5 shadow-xl relative gap-2 sm:gap-0">
                <div className="flex-1 flex items-center pl-3 pr-2 py-1.5">
                  <Search size={20} strokeWidth={2.5} style={{ color: 'var(--gray-t)', flexShrink: 0, marginRight: 10 }} />
                  <input
                    type="text"
                    value={searchQ}
                    onChange={e => setSearchQ(e.target.value)}
                    placeholder="Search by title, keyword, or describe your situation…"
                    style={{
                      width: '100%',
                      border: 'none',
                      fontFamily: '"Plus Jakarta Sans",sans-serif',
                      fontSize: '.95rem',
                      background: 'transparent',
                      outline: 'none',
                      color: 'var(--gray-dk)',
                      boxSizing: 'border-box'
                    }}
                  />
                  {searchQ && (
                    <button onClick={() => setSearchQ('')} style={{ background: 'none', border: 'none', color: 'var(--gray-t)', cursor: 'pointer', padding: 4 }}>
                      <X size={16} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => handlePageChange(1)}
                  style={{
                    padding: '10px 24px',
                    borderRadius: 12,
                    background: 'var(--gold)',
                    color: 'var(--g-dark)',
                    fontWeight: 800,
                    fontSize: '.88rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: '"Plus Jakarta Sans",sans-serif',
                    boxShadow: '0 4px 12px rgba(244,197,66,0.25)',
                    flexShrink: 0
                  }}
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <section className="px-4 py-8 sm:py-12">
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            
            {/* Mobile Filter Toggle & Quick Horizontal Pills Bar */}
            <div className="lg:hidden mb-6">
              <div className="flex items-center justify-between gap-3 mb-3">
                <button
                  onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-700 shadow-sm"
                >
                  <SlidersHorizontal size={14} />
                  <span>{mobileFilterOpen ? 'Hide Categories' : 'Filter by Category'}</span>
                  <span className="bg-g-pale text-g-primary px-2 py-0.5 rounded-full text-[10px] font-extrabold ml-1">
                    {CATS.find(c => c.k === activeCat)?.label || 'All'}
                  </span>
                </button>

                {(activeCat !== 'all' || searchQ) && (
                  <button
                    onClick={clearAll}
                    className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  >
                    <X size={14} /> Reset
                  </button>
                )}
              </div>

              {/* Collapsible Category Drawer / Pills on Mobile */}
              {mobileFilterOpen && (
                <div className="bg-white border border-gray-200 rounded-2xl p-3 shadow-sm flex flex-col gap-1.5 mb-4 animate-fadeIn">
                  {CATS.map(({ k, label, icon }) => {
                    const active = activeCat === k;
                    return (
                      <button
                        key={k}
                        onClick={() => {
                          setActiveCat(k);
                          setMobileFilterOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: 10,
                          fontSize: '.85rem',
                          fontWeight: active ? 700 : 600,
                          textAlign: 'left',
                          cursor: 'pointer',
                          border: active ? '1px solid rgba(31,111,61,0.3)' : '1px solid transparent',
                          background: active ? 'var(--g-pale)' : 'transparent',
                          color: active ? 'var(--g-primary)' : 'var(--gray-dk)',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {icon}
                          {label}
                        </span>
                        <span style={{ fontSize: '.7rem', background: active ? 'var(--g-primary)' : 'var(--gray-mid)', color: active ? '#fff' : 'var(--gray-t)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>
                          {counts[k]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 lg:gap-8 items-start">

              {/* Desktop Sidebar Filters */}
              <aside className="hidden lg:block" style={{ 
                background: '#fff', 
                border: '1px solid var(--gray-mid)', 
                borderRadius: 20, 
                padding: '24px 20px', 
                position: 'sticky', 
                top: 90, 
                boxShadow: '0 4px 12px rgba(0,0,0,.03)' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray-t)', marginBottom: 20 }}>
                  <Filter size={14} /> Categories
                </div>
                {CATS.map(({ k, label, icon }) => {
                  const active = activeCat === k;
                  return (
                    <button key={k} onClick={() => setActiveCat(k)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '12px 14px', marginBottom: 6, borderRadius: 12, fontSize: '.88rem', fontWeight: active ? 700 : 600, textAlign: 'left', cursor: 'pointer', border: '1px solid transparent', background: active ? 'var(--g-pale)' : 'transparent', color: active ? 'var(--g-primary)' : 'var(--gray-dk)', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .2s ease' }}
                      onMouseEnter={e => { if(!active) e.currentTarget.style.background = 'var(--gray-bg)'; }}
                      onMouseLeave={e => { if(!active) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ opacity: active ? 1 : 0.6 }}>{icon}</span>
                        {label}
                      </span>
                      <span style={{ fontSize: '.72rem', background: active ? 'var(--g-primary)' : 'var(--gray-mid)', color: active ? '#fff' : 'var(--gray-t)', padding: '2px 8px', borderRadius: 999, fontWeight: 700 }}>{counts[k]}</span>
                    </button>
                  );
                })}
                <div style={{ height: 1, background: 'var(--gray-mid)', margin: '18px 0' }} />
                <button onClick={clearAll} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, fontSize: '.82rem', fontWeight: 700, border: 'none', background: 'transparent', color: 'var(--gray-t)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .2s ease' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#991B1B'; e.currentTarget.style.background = '#FEE2E2'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-t)'; e.currentTarget.style.background = 'transparent'; }}>
                  <X size={16} /> Reset All Filters
                </button>
              </aside>

              {/* Results Area */}
              <div ref={resultsRef} className="min-w-0">
                {/* Header Controls Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-sm">
                  <div style={{ fontSize: '.88rem', color: 'var(--gray-t)', fontWeight: 500 }}>
                    Showing <strong style={{ color: 'var(--g-dark)', fontWeight: 800 }}>{results.length === 0 ? 0 : `${startIdx}–${endIdx}`}</strong> of <strong style={{ color: 'var(--g-dark)', fontWeight: 800 }}>{results.length}</strong> policies
                    {searchQ && <span> matching "<strong>{searchQ}</strong>"</span>}
                  </div>

                  {/* Scenario mode badge */}
                  {scenarioMode && searchQ && (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '5px 12px', borderRadius: 999,
                      background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
                      color: '#fff', fontSize: '.72rem', fontWeight: 700,
                      letterSpacing: '.04em', textTransform: 'uppercase',
                      boxShadow: '0 2px 8px rgba(79,70,229,.3)',
                    }}>
                      <Sparkles size={12} />
                      Scenario Search
                    </div>
                  )}
                  
                  <div className="flex items-center flex-wrap gap-2.5">
                    {/* View Mode Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--gray-bg)', padding: 3, borderRadius: 10, border: '1px solid var(--gray-mid)' }}>
                      <button 
                        onClick={() => setViewMode('grid')}
                        title="Grid View"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: '"Plus Jakarta Sans",sans-serif',
                          fontSize: '.78rem',
                          fontWeight: 700,
                          background: viewMode === 'grid' ? '#fff' : 'transparent',
                          color: viewMode === 'grid' ? 'var(--g-primary)' : 'var(--gray-t)',
                          boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                          transition: 'all .2s'
                        }}
                      >
                        <LayoutGrid size={14} /> Grid
                      </button>
                      <button 
                        onClick={() => setViewMode('list')}
                        title="List View"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 10px',
                          borderRadius: 8,
                          border: 'none',
                          cursor: 'pointer',
                          fontFamily: '"Plus Jakarta Sans",sans-serif',
                          fontSize: '.78rem',
                          fontWeight: 700,
                          background: viewMode === 'list' ? '#fff' : 'transparent',
                          color: viewMode === 'list' ? 'var(--g-primary)' : 'var(--gray-t)',
                          boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,.06)' : 'none',
                          transition: 'all .2s'
                        }}
                      >
                        <List size={14} /> List
                      </button>
                    </div>

                    {/* Sort Order Dropdown */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <SortAsc size={15} color="var(--gray-t)" />
                      <select value={sort} onChange={e => setSort(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--gray-mid)', borderRadius: 10, fontFamily: '"Plus Jakarta Sans",sans-serif', fontSize: '.82rem', fontWeight: 600, color: 'var(--gray-dk)', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                        <option value="default">Default</option>
                        <option value="az">A-Z</option>
                        <option value="za">Z-A</option>
                        <option value="cat">Category</option>
                      </select>
                    </div>

                    {/* Per Page Dropdown */}
                    <select value={itemsPerPage} onChange={e => setItemsPerPage(Number(e.target.value))} style={{ padding: '6px 10px', border: '1px solid var(--gray-mid)', borderRadius: 10, fontFamily: '"Plus Jakarta Sans",sans-serif', fontSize: '.82rem', fontWeight: 600, color: 'var(--gray-dk)', background: '#fff', cursor: 'pointer', outline: 'none' }}>
                      <option value={6}>6 / page</option>
                      <option value={9}>9 / page</option>
                      <option value={18}>18 / page</option>
                      <option value={36}>36 / page</option>
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className={`grid ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'} gap-4 sm:gap-5`}>
                    {[1, 2, 3, 4, 5, 6].map(i => <SkeletonCard key={i} />)}
                  </div>
                ) : results.length > 0 ? (
                  <>
                    {/* Grid Mode */}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
                        {paginatedResults.map((o, i) => (
                          <div
                            key={o.id}
                            role="article"
                            tabIndex={0}
                            aria-label={o.title}
                            className="fade-up"
                            onClick={() => handleOrdinanceClick(o.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOrdinanceClick(o.id);
                              }
                            }}
                            style={{
                              background: '#fff',
                              borderRadius: 16,
                              border: '1px solid var(--gray-mid)',
                              padding: '20px 18px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              position: 'relative',
                              overflow: 'hidden',
                              animationDelay: `${i * 0.03}s`,
                              transition: 'all .22s cubic-bezier(0.4, 0, 0.2, 1)',
                              cursor: 'pointer',
                              height: '100%',
                              boxSizing: 'border-box',
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.borderColor = 'var(--g-primary)';
                              e.currentTarget.style.boxShadow = '0 10px 28px rgba(31,111,61,.1)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.borderColor = 'var(--gray-mid)';
                              e.currentTarget.style.boxShadow = 'none';
                              e.currentTarget.style.transform = 'none';
                            }}
                          >
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 3.5, height: '100%', background: 'linear-gradient(to bottom,var(--g-primary),var(--g-light))', opacity: 0.9 }} />

                            {/* Top row: Category badge + Policy code */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <Badge catK={o.catK} cat={o.cat} />
                              <span style={{ fontSize: '.72rem', color: 'var(--gray-t)', fontWeight: 700, background: 'var(--gray-bg)', border: '1px solid var(--gray-mid)', padding: '2px 8px', borderRadius: 6, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>
                                {o.ref}
                              </span>
                            </div>

                            {/* Official Title */}
                            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--g-dark)', lineHeight: 1.35, margin: '2px 0 0 0', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                              {o.title}
                            </h3>

                            {/* Concise Description */}
                            <p
                              style={{
                                fontSize: '.84rem',
                                color: 'var(--gray-t)',
                                lineHeight: 1.5,
                                margin: 0,
                                flex: 1,
                                display: '-webkit-box',
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                              title={o.desc}
                            >
                              {o.desc}
                            </p>

                            {/* Relevance chip — shown only in scenario search mode */}
                            {scenarioMode && o.relevanceLabel && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                <div style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  padding: '3px 9px', borderRadius: 999,
                                  fontSize: '.68rem', fontWeight: 700,
                                  background: o.relevanceLabel === 'High' ? '#D1FAE5' : o.relevanceLabel === 'Medium' ? '#FEF3C7' : '#F3F4F6',
                                  color: o.relevanceLabel === 'High' ? '#065F46' : o.relevanceLabel === 'Medium' ? '#92400E' : '#6B7280',
                                }}>
                                  <TrendingUp size={10} />
                                  {o.relevanceLabel} Match
                                </div>
                              </div>
                            )}

                            {/* Bottom-aligned View Details Button */}
                            <div style={{ marginTop: 'auto', paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOrdinanceClick(o.id);
                                }}
                                aria-label={`View Details for ${o.title}`}
                                style={{
                                  width: '100%',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 6,
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  fontWeight: 700,
                                  fontSize: '.82rem',
                                  border: '1px solid rgba(31,111,61,0.22)',
                                  background: 'var(--g-pale)',
                                  color: 'var(--g-primary)',
                                  cursor: 'pointer',
                                  fontFamily: '"Plus Jakarta Sans",sans-serif',
                                  transition: 'all .2s ease',
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.background = 'var(--g-primary)';
                                  e.currentTarget.style.color = '#fff';
                                  e.currentTarget.style.borderColor = 'var(--g-primary)';
                                  e.currentTarget.style.boxShadow = '0 3px 10px rgba(31,111,61,.2)';
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.background = 'var(--g-pale)';
                                  e.currentTarget.style.color = 'var(--g-primary)';
                                  e.currentTarget.style.borderColor = 'rgba(31,111,61,0.22)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                              >
                                <span>View Details</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Compact List Mode */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {paginatedResults.map((o, i) => (
                          <div key={o.id} className="fade-up" style={{ background: '#fff', borderRadius: 16, border: '1px solid var(--gray-mid)', padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', animationDelay: `${i * 0.02}s`, transition: 'all .2s ease' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--g-primary)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,.05)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-mid)'; e.currentTarget.style.boxShadow = 'none'; }}
                          >
                            <div style={{ flex: 1, minWidth: 240 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                                <Badge catK={o.catK} cat={o.cat} />
                                <span style={{ fontSize: '.75rem', color: 'var(--gray-t)', fontWeight: 600, background: 'var(--gray-bg)', padding: '2px 6px', borderRadius: 6 }}>{o.ref}</span>
                                {/* Relevance chip in list mode */}
                                {scenarioMode && o.relevanceLabel && (
                                  <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 4,
                                    padding: '2px 8px', borderRadius: 999,
                                    fontSize: '.68rem', fontWeight: 700,
                                    background: o.relevanceLabel === 'High' ? '#D1FAE5' : o.relevanceLabel === 'Medium' ? '#FEF3C7' : '#F3F4F6',
                                    color: o.relevanceLabel === 'High' ? '#065F46' : o.relevanceLabel === 'Medium' ? '#92400E' : '#6B7280',
                                  }}>
                                    <TrendingUp size={9} />
                                    {o.relevanceLabel}
                                  </div>
                                )}
                              </div>
                              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--g-dark)', margin: '0 0 4px 0', lineHeight: 1.35 }}>{o.title}</h3>
                              <p style={{ fontSize: '.84rem', color: 'var(--gray-t)', margin: 0, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{o.desc}</p>
                            </div>

                            <button onClick={() => handleOrdinanceClick(o.id)}
                              aria-label={`View Details for ${o.title}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, fontWeight: 700, fontSize: '.82rem', border: '1px solid rgba(31,111,61,0.22)', background: 'var(--g-pale)', color: 'var(--g-primary)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', whiteSpace: 'nowrap', transition: 'all .2s ease', alignSelf: 'center' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'var(--g-primary)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--g-primary)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'var(--g-pale)'; e.currentTarget.style.color = 'var(--g-primary)'; e.currentTarget.style.borderColor = 'rgba(31,111,61,0.22)'; }}>
                              View Details <ChevronRight size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 36, flexWrap: 'wrap' }}>
                        {/* Prev Button */}
                        <button
                          disabled={currentPage === 1}
                          onClick={() => handlePageChange(currentPage - 1)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--gray-mid)',
                            background: '#fff',
                            color: currentPage === 1 ? 'var(--gray-t)' : 'var(--g-dark)',
                            fontWeight: 700,
                            fontSize: '.82rem',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentPage === 1 ? 0.5 : 1,
                            fontFamily: '"Plus Jakarta Sans",sans-serif',
                            boxShadow: '0 2px 6px rgba(0,0,0,.02)',
                            transition: 'all .2s'
                          }}
                        >
                          <ChevronLeft size={15} /> Prev
                        </button>

                        {/* Page Numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                          if (
                            totalPages > 5 &&
                            pageNum !== 1 &&
                            pageNum !== totalPages &&
                            Math.abs(pageNum - currentPage) > 1
                          ) {
                            if (Math.abs(pageNum - currentPage) === 2) {
                              return <span key={pageNum} style={{ color: 'var(--gray-t)', padding: '0 2px', fontWeight: 600 }}>…</span>;
                            }
                            return null;
                          }

                          const isActive = currentPage === pageNum;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => handlePageChange(pageNum)}
                              style={{
                                minWidth: 36,
                                height: 36,
                                padding: '0 8px',
                                borderRadius: 10,
                                border: isActive ? 'none' : '1px solid var(--gray-mid)',
                                background: isActive ? 'var(--g-primary)' : '#fff',
                                color: isActive ? '#fff' : 'var(--g-dark)',
                                fontWeight: 800,
                                fontSize: '.84rem',
                                cursor: 'pointer',
                                fontFamily: '"Plus Jakarta Sans",sans-serif',
                                boxShadow: isActive ? '0 4px 12px rgba(27,107,74,.25)' : '0 2px 6px rgba(0,0,0,.02)',
                                transition: 'all .2s'
                              }}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        {/* Next Button */}
                        <button
                          disabled={currentPage === totalPages}
                          onClick={() => handlePageChange(currentPage + 1)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: '1px solid var(--gray-mid)',
                            background: '#fff',
                            color: currentPage === totalPages ? 'var(--gray-t)' : 'var(--g-dark)',
                            fontWeight: 700,
                            fontSize: '.82rem',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            opacity: currentPage === totalPages ? 0.5 : 1,
                            fontFamily: '"Plus Jakarta Sans",sans-serif',
                            boxShadow: '0 2px 6px rgba(0,0,0,.02)',
                            transition: 'all .2s'
                          }}
                        >
                          Next <ChevronRight size={15} />
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '60px 24px', background: '#fff', borderRadius: 20, border: '1px solid var(--gray-mid)', boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: 'var(--gray-t)' }}>
                      <Search size={28} />
                    </div>
                    <h3 style={{ color: 'var(--g-dark)', marginBottom: 8, fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem' }}>No policies found</h3>
                    <p style={{ color: 'var(--gray-t)', fontSize: '.9rem', marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>We couldn't find any ordinances matching your current filters or search query.</p>
                    <button onClick={clearAll} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 12, fontWeight: 800, fontSize: '.88rem', border: 'none', background: 'var(--gold)', color: 'var(--g-dark)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', boxShadow: '0 4px 12px rgba(244,197,66,0.3)' }}>
                      <X size={16} /> Clear Search & Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      `}</style>
    </div>
  );
}

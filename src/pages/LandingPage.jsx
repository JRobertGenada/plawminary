import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Scale, BookOpen, ArrowRight,
  Users, Award, ChevronRight, Sparkles
} from 'lucide-react';
import { ORDINANCES } from '../data/ordinances';

// ─── Typing animation hook for search placeholder ──────────────────────────────
const PLACEHOLDERS = [
  'Search an ordinance...',
  'e.g. Uniform dress code...',
  'e.g. Student ID policy...',
  'e.g. Campus discipline offenses...',
  'e.g. Cheating and academic integrity...',
  'e.g. Attendance & dropping subjects...',
  'e.g. Student rights & due process...',
];

function useTypingPlaceholder() {
  const [text, setText] = useState('');
  const [phIdx, setPhIdx] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [pausing, setPausing] = useState(false);

  useEffect(() => {
    const current = PLACEHOLDERS[phIdx];
    if (pausing) {
      const t = setTimeout(() => setPausing(false), 1500);
      return () => clearTimeout(t);
    }
    if (!deleting && text === current) {
      setPausing(true);
      setDeleting(true);
      return;
    }
    const speed = deleting ? 35 : 65;
    const t = setTimeout(() => {
      if (deleting) {
        setText(p => p.slice(0, -1));
        if (text.length === 1) {
          setDeleting(false);
          setPhIdx(i => (i + 1) % PLACEHOLDERS.length);
        }
      } else {
        setText(current.slice(0, text.length + 1));
      }
    }, speed);
    return () => clearTimeout(t);
  }, [text, deleting, pausing, phIdx]);

  return text;
}

// ─── Category styles & meta ──────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'academic',
    label: 'Academic Policies',
    shortLabel: 'Academic Policies',
    desc: 'Grading system, attendance, dropping courses, INC grades, and academic honors.',
    icon: <BookOpen size={24} />,
    color: '#2563EB',
    bg: '#EFF6FF',
    border: '#BFDBFE',
  },
  {
    key: 'conduct',
    label: 'Student Conduct',
    shortLabel: 'Student Conduct',
    desc: 'Uniform rules, student ID requirements, campus decorum, and behavioral expectations.',
    icon: <Users size={24} />,
    color: '#0F4F2C',
    bg: '#E8F5EE',
    border: '#A7F3D0',
  },
  {
    key: 'discipline',
    label: 'Campus Discipline',
    shortLabel: 'Campus Discipline',
    desc: 'Misconduct classifications (Levels 1–3), sanctions, safety, and security policies.',
    icon: <Scale size={24} />,
    color: '#B45309',
    bg: '#FEF9E7',
    border: '#FDE68A',
  },
  {
    key: 'rights',
    label: 'Rights & Responsibilities',
    shortLabel: 'Rights & Responsibilities',
    desc: 'Student charter, due process guarantees, anti-harassment, and grievance procedures.',
    icon: <Award size={24} />,
    color: '#7C3AED',
    bg: '#F5F3FF',
    border: '#DDD6FE',
  },
];

const CAT_COLORS = {
  academic: { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
  conduct: { bg: '#E8F5EE', color: '#0F4F2C', border: '#A7F3D0' },
  discipline: { bg: '#FEF9E7', color: '#B45309', border: '#FDE68A' },
  rights: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
};

// ─── Featured ordinances ─────────────────────────────────────────────────────
const FEATURED_IDS = [1, 2, 3];
const FEATURED = FEATURED_IDS.map(id => ORDINANCES.find(o => o.id === id)).filter(Boolean);

const POPULAR_SEARCHES = ['Uniform', 'Student ID', 'Discipline', 'Attendance', 'Grading'];

export default function LandingPage() {
  const navigate = useNavigate();
  const placeholder = useTypingPlaceholder();
  const [query, setQuery] = useState('');
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef(null);

  // Sticky search bar visibility on scroll
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const obs = new IntersectionObserver(
      ([e]) => setStickyVisible(!e.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);

  const handleSearch = (customQuery) => {
    const term = typeof customQuery === 'string' ? customQuery : query;
    if (term && term.trim()) {
      navigate(`/ordinances?q=${encodeURIComponent(term.trim())}`);
    } else {
      navigate('/ordinances');
    }
  };

  const goCat = (catKey) => {
    navigate(`/ordinances?cat=${catKey}`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#fff' }}>

      {/* ── FLOATING STICKY SEARCH BAR (appears when scrolled past hero) ── */}
      <div style={{
        position: 'fixed', top: 70, left: 0, right: 0, zIndex: 900,
        transform: stickyVisible ? 'translateY(0)' : 'translateY(-120%)',
        transition: 'transform .35s cubic-bezier(.4,0,.2,1)',
        background: 'rgba(15,79,44,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,.1)',
        padding: '10px 16px',
        boxShadow: '0 8px 30px rgba(0,0,0,.25)',
      }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.55)' }} />
            <input
              style={{
                width: '100%', padding: '10px 14px 10px 40px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.12)',
                color: '#fff', fontFamily: '"Plus Jakarta Sans",sans-serif', fontSize: '.88rem', outline: 'none',
                boxSizing: 'border-box'
              }}
              placeholder="Search an ordinance..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={() => handleSearch()}
            style={{
              padding: '10px 18px', borderRadius: 12, background: 'var(--gold)',
              color: 'var(--g-dark)', fontWeight: 800, fontSize: '.84rem', border: 'none',
              cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,.2)', flexShrink: 0
            }}
          >
            Search
          </button>
        </div>
      </div>

      <main style={{ flex: 1 }}>

        {/* ═══════════════════════════════════════════════════════════════════
            1. HERO SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section ref={heroRef} className="px-4 py-14 sm:py-20 lg:py-24" style={{
          background: 'linear-gradient(155deg, var(--g-deep) 0%, var(--g-dark) 48%, var(--g-primary) 100%)',
          position: 'relative',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          {/* Ambient Glows */}
          <div style={{ position: 'absolute', top: -100, right: '10%', width: 450, height: 450, borderRadius: '50%', background: 'radial-gradient(circle, rgba(244,197,66,.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(47,160,92,.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)', backgroundSize: '36px 36px', pointerEvents: 'none' }} />

          <div style={{ maxWidth: 860, margin: '0 auto', position: 'relative', zIndex: 2 }}>

            {/* Title */}
            <h1 style={{
              fontFamily: '"DM Serif Display", serif',
              fontSize: 'clamp(2rem, 5.2vw, 3.8rem)',
              color: '#fff',
              lineHeight: 1.15,
              marginBottom: 16,
              letterSpacing: '-.01em'
            }}>
              PLSP POLICY & ORDINANCE FINDER
            </h1>

            {/* Subtitle */}
            <p style={{
              color: 'rgba(255,255,255,.82)',
              fontSize: 'clamp(0.92rem, 2vw, 1.18rem)',
              lineHeight: 1.6,
              maxWidth: 620,
              margin: '0 auto 32px',
            }}>
              Search policies, rules, ordinances, and student rights in one place.
            </p>

            {/* Central Search Bar */}
            <div style={{
              maxWidth: 680,
              margin: '0 auto 24px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0,0,0,.35)',
              borderRadius: 18,
            }}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-white rounded-2xl p-1.5 sm:p-2 shadow-2xl relative gap-2 sm:gap-0">
                <div className="flex-1 flex items-center pl-3 sm:pl-4 pr-2 py-2 sm:py-1">
                  <Search
                    size={22}
                    strokeWidth={2.5}
                    style={{
                      color: '#9CA3AF',
                      flexShrink: 0,
                      marginRight: 12
                    }}
                  />
                  <input
                    style={{
                      width: '100%',
                      border: 'none',
                      fontFamily: '"Plus Jakarta Sans", sans-serif',
                      fontSize: '1rem',
                      background: 'transparent',
                      outline: 'none',
                      color: 'var(--gray-dk)',
                      boxSizing: 'border-box',
                    }}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder={placeholder}
                  />
                </div>
                <button
                  onClick={() => handleSearch()}
                  style={{
                    padding: '12px 28px',
                    borderRadius: 12,
                    background: 'var(--gold)',
                    color: 'var(--g-dark)',
                    fontWeight: 800,
                    fontSize: '.92rem',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    boxShadow: '0 4px 14px rgba(244,197,66,0.35)',
                    transition: 'all .2s ease',
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--gold-d)';
                    e.currentTarget.style.transform = 'scale(1.02)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--gold)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  Search
                </button>
              </div>
            </div>

            {/* Popular Searches */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 8,
              fontSize: '.85rem',
              color: 'rgba(255,255,255,.7)'
            }}>
              <span style={{ fontWeight: 700, color: 'var(--gold)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Sparkles size={14} /> Popular:
              </span>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  onClick={() => handleSearch(term)}
                  style={{
                    background: 'rgba(255,255,255,.1)',
                    border: '1px solid rgba(255,255,255,.18)',
                    color: 'rgba(255,255,255,.9)',
                    padding: '5px 12px',
                    borderRadius: 999,
                    fontSize: '.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: '"Plus Jakarta Sans", sans-serif',
                    transition: 'all .2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'rgba(244,197,66,.25)';
                    e.currentTarget.style.borderColor = 'var(--gold)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'rgba(255,255,255,.1)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,.18)';
                    e.currentTarget.style.color = 'rgba(255,255,255,.9)';
                  }}
                >
                  {term}
                </button>
              ))}
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            2. BROWSE BY CATEGORY SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-14 sm:py-20" style={{
          background: '#FFFFFF',
          borderBottom: '1px solid #E5E7EB',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Section Header */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                fontSize: '.75rem',
                fontWeight: 800,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'var(--g-primary)',
                marginBottom: 8,
              }}>
                EXPLORE TOPICS
              </div>
              <h2 style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: 'clamp(1.85rem, 3.5vw, 2.6rem)',
                color: 'var(--g-dark)',
                letterSpacing: '-.01em',
              }}>
                BROWSE BY CATEGORY
              </h2>
              <p style={{ color: 'var(--gray-t)', fontSize: '.92rem', marginTop: 8, maxWidth: 540, margin: '8px auto 0' }}>
                Quickly locate policies, sanctions, and student guidelines categorized by institutional domain.
              </p>
            </div>

            {/* 4 Category Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
              {CATEGORIES.map((cat) => {
                const count = ORDINANCES.filter(o => o.catK === cat.key).length;
                return (
                  <div
                    key={cat.key}
                    onClick={() => goCat(cat.key)}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: 20,
                      padding: '28px 20px',
                      cursor: 'pointer',
                      transition: 'all .25s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 16px rgba(0,0,0,.03)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = cat.color;
                      e.currentTarget.style.transform = 'translateY(-5px)';
                      e.currentTarget.style.boxShadow = `0 14px 32px ${cat.bg}ee, 0 4px 12px rgba(0,0,0,.06)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#E5E7EB';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.03)';
                    }}
                  >
                    {/* Top Icon and Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: cat.bg,
                        color: cat.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `1px solid ${cat.border}`,
                      }}>
                        {cat.icon}
                      </div>
                      <span style={{
                        fontSize: '.72rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: cat.bg,
                        color: cat.color,
                        border: `1px solid ${cat.border}`,
                      }}>
                        {count} Policies
                      </span>
                    </div>

                    {/* Card Title */}
                    <h3 style={{
                      fontSize: '1.15rem',
                      fontWeight: 800,
                      color: 'var(--g-dark)',
                      marginBottom: 8,
                      lineHeight: 1.3,
                    }}>
                      {cat.label}
                    </h3>

                    {/* Card Description */}
                    <p style={{
                      fontSize: '.85rem',
                      color: 'var(--gray-t)',
                      lineHeight: 1.6,
                      flex: 1,
                      marginBottom: 18,
                    }}>
                      {cat.desc}
                    </p>

                    {/* Action link */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: '.85rem',
                      fontWeight: 700,
                      color: cat.color,
                      marginTop: 'auto',
                    }}>
                      View Policies <ArrowRight size={15} />
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            3. FEATURED POLICIES SECTION
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="px-4 py-14 sm:py-20" style={{
          background: 'var(--gray-bg)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Section Header */}
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{
                fontSize: '.75rem',
                fontWeight: 800,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'var(--g-primary)',
                marginBottom: 8,
              }}>
                FREQUENTLY REFERENCED
              </div>
              <h2 style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: 'clamp(1.85rem, 3.5vw, 2.6rem)',
                color: 'var(--g-dark)',
                letterSpacing: '-.01em',
              }}>
                FEATURED POLICIES
              </h2>
              <p style={{ color: 'var(--gray-t)', fontSize: '.92rem', marginTop: 8, maxWidth: 520, margin: '8px auto 0' }}>
                Key student handbook policies regarding uniform, academic honesty, and identification.
              </p>
            </div>

            {/* 3 Featured Policy Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {FEATURED.map((ord) => {
                const c = CAT_COLORS[ord.catK] || CAT_COLORS.academic;
                return (
                  <div
                    key={ord.id}
                    onClick={() => navigate(`/ordinances/${ord.id}`)}
                    style={{
                      background: '#FFFFFF',
                      border: '1px solid var(--gray-mid)',
                      borderRadius: 20,
                      padding: '26px 22px',
                      cursor: 'pointer',
                      transition: 'all .25s ease',
                      display: 'flex',
                      flexDirection: 'column',
                      boxShadow: '0 4px 16px rgba(0,0,0,.03)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = c.color;
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = `0 14px 32px rgba(0,0,0,.08)`;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--gray-mid)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.03)';
                    }}
                  >
                    {/* Header: Category Badge + Reference Code */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        fontSize: '.7rem',
                        fontWeight: 700,
                        letterSpacing: '.05em',
                        textTransform: 'uppercase',
                        background: c.bg,
                        color: c.color,
                        border: `1px solid ${c.border}`
                      }}>
                        {ord.cat}
                      </span>
                      <span style={{ fontSize: '.72rem', color: 'var(--gray-t)', fontWeight: 600 }}>
                        {ord.ref}
                      </span>
                    </div>

                    {/* Policy Title */}
                    <h3 style={{
                      fontSize: '1.12rem',
                      fontWeight: 800,
                      color: 'var(--g-dark)',
                      lineHeight: 1.35,
                      marginBottom: 10,
                    }}>
                      {ord.title}
                    </h3>

                    {/* Summary Excerpt */}
                    <p style={{
                      fontSize: '.85rem',
                      color: 'var(--gray-t)',
                      lineHeight: 1.6,
                      flex: 1,
                      marginBottom: 18,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {ord.summary}
                    </p>

                    {/* Footer / Read link */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 14,
                      borderTop: '1px solid #F3F4F6',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.color, fontSize: '.84rem', fontWeight: 700 }}>
                        Read Policy <ChevronRight size={15} />
                      </span>
                      <span style={{ fontSize: '.75rem', color: '#9CA3AF', fontWeight: 600 }}>
                        {ord.steps?.length || 4} Steps
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Centered Browse All → Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => navigate('/ordinances')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '13px 32px',
                  borderRadius: 14,
                  background: 'var(--g-dark)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: '"Plus Jakarta Sans", sans-serif',
                  boxShadow: '0 8px 24px rgba(15,79,44,0.25)',
                  transition: 'all .25s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--g-primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--g-dark)';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                Browse All <ArrowRight size={18} />
              </button>
            </div>

          </div>
        </section>

      </main>
    </div>
  );
}

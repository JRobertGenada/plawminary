import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Lightbulb, ScrollText, ClipboardList, Info, Printer, Link2, ChevronLeft, ChevronRight, CheckCircle2, MessageSquare, Sparkles, AlertCircle, RotateCcw, BookOpen, ArrowRight } from 'lucide-react';
import { BADGE_MAP } from '../data/ordinances';
import { api } from '../hooks/useApi';
import CommentsPanel from '../components/CommentsPanel';

function Badge({ catK, cat }) {
  const s = BADGE_MAP[catK] || { bg: '#F3F4F6', color: '#374151' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '4px 14px', borderRadius: 999, fontSize: '.72rem', fontWeight: 800, letterSpacing: '.05em', textTransform: 'uppercase', background: s.bg, color: s.color }}>
      {cat}
    </span>
  );
}

// ── AI Explanation panel ────────────────────────────────────────────────────
// States: 'idle' | 'loading' | 'done' | 'error'

function AiExplanationPanel({ ord }) {
  const [state, setState]       = useState('idle');
  const [result, setResult]     = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchExplanation = useCallback(async () => {
    setState('loading');
    setResult(null);
    setErrorMsg('');

    // Build best available official content to ground Gemini
    const policyContent = [
      ord.summary,
      ...(Array.isArray(ord.steps) ? ord.steps : []),
      ord.fullText || '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 8000);

    try {
      const data = await api.post('/ai/explain', {
        query:         `Explain this policy to a student: ${ord.title}`,
        policyTitle:   ord.title,
        policyContent,
      });
      if (!data?.success) throw new Error('Unexpected response from server');
      setResult(data);
      setState('done');
    } catch (err) {
      setErrorMsg(err.message || 'Could not generate explanation. Please try again.');
      setState('error');
    }
  }, [ord]);

  // ── Idle: prompt button ───────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div style={{ marginBottom: 32 }}>
        <button
          id="ai-explain-btn"
          onClick={fetchExplanation}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 22px', borderRadius: 14,
            background: 'linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%)',
            color: '#fff', fontSize: '.88rem', fontWeight: 700,
            fontFamily: '"Plus Jakarta Sans",sans-serif',
            border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,.35)',
            transition: 'all .22s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,.35)'; }}
        >
          <Sparkles size={17} />
          Get AI Explanation
        </button>
        <p style={{ marginTop: 10, fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 500, maxWidth: 480 }}>
          Optional · AI-generated, based only on the official policy text above. The handbook is authoritative.
        </p>
      </div>
    );
  }

  // ── Loading: skeleton ─────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div
        id="ai-explanation-panel"
        style={{
          marginBottom: 32,
          background: 'linear-gradient(135deg,rgba(30,58,95,.04) 0%,rgba(37,99,235,.06) 100%)',
          border: '1.5px solid rgba(37,99,235,.18)',
          borderRadius: 20, padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(37,99,235,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={18} style={{ color: '#2563eb', animation: 'spin 1.6s linear infinite' }} />
          </div>
          <div>
            <div style={{ fontSize: '.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#2563eb' }}>AI Explanation</div>
            <div style={{ fontSize: '.78rem', color: 'var(--gray-t)', marginTop: 1 }}>Generating student-friendly explanation…</div>
          </div>
        </div>
        {[80, 60, 90].map((w, i) => (
          <div key={i} style={{ height: 14, borderRadius: 8, background: 'rgba(37,99,235,.1)', marginBottom: 10, width: `${w}%`, animation: 'pulse 1.5s infinite' }} />
        ))}
        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 12, borderRadius: 8, background: 'rgba(37,99,235,.07)', width: `${50 + i * 12}%`, animation: 'pulse 1.5s infinite' }} />
          ))}
        </div>
        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div
        id="ai-explanation-panel"
        style={{
          marginBottom: 32,
          background: '#FFF7F7', border: '1.5px solid #FECACA',
          borderRadius: 20, padding: '22px 26px',
          display: 'flex', alignItems: 'flex-start', gap: 14,
        }}
      >
        <div style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }}>
          <AlertCircle size={22} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '.88rem', fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>Explanation Unavailable</div>
          <div style={{ fontSize: '.82rem', color: '#7F1D1D', lineHeight: 1.5 }}>{errorMsg}</div>
          <button
            onClick={fetchExplanation}
            style={{
              marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '8px 16px', borderRadius: 10, background: '#FEE2E2',
              border: '1px solid #FECACA', color: '#DC2626',
              fontSize: '.82rem', fontWeight: 700,
              fontFamily: '"Plus Jakarta Sans",sans-serif', cursor: 'pointer',
              transition: 'all .2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#FECACA'}
            onMouseLeave={e => e.currentTarget.style.background = '#FEE2E2'}
          >
            <RotateCcw size={14} /> Try Again
          </button>
        </div>
      </div>
    );
  }

  // ── Done: grounded explanation ────────────────────────────────────────────
  const { explanation, keyPoints, recommendedAction, source } = result;
  return (
    <div
      id="ai-explanation-panel"
      style={{
        marginBottom: 32,
        background: 'linear-gradient(135deg,rgba(30,58,95,.03) 0%,rgba(37,99,235,.05) 100%)',
        border: '1.5px solid rgba(37,99,235,.2)',
        borderRadius: 20, padding: '26px 30px',
        boxShadow: '0 6px 24px rgba(37,99,235,.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(37,99,235,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <div style={{ fontSize: '.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#2563eb' }}>AI Explanation</div>
            <div style={{ fontSize: '.75rem', color: 'var(--gray-t)', marginTop: 2 }}>
              {source === 'fallback' ? 'Based on policy summary' : 'Generated from official policy text'}
            </div>
          </div>
        </div>
        <button
          onClick={() => setState('idle')}
          title="Dismiss"
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(37,99,235,.2)', background: 'transparent', color: '#2563eb', fontSize: '.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .2s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(37,99,235,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          Dismiss
        </button>
      </div>

      {/* Explanation paragraph */}
      <p style={{ fontSize: '1rem', color: '#1e3a5f', lineHeight: 1.7, fontWeight: 500, margin: '0 0 20px' }}>
        {explanation}
      </p>

      {/* Key points */}
      {Array.isArray(keyPoints) && keyPoints.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: '#2563eb', marginBottom: 10 }}>
            Key Points
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {keyPoints.map((pt, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(37,99,235,.1)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', fontWeight: 800, flexShrink: 0, marginTop: 1 }}>
                  {i + 1}
                </div>
                <span style={{ fontSize: '.88rem', color: '#334155', lineHeight: 1.55 }}>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommended action */}
      {recommendedAction && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 12, background: 'rgba(37,99,235,.07)', border: '1px solid rgba(37,99,235,.14)', marginBottom: 18 }}>
          <ArrowRight size={16} style={{ color: '#2563eb', flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontSize: '.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', color: '#2563eb', marginBottom: 3 }}>Recommended Action</div>
            <span style={{ fontSize: '.88rem', color: '#1e3a5f', fontWeight: 500, lineHeight: 1.5 }}>{recommendedAction}</span>
          </div>
        </div>
      )}

      {/* Authoritative disclaimer */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 10, background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.06)' }}>
        <BookOpen size={14} style={{ color: 'var(--gray-t)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: '.75rem', color: 'var(--gray-t)', lineHeight: 1.5, margin: 0 }}>
          AI-generated explanation based on the official policy content. The Student Handbook is the authoritative source — consult it or your academic adviser for final decisions.
        </p>
      </div>
    </div>
  );
}

export default function OrdinanceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);
  const [ord, setOrd]         = useState(null);
  const [related, setRelated] = useState([]);
  const [notFound, setNotFound] = useState(false);

  // ── Fetch ordinance from API ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);

    api.get(`/ordinances/${id}`)
      .then(data => {
        if (cancelled) return;
        setOrd(data);

        // Fire page-view event (fire-and-forget)
        api.post('/page-views', { targetType: 'ordinance', targetId: String(id) }).catch(() => {});

        // Fetch related ordinances
        if (data.related?.length) {
          Promise.all(data.related.map(rid => api.get(`/ordinances/${rid}`).catch(() => null)))
            .then(results => { if (!cancelled) setRelated(results.filter(Boolean)); });
        } else {
          setRelated([]);
        }
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        if (err.status === 404) setNotFound(true);
        else console.error('[OrdinanceDetailPage] API error:', err);
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) {
    return (
      <div style={{ background: 'var(--gray-bg)', minHeight: 'calc(100vh - 70px)' }}>
        <div style={{ background: 'var(--g-dark)', padding: '60px 0 40px' }}>
          <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 20px' }}>
            <div style={{ width: 120, height: 20, background: 'rgba(255,255,255,.1)', borderRadius: 10, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: '60%', height: 40, background: 'rgba(255,255,255,.1)', borderRadius: 12, animation: 'pulse 1.5s infinite' }} />
          </div>
        </div>
        <div className="max-w-[1000px] mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ height: 100, background: '#fff', borderRadius: 20, border: '1px solid var(--gray-mid)', animation: 'pulse 1.5s infinite' }} />
            <div style={{ height: 260, background: '#fff', borderRadius: 20, border: '1px solid var(--gray-mid)', animation: 'pulse 1.5s infinite' }} />
          </div>
          <div style={{ height: 320, background: '#fff', borderRadius: 20, border: '1px solid var(--gray-mid)', animation: 'pulse 1.5s infinite' }} />
        </div>
        <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }`}</style>
      </div>
    );
  }

  if (notFound || (!loading && !ord)) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-t)', marginBottom: 20 }}>
          <Info size={36} />
        </div>
        <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.8rem', color: 'var(--g-dark)', marginBottom: 10 }}>Ordinance Not Found</h2>
        <p style={{ color: 'var(--gray-t)', marginBottom: 28, maxWidth: 400, fontSize: '.95rem' }}>The ordinance you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/ordinances')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', borderRadius: 12, background: 'var(--g-primary)', color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <ChevronLeft size={18} /> Back to Ordinances
        </button>
      </div>
    );
  }



  return (
    <div style={{ background: 'var(--gray-bg)', minHeight: 'calc(100vh - 70px)' }}>

      {/* Sub-hero */}
      <div className="px-4 pt-10 pb-28 sm:pt-12 sm:pb-36" style={{ background: 'linear-gradient(135deg,var(--g-dark) 0%,var(--g-primary) 60%,var(--g-light) 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 80% 50%,rgba(244,197,66,.08) 0%,transparent 60%)' }} />
        <div style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 1 }}>

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.8rem', color: 'rgba(255,255,255,.6)', marginBottom: 18, flexWrap: 'wrap' }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Home</Link>
            <ChevronRight size={14} />
            <Link to="/ordinances" style={{ color: 'rgba(255,255,255,.6)', textDecoration: 'none' }}>Ordinances</Link>
            <ChevronRight size={14} />
            <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{ord.ref}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Badge catK={ord.catK} cat={ord.cat} />
                <span style={{ fontSize: '.85rem', color: '#fff', fontWeight: 600, letterSpacing: '.05em' }}>{ord.ref}</span>
              </div>
              <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: 'clamp(1.6rem,3.8vw,2.4rem)', color: '#fff', lineHeight: 1.25, maxWidth: 700 }}>{ord.title}</h1>
            </div>
            <button onClick={() => navigate('/ordinances')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 10, background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.15)', color: '#fff', fontSize: '.82rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .2s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.1)'}
            >
              <ChevronLeft size={16} /> Back to List
            </button>
          </div>
        </div>
      </div>

      {/* Body Content */}
      <div className="px-4 pb-8 sm:pb-12" style={{ maxWidth: 1000, margin: '0 auto', position: 'relative', zIndex: 10 }}>
        {/* KEY POLICY SUMMARY (Full Width) */}
        <div className="mb-8 sm:mb-10 p-6 sm:p-10" style={{ background: '#fff', borderLeft: '6px solid var(--g-dark)', borderRadius: 24, boxShadow: '0 12px 40px rgba(0,0,0,0.08)', marginTop: -80 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{ color: 'var(--g-dark)', background: '#FDE68A', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Lightbulb size={24} />
            </div>
            <div>
              <div style={{ fontSize: '.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray-dk)' }}>Key Policy Summary</div>
              <div style={{ fontSize: '.85rem', color: 'var(--gray-t)', fontWeight: 500, marginTop: 2 }}>What students need to know</div>
            </div>
          </div>
          <p style={{ fontSize: '1.2rem', color: 'var(--gray-dk)', lineHeight: 1.6, margin: '24px 0', fontWeight: 500 }}>{ord.summary}</p>
          {(ord.handbookSectionId || ord.page) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
              <button onClick={() => navigate('/handbook', { state: { sectionId: ord.handbookSectionId, page: ord.page } })} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, background: 'var(--g-pale)', color: 'var(--g-dark)', fontSize: '.85rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', border: '1px solid var(--g-primary)', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#d1f4e0' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--g-pale)' }}
              >
                <ScrollText size={18} /> View in Handbook {ord.page ? `(Page ${ord.page})` : ''} &rarr;
              </button>
              <span style={{ fontSize: '.8rem', color: 'var(--gray-t)', paddingLeft: 4, fontWeight: 500 }}>
                {ord.page ? `Opens Page ${ord.page} in the digital Student Handbook` : 'Opens the relevant page in the Student Handbook'}
              </span>
            </div>
          )}
        </div>

        {/* AI EXPLANATION — optional, only shown when user clicks the button */}
        {ord.summary && (
          <AiExplanationPanel key={ord.id} ord={ord} />
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-8 items-start">

          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Action Procedures */}
            <div className="p-5 sm:p-8" style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ color: 'var(--g-primary)' }}><ClipboardList size={22} /></div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.2rem', color: 'var(--g-dark)', margin: 0 }}>Action Procedures</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {ord.steps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--g-pale)', color: 'var(--g-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 800, flexShrink: 0, marginTop: 2 }}>{i + 1}</div>
                    <p style={{ fontSize: '.92rem', color: '#475569', lineHeight: 1.6, margin: 0 }}>{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Comments / Discussion */}
            <div className="p-5 sm:p-8" style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ color: 'var(--gold-d)' }}><MessageSquare size={22} /></div>
                <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.2rem', color: 'var(--g-dark)', margin: 0 }}>Student Discussion</h2>
              </div>
              <CommentsPanel sectionId={`ord-${ord.id}`} sectionTitle={ord.title} />
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-24">

            {/* Quick info */}
            <div className="p-5" style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray-t)', marginBottom: 16 }}>Information Card</div>
              {[
                ['Reference', ord.ref],
                ['Category', ord.cat],
                ['Version', '2025 Revised'],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gray-bg)' }}>
                  <span style={{ fontSize: '.84rem', color: 'var(--gray-t)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: '.84rem', fontWeight: 700, color: 'var(--g-dark)' }}>{val}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10 }}>
                <span style={{ fontSize: '.84rem', color: 'var(--gray-t)', fontWeight: 500 }}>Status</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 999, fontSize: '.72rem', fontWeight: 800, background: '#D1FAE5', color: '#065F46' }}>
                  <CheckCircle2 size={12} /> Active
                </span>
              </div>
            </div>

            {/* Quick actions */}
            <div className="p-5" style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray-t)', marginBottom: 14 }}>Resources</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button onClick={() => window.print()} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gray-mid)', background: 'transparent', color: 'var(--gray-dk)', fontSize: '.84rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--gray-bg)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <Printer size={16} /> Print Policy Document
                </button>
                <button onClick={handleCopy} style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--gray-mid)', background: copied ? 'var(--g-pale)' : 'transparent', color: copied ? 'var(--g-primary)' : 'var(--gray-dk)', fontSize: '.84rem', fontWeight: 700, cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, transition: 'all .2s' }}
                  onMouseEnter={e => !copied && (e.currentTarget.style.background = 'var(--gray-bg)')}
                  onMouseLeave={e => !copied && (e.currentTarget.style.background = 'transparent')}
                >
                  <Link2 size={16} /> {copied ? 'Link Copied to Clipboard!' : 'Copy Official Link'}
                </button>
              </div>
            </div>

            {/* Related ordinances */}
            {related.length > 0 && (
              <div className="p-5" style={{ background: '#fff', border: '1px solid var(--gray-mid)', borderRadius: 20, boxShadow: '0 4px 12px rgba(0,0,0,.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gray-t)', marginBottom: 16 }}>
                  <Link2 size={14} /> Related Policies
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {related.map(r => {
                    const s = BADGE_MAP[r.catK] || { bg: '#F3F4F6', color: '#374151' };
                    return (
                      <Link key={r.id} to={`/ordinances/${r.id}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--gray-mid)', background: 'var(--gray-bg)', transition: 'all .2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--g-primary)'; e.currentTarget.style.background = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gray-mid)'; e.currentTarget.style.background = 'var(--gray-bg)'; }}
                      >
                        <div style={{ fontSize: '.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 999, background: s.bg, color: s.color, display: 'inline-block', marginBottom: 6, letterSpacing: '.05em' }}>{r.cat}</div>
                        <div style={{ fontSize: '.86rem', fontWeight: 700, color: 'var(--g-dark)', lineHeight: 1.35 }}>{r.title}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '.72rem', color: 'var(--gray-t)', marginTop: 6, fontWeight: 600 }}>
                          {r.ref} <ChevronRight size={12} />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

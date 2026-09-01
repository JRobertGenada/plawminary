import { CheckCircle, Circle, BookMarked } from 'lucide-react';
import CommentsPanel from './CommentsPanel';

const BADGE_COLORS = {
  'Fundamental Right': { bg: '#DBEAFE', color: '#1D4ED8' },
  'Civil Right':       { bg: '#EDE9FE', color: '#5B21B6' },
  'Privacy Right':     { bg: '#CCFBF1', color: '#0F766E' },
  'Academic Policy':   { bg: '#FEF3C7', color: '#92400E' },
  'Conduct Policy':    { bg: '#FFEDD5', color: '#9A3412' },
  'Disciplinary Code': { bg: '#FCE7F3', color: '#9D174D' },
  'Procedural Right':  { bg: '#D1FAE5', color: '#065F46' },
};

export default function PolicyReader({ chapter, section, isRead, onMarkRead }) {
  if (!section) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--g-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, fontSize: '1.8rem' }}>⚖️</div>
        <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', color: 'var(--g-dark)', marginBottom: 8 }}>PLSP Student Handbook</h2>
        <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', maxWidth: 280, lineHeight: 1.65 }}>
          Select a chapter from the sidebar to begin reading. Track your progress as you go.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 24, maxWidth: 260 }}>
          {[['14,208','Enrolled Students'],['15','Accredited Programs']].map(([n, l]) => (
            <div key={l} style={{ background: 'var(--g-pale)', borderRadius: 10, padding: '12px 14px', textAlign: 'left' }}>
              <div style={{ fontSize: '.72rem', color: 'var(--gray-t)', marginBottom: 3 }}>{l}</div>
              <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: 'var(--g-dark)' }}>{n}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const badge = BADGE_COLORS[section.badge] || { bg: '#F3F4F6', color: '#374151' };
  const done = isRead(section.id);

  return (
    <article style={{ flex: 1, overflowY: 'auto' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 32px 64px' }}>

        {/* Breadcrumb */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '.75rem', color: 'var(--gray-t)', marginBottom: 18 }}>
          <span>Student Handbook</span><span>›</span>
          <span>{chapter.title}</span><span>›</span>
          <span style={{ color: 'var(--gray-dk)' }}>{section.title}</span>
        </nav>

        {/* Header */}
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.6rem', color: 'var(--g-dark)', lineHeight: 1.25, marginBottom: 12 }}>{section.title}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700, background: badge.bg, color: badge.color }}>{section.badge}</span>
            <span style={{ fontSize: '.78rem', color: 'var(--gray-t)' }}>{section.reference}</span>
          </div>
        </header>

        <div style={{ height: 1, background: 'var(--gray-mid)', marginBottom: 24 }} />

        {/* Policy content */}
        <div className="prose-plawminary" style={{ color: 'var(--gray-dk)', fontSize: '.9rem' }} dangerouslySetInnerHTML={{ __html: section.content }} />

        {/* Actions */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--gray-mid)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => onMarkRead(section.id)}
            disabled={done}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 18px', borderRadius: 8, fontSize: '.85rem', fontWeight: 600,
              border: `1.5px solid ${done ? 'rgba(212,168,67,.5)' : 'var(--gray-mid)'}`,
              background: done ? '#FEF9E7' : '#fff',
              color: done ? '#92400E' : 'var(--gray-t)',
              cursor: done ? 'default' : 'pointer',
              fontFamily: '"Plus Jakarta Sans",sans-serif',
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: '1rem' }}>{done ? '✅' : '○'}</span>
            {done ? 'Section completed' : 'Mark as read'}
          </button>
        </div>

        {/* Comments */}
        <CommentsPanel sectionId={section.id} sectionTitle={section.title} />
      </div>
    </article>
  );
}

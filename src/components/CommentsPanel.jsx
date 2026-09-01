import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useComments } from '../hooks/useComments';
import { getDepartmentColor } from '../data/departments';

const TYPE_STYLE = {
  policy:   { bg: '#FCE7F3', color: '#9D174D', label: '📝 Policy Suggestion' },
  question: { bg: '#D1FAE5', color: '#065F46', label: '❓ Question'  },
  revision: { bg: '#DBEAFE', color: '#1D4ED8', label: '✏️ For Revision' },
};

const FEEDBACK_OPTIONS = ['policy', 'question'];

function timeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function initials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function avatarColor(dept) {
  return getDepartmentColor(dept);
}

export default function CommentsPanel({ sectionId, sectionTitle }) {
  const { user, isLoggedIn } = useAuth();
  const { comments, addComment, toggleAgree } = useComments(sectionId);
  const navigate = useNavigate();
  const location = useLocation();

  const [text, setText]       = useState('');
  const [type, setType]       = useState('policy');
  const [submitted, setSubmitted] = useState(false);
  // agrees is now a server-managed array — no local liked tracking needed

  function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    addComment(user, text.trim(), type);
    setText('');
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  function handleAgree(id) {
    if (!isLoggedIn) return;
    toggleAgree(id);
  }

  return (
    <div style={{ marginTop: 40, borderTop: '1.5px solid var(--gray-mid)', paddingTop: 32 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.15rem', color: 'var(--g-dark)', flex: 1 }}>
          Student Feedback
        </h3>
        <span style={{ fontSize: '.78rem', color: 'var(--gray-t)', background: 'var(--gray-bg)', padding: '3px 10px', borderRadius: 999, fontWeight: 600 }}>
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Post form */}
      {isLoggedIn ? (
        <div style={{ background: 'var(--g-pale)', border: '1.5px solid #C2E0CE', borderRadius: 14, padding: 20, marginBottom: 28 }}>

          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarColor(user.dept), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials(user.name)}
            </div>
            <div>
              <div style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--g-dark)' }}>{user.name}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--gray-t)' }}>{user.dept} · {user.id} · Verified Student ✓</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Type selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {FEEDBACK_OPTIONS.map(k => {
                const { bg, color, label } = TYPE_STYLE[k];
                return (
                  <button key={k} type="button" onClick={() => setType(k)} style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: '.75rem', fontWeight: 700,
                    border: `1.5px solid ${type === k ? color : 'transparent'}`,
                    background: type === k ? bg : 'rgba(255,255,255,.6)',
                    color: type === k ? color : 'var(--gray-t)',
                    cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif',
                    transition: 'all .15s',
                  }}>{label}</button>
                );
              })}
            </div>

            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={`Write your ${TYPE_STYLE[type].label.split(' ').slice(1).join(' ').toLowerCase()} about "${sectionTitle}"…`}
              rows={3}
              style={{ width: '100%', padding: '11px 14px', border: '1.5px solid #C2E0CE', borderRadius: 10, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', resize: 'vertical', background: '#fff', marginBottom: 12 }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <p style={{ fontSize: '.72rem', color: 'var(--gray-t)', lineHeight: 1.5, flex: 1, minWidth: 200 }}>
                Submitted feedback is reviewed by the admin and may be forwarded to the Board of Regents.
              </p>
              <button type="submit" disabled={!text.trim()} style={{
                padding: '9px 20px', borderRadius: 8, border: 'none',
                background: text.trim() ? 'var(--g-primary)' : 'var(--gray-mid)',
                color: '#fff', fontWeight: 700, fontSize: '.85rem',
                cursor: text.trim() ? 'pointer' : 'not-allowed',
                fontFamily: '"Plus Jakarta Sans",sans-serif', flexShrink: 0,
              }}>
                Submit
              </button>
            </div>

            {submitted && (
              <div style={{ marginTop: 10, padding: '9px 14px', background: '#D1FAE5', borderRadius: 8, fontSize: '.82rem', color: '#065F46', fontWeight: 600 }}>
                ✅ Your feedback has been submitted and is pending admin review.
              </div>
            )}
          </form>
        </div>
      ) : (
        /* Not logged in CTA */
        <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: '22px 24px', marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ fontSize: '1.5rem' }}>🔐</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '.925rem', fontWeight: 700, color: 'var(--g-dark)', marginBottom: 3 }}>Sign in to leave feedback</div>
            <div style={{ fontSize: '.82rem', color: 'var(--gray-t)' }}>Only verified PLSP students can submit comments and suggestions on policies.</div>
          </div>
          <button onClick={() => navigate('/login', { state: { from: location.pathname } })} style={{
            padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--g-primary)',
            color: '#fff', fontWeight: 700, fontSize: '.85rem', cursor: 'pointer',
            fontFamily: '"Plus Jakarta Sans",sans-serif', flexShrink: 0,
          }}>
            Sign In →
          </button>
        </div>
      )}

      {/* Comments list */}
      {comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--gray-t)', fontSize: '.875rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>💬</div>
          No feedback yet. Be the first to share your thoughts on this policy.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {comments.map(c => {
            const ts = TYPE_STYLE[c.type] || TYPE_STYLE.revision;
            const agreed = user && Array.isArray(c.agrees) && c.agrees.includes(user.id);
            return (
              <div key={c.id} style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 12, padding: '16px 18px', transition: 'border .15s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>

                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor(c.userDept), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.78rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                    {initials(c.userName)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Meta row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--g-dark)' }}>{c.userName}</span>
                      <span style={{ fontSize: '.72rem', color: 'var(--gray-t)' }}>{c.userDept}</span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: '.68rem', fontWeight: 700, background: ts.bg, color: ts.color }}>{ts.label}</span>
                      <span style={{ fontSize: '.72rem', color: 'var(--gray-t)', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                    </div>

                    {/* Text */}
                    <p style={{ fontSize: '.875rem', color: 'var(--gray-dk)', lineHeight: 1.65, marginBottom: 10 }}>{c.body}</p>

                    {/* Agree */}
                    <button onClick={() => handleAgree(c.id)} style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '4px 10px', borderRadius: 999,
                      border: `1px solid ${agreed ? 'var(--g-primary)' : 'var(--gray-mid)'}`,
                      background: agreed ? 'var(--g-pale)' : 'transparent',
                      color: agreed ? 'var(--g-primary)' : 'var(--gray-t)',
                      fontSize: '.75rem', fontWeight: 600, cursor: isLoggedIn ? 'pointer' : 'default',
                      fontFamily: '"Plus Jakarta Sans",sans-serif', transition: 'all .15s',
                    }}>
                      👍 {(c.agrees || []).length} {agreed ? 'Agreed' : 'Agree'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

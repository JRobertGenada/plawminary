import { useState, useEffect, useCallback } from 'react';
import { api } from '../../hooks/useApi';
import { CheckCircle2, Info, MessageSquare, Edit3, BookPlus, Check, RefreshCw, AlertCircle, Trash2, HelpCircle } from 'lucide-react';

const TYPE_CONFIG = {
  revision: { icon: <Edit3 size={12} />,   bg: '#DBEAFE', color: '#1D4ED8', label: 'For Revision'       },
  policy:   { icon: <BookPlus size={12} />, bg: '#FCE7F3', color: '#9D174D', label: 'Policy Suggestion'  },
  question: { icon: <HelpCircle size={12} />,bg: '#FEF9C3',color: '#854D0E', label: 'Question'           },
};

export default function SuggestionsTab() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('all');
  const [toast, setToast]     = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Fetch all comments from admin endpoint ────────────────────────────────
  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/comments');
      setItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load suggestions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Toggle resolved ───────────────────────────────────────────────────────
  async function toggleResolve(id) {
    try {
      const { resolved } = await api.patch(`/admin/comments/${id}/resolve`);
      setItems(prev => prev.map(s => s.id === id ? { ...s, resolved } : s));
      showToast(resolved ? 'Suggestion marked as resolved.' : 'Suggestion reopened.');
    } catch (err) {
      showToast(err.message || 'Failed to update.', true);
    }
  }

  // ── Hard delete ───────────────────────────────────────────────────────────
  async function deleteComment(id) {
    if (!window.confirm('Delete this comment permanently?')) return;
    try {
      await api.delete(`/admin/comments/${id}`);
      setItems(prev => prev.filter(s => s.id !== id));
      showToast('Comment deleted.');
    } catch (err) {
      showToast(err.message || 'Failed to delete.', true);
    }
  }

  // ── Derived lists ─────────────────────────────────────────────────────────
  const visible = items.filter(s => {
    if (filter === 'revision') return s.type === 'revision' && !s.resolved;
    if (filter === 'policy')   return s.type === 'policy'   && !s.resolved;
    if (filter === 'question') return s.type === 'question' && !s.resolved;
    if (filter === 'resolved') return s.resolved;
    return !s.resolved; // 'all' = pending
  });

  const counts = {
    all:      items.filter(s => !s.resolved).length,
    revision: items.filter(s => s.type === 'revision' && !s.resolved).length,
    policy:   items.filter(s => s.type === 'policy'   && !s.resolved).length,
    question: items.filter(s => s.type === 'question' && !s.resolved).length,
    resolved: items.filter(s => s.resolved).length,
  };

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.isError ? '#991B1B' : 'var(--g-dark)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: '.875rem', fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--g-primary)" />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.6rem', color: 'var(--g-dark)' }}>Student Suggestions</h2>
          <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', marginTop: 4 }}>Feedback submitted by verified PLSP students via authenticated accounts.</p>
        </div>
        <button onClick={fetchItems} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Info note */}
      <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <Info size={18} color="#1D4ED8" style={{ marginTop: 2, flexShrink: 0 }} />
        <span style={{ fontSize: '.82rem', color: '#1D4ED8', lineHeight: 1.6 }}>
          Suggestions are categorized as <strong>For Revision</strong>, <strong>Policy Suggestion</strong>, or <strong>Question</strong>. All data is live from the database — resolving persists across sessions.
        </span>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <AlertCircle size={18} color="#DC2626" />
          <span style={{ fontSize: '.875rem', color: '#991B1B' }}>{error}</span>
          <button onClick={fetchItems} style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all','All Pending'],['revision','For Revision'],['policy','Policy Suggestion'],['question','Questions'],['resolved','Resolved']].map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '7px 16px', borderRadius: 999, fontSize: '.8rem', fontWeight: 600, border: `1.5px solid ${filter === k ? 'var(--g-primary)' : 'var(--gray-mid)'}`, background: filter === k ? 'var(--g-primary)' : '#fff', color: filter === k ? '#fff' : 'var(--gray-t)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
            {label} ({counts[k] ?? 0})
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          [1,2,3].map(i => (
            <div key={i} style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 22 }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--gray-bg)', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 16, background: 'var(--gray-bg)', borderRadius: 4, width: '40%', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, background: 'var(--gray-bg)', borderRadius: 4, width: '80%', animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, background: 'var(--gray-bg)', borderRadius: 4, width: '65%', animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            </div>
          ))
        ) : visible.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ color: 'var(--gray-mid)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><MessageSquare size={48} /></div>
            <p style={{ color: 'var(--gray-t)', fontSize: '.875rem' }}>
              {items.length === 0 ? 'No student feedback yet. When students post comments on ordinances, they will appear here.' : 'No suggestions in this category.'}
            </p>
          </div>
        ) : visible.map(s => {
          const tc = TYPE_CONFIG[s.type] || TYPE_CONFIG.question;
          const initials = (s.user_name || s.userName || 'ST').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          const name     = s.user_name || s.userName || 'Unknown';
          const dept     = s.user_dept || s.userDept || '';
          const section  = s.ordinance_title || `Ordinance #${s.ordinance_id || s.ordinanceId}`;
          const date     = s.created_at || s.createdAt
            ? new Date(s.created_at || s.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
            : '';

          return (
            <div key={s.id} style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: 22, opacity: s.resolved ? 0.65 : 1, transition: 'opacity .2s' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                {/* Avatar */}
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--g-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.85rem', fontWeight: 700, color: 'var(--g-primary)', flexShrink: 0 }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--g-dark)' }}>{name}</span>
                    <span style={{ fontSize: '.72rem', color: 'var(--gray-t)' }}>·</span>
                    <span style={{ fontSize: '.78rem', color: 'var(--gray-t)' }}>{dept}</span>
                    <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', background: tc.bg, color: tc.color, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {tc.icon} {tc.label}
                    </span>
                    {s.resolved && (
                      <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, background: '#D1FAE5', color: '#065F46', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Check size={12} /> Resolved
                      </span>
                    )}
                    <span style={{ fontSize: '.72rem', color: 'var(--gray-t)', marginLeft: 'auto' }}>{date}</span>
                  </div>

                  {/* Re: section */}
                  <div style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--g-primary)', background: 'var(--g-pale)', display: 'inline-block', padding: '2px 9px', borderRadius: 6, marginBottom: 8 }}>
                    Re: {section}
                  </div>

                  {/* Body */}
                  <p style={{ fontSize: '.875rem', color: 'var(--gray-dk)', lineHeight: 1.65 }}>{s.body}</p>
                  {s.agrees?.length > 0 && (
                    <div style={{ fontSize: '.75rem', color: 'var(--gray-t)', marginTop: 8 }}>👍 {s.agrees.length} student{s.agrees.length !== 1 ? 's' : ''} agreed</div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4, flexShrink: 0 }}>
                  <button onClick={() => toggleResolve(s.id)} style={{ padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${s.resolved ? 'var(--gray-mid)' : '#C2E0CE'}`, background: s.resolved ? '#fff' : 'var(--g-pale)', color: s.resolved ? 'var(--gray-t)' : 'var(--g-primary)', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Check size={13} /> {s.resolved ? 'Reopen' : 'Mark Resolved'}
                  </button>
                  <button onClick={() => deleteComment(s.id)} style={{ padding: '7px 12px', borderRadius: 8, border: '1.5px solid #FECACA', background: '#FEF2F2', color: '#DC2626', fontWeight: 600, fontSize: '.78rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

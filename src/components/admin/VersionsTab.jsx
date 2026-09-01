import { useState, useEffect } from 'react';
import { api } from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { CheckCircle2, AlertTriangle, History, FilePlus, Check, RefreshCw, AlertCircle, X, Save } from 'lucide-react';

const EMPTY_FORM = { label: '', description: '', sections: '', releaseDate: new Date().toISOString().split('T')[0] };

export default function VersionsTab() {
  const { user }            = useAuth();
  const [versions, setVersions] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 4000);
  }

  async function fetchVersions() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/admin/versions');
      setVersions(data);
    } catch (err) {
      setError(err.message || 'Failed to load versions.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchVersions(); }, []);

  async function handleCreate() {
    if (!form.label.trim() || !form.releaseDate) {
      showToast('Label and Release Date are required.', true);
      return;
    }
    setSaving(true);
    try {
      const created = await api.post('/admin/versions', {
        label: form.label,
        description: form.description,
        sections: Number(form.sections) || 0,
        releaseDate: form.releaseDate,
      });
      // Backend sets all others to inactive and new one to active
      await fetchVersions();
      setShowModal(false);
      setForm(EMPTY_FORM);
      showToast(`${created.label} created and set as active.`);
    } catch (err) {
      showToast(err.message || 'Failed to create version.', true);
    } finally {
      setSaving(false);
    }
  }

  const activeVersion = versions.find(v => v.status === 'active');
  const nextLabel     = activeVersion
    ? (() => {
        const m = activeVersion.label.match(/(\d+)\.(\d+)/);
        if (m) return `Version ${Number(m[1])}.${Number(m[2]) + 1}`;
        return 'New Version';
      })()
    : 'Version 1.0';

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: toast.isError ? '#991B1B' : 'var(--g-dark)', color: '#fff', padding: '12px 20px', borderRadius: 10, fontSize: '.875rem', fontWeight: 500, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {toast.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} color="var(--g-primary)" />} {toast.msg}
        </div>
      )}

      {/* Create version modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 480, width: '90%', boxShadow: '0 12px 40px rgba(0,0,0,.2)', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', right: 20, top: 20, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--gray-t)' }}><X size={20} /></button>
            <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.2rem', color: 'var(--g-dark)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
              <FilePlus size={20} color="var(--g-primary)" /> Create New Version
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                ['Version Label', 'label',       'text',   nextLabel, ''],
                ['Release Date',  'releaseDate',  'date',   '',        ''],
                ['Section Count', 'sections',     'number', '0',       ''],
              ].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={ph} style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', display: 'block', marginBottom: 5 }}>Changelog / Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe what changed in this version…" style={{ width: '100%', padding: '9px 12px', border: '1.5px solid var(--gray-mid)', borderRadius: 8, fontSize: '.875rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ background: '#FEF9E7', border: '1.5px solid #FDE68A', borderRadius: 10, padding: '10px 14px', marginTop: 16, fontSize: '.8rem', color: '#92400E' }}>
              ⚠️ Creating a new version will automatically set all other versions to <strong>inactive</strong>.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-dk)', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleCreate} disabled={saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--g-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
                {saving ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                {saving ? 'Saving…' : 'Create Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.6rem', color: 'var(--g-dark)' }}>Version Control</h2>
          <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', marginTop: 4 }}>Only one version of the handbook can be active at a time. Inactive versions are preserved for records.</p>
        </div>
        <button onClick={fetchVersions} title="Refresh" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: '1.5px solid var(--gray-mid)', background: '#fff', color: 'var(--gray-t)', fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>
      </div>

      {/* Warning */}
      <div style={{ background: '#FEF9E7', border: '1.5px solid #FDE68A', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <AlertTriangle size={20} color="#D4A82A" style={{ marginTop: 2, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: '.875rem', fontWeight: 700, color: '#92400E', marginBottom: 3 }}>Important — Ordinances Cannot Be Deleted</div>
          <div style={{ fontSize: '.82rem', color: '#92400E', lineHeight: 1.6 }}>
            Per institutional policy, ordinances are permanent records. You may deactivate or archive a version, but every provision of the original text is preserved. Only the active version is visible to students.
          </div>
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 18px', marginBottom: 18, display: 'flex', gap: 12, alignItems: 'center' }}>
          <AlertCircle size={18} color="#DC2626" />
          <span style={{ fontSize: '.875rem', color: '#991B1B' }}>{error}</span>
          <button onClick={fetchVersions} style={{ marginLeft: 'auto', fontSize: '.78rem', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Retry</button>
        </div>
      )}

      {/* Version cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
        {loading ? (
          [1, 2].map(i => (
            <div key={i} style={{ background: '#fff', border: '2px solid var(--gray-mid)', borderRadius: 14, padding: 24 }}>
              <div style={{ display: 'flex', gap: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--gray-bg)', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ height: 20, width: '30%', background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, width: '70%', background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                  <div style={{ height: 14, width: '50%', background: 'var(--gray-bg)', borderRadius: 4, animation: 'pulse 1.5s infinite' }} />
                </div>
              </div>
            </div>
          ))
        ) : versions.length === 0 ? (
          <div style={{ background: '#fff', border: '1.5px solid var(--gray-mid)', borderRadius: 14, padding: '40px 24px', textAlign: 'center', color: 'var(--gray-t)', fontSize: '.875rem' }}>
            No versions found. Create the first version using the button below.
          </div>
        ) : versions.map(v => {
          const active = v.status === 'active';
          return (
            <div key={v.id} style={{ background: '#fff', border: `2px solid ${active ? 'var(--g-primary)' : 'var(--gray-mid)'}`, borderRadius: 14, padding: 24, position: 'relative', transition: 'border .2s' }}>
              {active && (
                <div style={{ position: 'absolute', top: 18, right: 18, background: 'var(--g-pale)', border: '1.5px solid var(--g-primary)', color: 'var(--g-primary)', padding: '4px 12px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Check size={14} /> Active — Student-Facing
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: active ? 'var(--g-pale)' : 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? 'var(--g-primary)' : 'var(--gray-t)', flexShrink: 0 }}>
                  <History size={26} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 5 }}>
                    <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.15rem', color: 'var(--g-dark)' }}>{v.label}</h3>
                    <span style={{ fontSize: '.72rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: active ? '#D1FAE5' : '#F3F4F6', color: active ? '#065F46' : '#6B7280', textTransform: 'uppercase', letterSpacing: '.05em' }}>{v.status}</span>
                  </div>
                  <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', lineHeight: 1.65, marginBottom: 12 }}>{v.description}</p>
                  <div style={{ display: 'flex', gap: 20, fontSize: '.78rem', color: 'var(--gray-t)', flexWrap: 'wrap' }}>
                    <span>📅 Released: <strong style={{ color: 'var(--gray-dk)' }}>{v.release_date || v.releaseDate}</strong></span>
                    <span>📋 Sections: <strong style={{ color: 'var(--gray-dk)' }}>{v.sections}</strong></span>
                    <span>👤 Prepared by: <strong style={{ color: 'var(--gray-dk)' }}>{v.edited_by || v.editedBy}</strong></span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create new version */}
      <div style={{ background: '#fff', border: '1.5px dashed var(--gray-mid)', borderRadius: 14, padding: 28, textAlign: 'center' }}>
        <div style={{ color: 'var(--gray-mid)', marginBottom: 12, display: 'flex', justifyContent: 'center' }}><FilePlus size={40} /></div>
        <h3 style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.1rem', color: 'var(--g-dark)', marginBottom: 6 }}>Create {nextLabel}</h3>
        <p style={{ fontSize: '.875rem', color: 'var(--gray-t)', marginBottom: 18, maxWidth: 380, margin: '0 auto 18px' }}>
          When the Board of Regents approves a new handbook, create a new version here. The old version will be automatically archived.
        </p>
        <button onClick={() => { setForm({ ...EMPTY_FORM, label: nextLabel }); setShowModal(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 22px', borderRadius: 8, border: '1.5px solid var(--g-primary)', background: 'var(--g-pale)', color: 'var(--g-primary)', fontWeight: 700, fontSize: '.875rem', cursor: 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif' }}>
          + Create {nextLabel}
        </button>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

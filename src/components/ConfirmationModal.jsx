import { useEffect } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Database,
  Upload,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';

/**
 * Reusable ConfirmationModal Component
 *
 * Props:
 * - isOpen: boolean
 * - type: 'confirm' | 'danger' | 'approve' | 'import' | 'upload' | 'success' | 'error' | 'info'
 * - title: string
 * - message: string | ReactNode
 * - policyCount?: number | null
 * - policyPreview?: Array<{ ref?: string, title: string }> | ReactNode
 * - details?: ReactNode (warning banner, version info, etc.)
 * - confirmText?: string (defaults based on type)
 * - cancelText?: string (default 'Cancel')
 * - onConfirm?: () => void | Promise<void>
 * - onCancel?: () => void
 * - loading?: boolean
 * - isResult?: boolean (renders in result mode with single primary dismiss button)
 * - explicitWarning?: string | ReactNode (highlighted red/amber alert box)
 */
export default function ConfirmationModal({
  isOpen,
  type = 'confirm',
  title,
  message,
  policyCount = null,
  policyPreview = null,
  details = null,
  confirmText,
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  isResult = false,
  explicitWarning = null,
}) {
  // Close on Escape key if not currently loading
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e) {
      if (e.key === 'Escape' && !loading) {
        onCancel?.();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  // Configuration map for styles & icons based on type
  const typeConfig = {
    danger: {
      icon: <AlertTriangle size={28} color="#DC2626" />,
      iconBg: '#FEE2E2',
      confirmBg: '#DC2626',
      confirmHover: '#B91C1C',
      confirmText: confirmText || 'Delete Policy',
      accentColor: '#DC2626',
    },
    approve: {
      icon: <CheckCircle2 size={28} color="#059669" />,
      iconBg: '#D1FAE5',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Approve Policy',
      accentColor: '#059669',
    },
    import: {
      icon: <Database size={28} color="var(--gold-d, #B48608)" />,
      iconBg: 'rgba(244, 197, 66, 0.2)',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Import to Database',
      accentColor: 'var(--gold-d, #B48608)',
    },
    upload: {
      icon: <Upload size={28} color="var(--g-primary, #0F4F2C)" />,
      iconBg: 'var(--g-pale, rgba(15, 79, 44, 0.1))',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Begin Ingestion',
      accentColor: 'var(--g-primary, #0F4F2C)',
    },
    success: {
      icon: <CheckCircle2 size={32} color="#059669" />,
      iconBg: '#D1FAE5',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Dismiss',
      accentColor: '#059669',
    },
    error: {
      icon: <AlertCircle size={32} color="#DC2626" />,
      iconBg: '#FEE2E2',
      confirmBg: '#DC2626',
      confirmHover: '#B91C1C',
      confirmText: confirmText || 'Dismiss',
      accentColor: '#DC2626',
    },
    info: {
      icon: <Sparkles size={28} color="var(--g-primary, #0F4F2C)" />,
      iconBg: 'var(--g-pale, rgba(15, 79, 44, 0.1))',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Confirm',
      accentColor: 'var(--g-primary, #0F4F2C)',
    },
    confirm: {
      icon: <ShieldCheck size={28} color="var(--g-primary, #0F4F2C)" />,
      iconBg: 'var(--g-pale, rgba(15, 79, 44, 0.1))',
      confirmBg: 'var(--g-primary, #0F4F2C)',
      confirmHover: 'var(--g-dark, #082F1A)',
      confirmText: confirmText || 'Confirm & Save',
      accentColor: 'var(--g-primary, #0F4F2C)',
    },
  };

  const cfg = typeConfig[type] || typeConfig.confirm;
  const isDanger = type === 'danger';
  const showCancel = !isResult && typeof onCancel === 'function';

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'modalFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel?.();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 20,
          maxWidth: 540,
          width: '100%',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.35)',
          padding: '28px 28px 24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          boxSizing: 'border-box',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: isDanger ? '1.5px solid #FCA5A5' : '1px solid rgba(0,0,0,0.06)',
          animation: 'modalScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Close button (top right) */}
        {!loading && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close modal"
            style={{
              position: 'absolute',
              top: 18,
              right: 18,
              background: 'none',
              border: 'none',
              color: 'var(--gray-t, #64748B)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#F1F5F9')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <X size={18} />
          </button>
        )}

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 14 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: cfg.iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {cfg.icon}
          </div>

          <div style={{ flex: 1, paddingTop: 4 }}>
            <h3
              style={{
                fontFamily: '"DM Serif Display", serif',
                fontSize: '1.4rem',
                color: isDanger ? '#991B1B' : 'var(--g-dark, #082F1A)',
                margin: 0,
                lineHeight: 1.25,
              }}
            >
              {title}
            </h3>

            {/* Affected policy count indicator */}
            {policyCount !== null && policyCount !== undefined && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '3px 10px',
                    borderRadius: 999,
                    fontSize: '.75rem',
                    fontWeight: 800,
                    backgroundColor: isDanger ? '#FEE2E2' : 'rgba(15, 79, 44, 0.1)',
                    color: isDanger ? '#DC2626' : 'var(--g-primary, #0F4F2C)',
                    letterSpacing: '.03em',
                  }}
                >
                  <FileText size={12} />
                  Affected Policies: {policyCount}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Message / Description */}
        {message && (
          <div
            style={{
              fontSize: '.9rem',
              color: 'var(--gray-dk, #1E293B)',
              lineHeight: 1.6,
              marginBottom: 16,
            }}
          >
            {message}
          </div>
        )}

        {/* Policy Preview Summary (if list provided) */}
        {Array.isArray(policyPreview) && policyPreview.length > 0 && (
          <div
            style={{
              background: 'var(--gray-bg, #F8FAFC)',
              border: '1px solid var(--gray-mid, #E2E8F0)',
              borderRadius: 12,
              padding: '10px 14px',
              marginBottom: 16,
              maxHeight: 140,
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                fontSize: '.72rem',
                fontWeight: 800,
                color: 'var(--gray-t, #64748B)',
                textTransform: 'uppercase',
                letterSpacing: '.06em',
                marginBottom: 6,
              }}
            >
              Policy Scope ({policyPreview.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {policyPreview.slice(0, 5).map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    fontSize: '.82rem',
                    color: 'var(--gray-dk, #1E293B)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: 'var(--g-primary, #0F4F2C)',
                      fontFamily: 'monospace',
                      fontSize: '.78rem',
                    }}
                  >
                    {p.ref || `#${idx + 1}`}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title}
                  </span>
                </div>
              ))}
              {policyPreview.length > 5 && (
                <div style={{ fontSize: '.75rem', color: 'var(--gray-t, #64748B)', fontStyle: 'italic', paddingTop: 2 }}>
                  + and {policyPreview.length - 5} more policies
                </div>
              )}
            </div>
          </div>
        )}

        {/* Non-array policy preview node */}
        {!Array.isArray(policyPreview) && policyPreview && (
          <div style={{ marginBottom: 16 }}>{policyPreview}</div>
        )}

        {/* Explicit Warning Callout Box (for DB import or deletion) */}
        {explicitWarning && (
          <div
            style={{
              backgroundColor: isDanger ? '#FEF2F2' : '#FEF9E7',
              border: `1.5px solid ${isDanger ? '#FECACA' : '#FDE68A'}`,
              borderRadius: 12,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <AlertTriangle
              size={18}
              color={isDanger ? '#DC2626' : '#B45309'}
              style={{ flexShrink: 0, marginTop: 2 }}
            />
            <div
              style={{
                fontSize: '.82rem',
                color: isDanger ? '#991B1B' : '#92400E',
                lineHeight: 1.5,
              }}
            >
              {explicitWarning}
            </div>
          </div>
        )}

        {/* Optional Extra Details */}
        {details && <div style={{ marginBottom: 16 }}>{details}</div>}

        {/* Actions Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            paddingTop: 12,
            borderTop: '1px solid var(--gray-mid, #E2E8F0)',
          }}
        >
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              style={{
                padding: '10px 18px',
                borderRadius: 10,
                border: '1.5px solid var(--gray-mid, #E2E8F0)',
                backgroundColor: '#ffffff',
                color: 'var(--gray-dk, #1E293B)',
                fontWeight: 600,
                fontSize: '.875rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#F8FAFC';
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = '#ffffff';
              }}
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: isResult ? '11px 26px' : '10px 22px',
              borderRadius: 10,
              backgroundColor: cfg.confirmBg,
              color: '#ffffff',
              border: 'none',
              fontWeight: 800,
              fontSize: '.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              boxShadow: isDanger
                ? '0 4px 14px rgba(220, 38, 38, 0.25)'
                : '0 4px 14px rgba(15, 79, 44, 0.25)',
              opacity: loading ? 0.75 : 1,
              transition: 'all 0.15s ease',
              minWidth: isResult ? 120 : 130,
            }}
            onMouseEnter={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = cfg.confirmHover;
            }}
            onMouseLeave={(e) => {
              if (!loading) e.currentTarget.style.backgroundColor = cfg.confirmBg;
            }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                <span>Processing…</span>
              </>
            ) : (
              cfg.confirmText
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(6px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../hooks/useApi';
import { Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, Mail, Hash } from 'lucide-react';
import logo from '../assets/logo.png';

// ── Client-side validators ────────────────────────────────────────────────────
function validate({ studentId, email, password, confirmPassword }) {
  if (!studentId.trim()) return { field: 'studentId', msg: 'Student Number is required.' };
  if (!email.trim()) return { field: 'email', msg: 'University / official email is required.' };
  
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email.trim())) {
    return { field: 'email', msg: 'Please enter a valid email address.' };
  }

  if (!password) return { field: 'password', msg: 'Password is required.' };
  if (password.length < 8) return { field: 'password', msg: 'Password must be at least 8 characters.' };
  if (password !== confirmPassword)
    return { field: 'confirmPassword', msg: 'Passwords do not match.' };
  return null;
}

// ── Shared input style factory ────────────────────────────────────────────────
function inputStyle(hasError) {
  return {
    width: '100%',
    padding: '11px 14px 11px 40px',
    border: `1.5px solid ${hasError ? '#FCA5A5' : 'var(--gray-mid)'}`,
    borderRadius: 10,
    fontSize: '.925rem',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    outline: 'none',
    color: 'var(--gray-dk)',
    background: '#fff',
    transition: 'border .2s, box-shadow .2s',
  };
}

function labelStyle() {
  return {
    display: 'block',
    fontSize: '.78rem',
    fontWeight: 700,
    color: 'var(--gray-t)',
    textTransform: 'uppercase',
    letterSpacing: '.07em',
    marginBottom: 7,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    studentId: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [fieldError, setFieldError] = useState({});   // per-field error highlight
  const [error, setError] = useState('');             // general error banner
  const [success, setSuccess] = useState('');         // success banner
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCpw, setShowCpw] = useState(false);

  function set(key, val) {
    setForm(f => ({ ...f, [key]: val }));
    // Clear per-field error as user types
    if (fieldError[key]) setFieldError(e => ({ ...e, [key]: false }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validation first
    const vErr = validate(form);
    if (vErr) {
      setFieldError({ [vErr.field]: true });
      setError(vErr.msg);
      return;
    }

    setLoading(true);
    try {
      const data = await api.post('/auth/register', {
        studentId: form.studentId.trim(),
        email: form.email.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
      });

      setLoading(false);
      setSuccess(data.message || 'Account created successfully! Redirecting to login…');

      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login', { replace: true }), 2000);

    } catch (err) {
      setLoading(false);
      const msg = err.message || 'Registration failed. Please verify your credentials and try again.';

      // Map server errors back to per-field highlights
      const lower = msg.toLowerCase();
      if (lower.includes('student number') || lower.includes('student id') || lower.includes('student record')) {
        setFieldError(f => ({ ...f, studentId: true }));
      }
      if (lower.includes('email')) {
        setFieldError(f => ({ ...f, email: true }));
      }
      if (lower.includes('password')) {
        setFieldError(f => ({ ...f, password: true }));
      }

      setError(msg);
    }
  }

  const focusStyle = { borderColor: 'var(--g-primary)', boxShadow: '0 0 0 3px rgba(15, 79, 44, 0.08)' };

  return (
    <div style={{ minHeight: 'calc(100vh - 70px)', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid var(--gray-mid)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

          {/* Top banner */}
          <div style={{ background: 'linear-gradient(135deg, var(--g-deep) 0%, var(--g-primary) 100%)', padding: '28px 32px 24px', textAlign: 'center' }}>
            <img src={logo} alt="Plawminary logo" style={{ height: 68, width: 68, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.35rem', color: '#fff', letterSpacing: '.02em' }}>PLAWMINARY</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.65)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>Student Portal Registration</div>
          </div>

          {/* Master list notice badge */}
          <div style={{ background: 'var(--g-pale)', borderBottom: '1px solid rgba(15, 79, 44, 0.1)', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <ShieldCheck size={16} color="var(--g-primary)" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '.76rem', color: 'var(--g-dark)', fontWeight: 600, lineHeight: 1.4 }}>
              <strong>Master List Authentication:</strong> Only students on the authorized roster uploaded by university admins can register.
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ padding: '24px 30px 32px' }}>

            {/* Success banner */}
            {success && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: '.84rem', color: '#166534', display: 'flex', gap: 10, alignItems: 'center' }}>
                <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
                <span>{success}</span>
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '12px 14px', marginBottom: 18, fontSize: '.84rem', color: '#DC2626', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ lineHeight: 1.45 }}>{error}</div>
              </div>
            )}

            {/* Student Number */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-studentId" style={labelStyle()}>Student Number *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Hash size={16} />
                </span>
                <input
                  id="reg-studentId"
                  type="text"
                  value={form.studentId}
                  onChange={e => set('studentId', e.target.value)}
                  placeholder="e.g. 2026-0001"
                  autoComplete="username"
                  style={inputStyle(fieldError.studentId)}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => {
                    e.target.style.borderColor = fieldError.studentId ? '#FCA5A5' : 'var(--gray-mid)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <span style={{ fontSize: '.7rem', color: 'var(--gray-t)', marginTop: 4, display: 'block' }}>
                Must match your official university student ID.
              </span>
            </div>

            {/* University Email */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-email" style={labelStyle()}>Official / University Email *</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-t)', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <Mail size={16} />
                </span>
                <input
                  id="reg-email"
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="e.g. student@plsp.edu.ph"
                  autoComplete="email"
                  style={inputStyle(fieldError.email)}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => {
                    e.target.style.borderColor = fieldError.email ? '#FCA5A5' : 'var(--gray-mid)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
              <span style={{ fontSize: '.7rem', color: 'var(--gray-t)', marginTop: 4, display: 'block' }}>
                Must match the email registered in the master list.
              </span>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-password" style={labelStyle()}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  style={{ ...inputStyle(fieldError.password), paddingLeft: 14, paddingRight: 44 }}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => {
                    e.target.style.borderColor = fieldError.password ? '#FCA5A5' : 'var(--gray-mid)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-t)' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 10 }}>
              <label htmlFor="reg-confirm" style={labelStyle()}>Confirm Password *</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-confirm"
                  type={showCpw ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  style={{ ...inputStyle(fieldError.confirmPassword), paddingLeft: 14, paddingRight: 44 }}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => {
                    e.target.style.borderColor = fieldError.confirmPassword ? '#FCA5A5' : 'var(--gray-mid)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button type="button" onClick={() => setShowCpw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-t)' }}>
                  {showCpw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              id="reg-submit"
              type="submit"
              disabled={loading || !!success}
              style={{
                width: '100%', marginTop: 20, padding: '13px',
                borderRadius: 10,
                background: (loading || success) ? 'var(--g-light)' : 'var(--g-primary)',
                color: '#fff', fontWeight: 700, fontSize: '.95rem',
                border: 'none', cursor: (loading || success) ? 'not-allowed' : 'pointer',
                fontFamily: '"Plus Jakarta Sans", sans-serif',
                transition: 'background .2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 4px 14px rgba(15, 79, 44, 0.2)',
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                  Verifying Master Record…
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={18} /> Redirecting to login…
                </>
              ) : (
                <>
                  Verify & Register Account <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Link to login */}
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.82rem', color: 'var(--gray-t)' }}>
              Already registered in the portal?{' '}
              <Link to="/login" style={{ color: 'var(--g-primary)', fontWeight: 700, textDecoration: 'none' }}>
                Sign in here →
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../hooks/useApi';
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, ChevronDown } from 'lucide-react';
import { DEPARTMENTS } from '../data/departments';
import logo from '../assets/logo.png';

// ── Client-side validators ────────────────────────────────────────────────────
const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate({ studentId, fullName, dept, email, password, confirmPassword }) {
  if (!studentId.trim())    return { field: 'studentId',      msg: 'Student ID is required.' };
  if (!fullName.trim())     return { field: 'fullName',       msg: 'Full name is required.' };
  if (!dept || !dept.trim()) return { field: 'dept',           msg: 'Please select your college / department.' };
  if (!email.trim())        return { field: 'email',          msg: 'Email is required.' };
  if (!EMAIL_RX.test(email.trim()))
                            return { field: 'email',          msg: 'Please enter a valid email address.' };
  if (!password)            return { field: 'password',       msg: 'Password is required.' };
  if (password.length < 8)  return { field: 'password',       msg: 'Password must be at least 8 characters.' };
  if (password !== confirmPassword)
                            return { field: 'confirmPassword', msg: 'Passwords do not match.' };
  return null;
}

// ── Shared input style factory ────────────────────────────────────────────────
function inputStyle(hasError) {
  return {
    width: '100%',
    padding: '11px 14px',
    border: `1.5px solid ${hasError ? '#FCA5A5' : 'var(--gray-mid)'}`,
    borderRadius: 10,
    fontSize: '.925rem',
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    outline: 'none',
    color: 'var(--gray-dk)',
    background: '#fff',
    transition: 'border .2s',
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
    studentId: '', fullName: '', dept: '', email: '', password: '', confirmPassword: '',
  });
  const [fieldError, setFieldError] = useState({});   // per-field error highlight
  const [error, setError]   = useState('');           // general error banner
  const [success, setSuccess] = useState('');         // success banner
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
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
        studentId:       form.studentId.trim(),
        fullName:        form.fullName.trim(),
        dept:            form.dept.trim(),
        email:           form.email.trim().toLowerCase(),
        password:        form.password,
        confirmPassword: form.confirmPassword,
      });

      setLoading(false);
      setSuccess(data.message || 'Account created! Redirecting to login…');

      // Redirect to login after 2 seconds
      setTimeout(() => navigate('/login', { replace: true }), 2000);

    } catch (err) {
      setLoading(false);
      const msg = err.message || 'Registration failed. Please try again.';

      // Map server errors back to per-field highlights
      if (msg.toLowerCase().includes('student id')) {
        setFieldError({ studentId: true });
      } else if (msg.toLowerCase().includes('email')) {
        setFieldError({ email: true });
      } else if (msg.toLowerCase().includes('college') || msg.toLowerCase().includes('department')) {
        setFieldError({ dept: true });
      }

      setError(msg);
    }
  }

  const focusStyle = { borderColor: 'var(--g-primary)' };

  return (
    <div style={{ minHeight: 'calc(100vh - 70px)', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid var(--gray-mid)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

          {/* Top banner — identical to LoginPage */}
          <div style={{ background: 'linear-gradient(135deg, var(--g-deep) 0%, var(--g-primary) 100%)', padding: '28px 32px 24px', textAlign: 'center' }}>
            <img src={logo} alt="Plawminary logo" style={{ height: 72, width: 72, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: '#fff', letterSpacing: '.02em' }}>PLAWMINARY</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>PLSP Student Handbook</div>
          </div>

          {/* Badge row */}
          <div style={{ background: 'var(--gray-bg)', borderBottom: '1px solid var(--gray-mid)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={14} color="var(--gold-d)" />
            <span style={{ fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 600 }}>Create your student account</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate style={{ padding: '24px 32px 32px' }}>

            {/* Success banner */}
            {success && (
              <div style={{ background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '12px 14px', marginBottom: 18, fontSize: '.82rem', color: '#166534', display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                {success}
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: '.82rem', color: '#DC2626', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* Student ID */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-studentId" style={labelStyle()}>Student ID</label>
              <input
                id="reg-studentId"
                type="text"
                value={form.studentId}
                onChange={e => set('studentId', e.target.value)}
                placeholder="e.g. 2023-0001"
                autoComplete="username"
                style={inputStyle(fieldError.studentId)}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => { e.target.style.borderColor = fieldError.studentId ? '#FCA5A5' : 'var(--gray-mid)'; }}
              />
            </div>

            {/* Full Name */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-fullName" style={labelStyle()}>Full Name</label>
              <input
                id="reg-fullName"
                type="text"
                value={form.fullName}
                onChange={e => set('fullName', e.target.value)}
                placeholder="Juan dela Cruz"
                autoComplete="name"
                style={inputStyle(fieldError.fullName)}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => { e.target.style.borderColor = fieldError.fullName ? '#FCA5A5' : 'var(--gray-mid)'; }}
              />
            </div>

            {/* College / Department */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-dept" style={labelStyle()}>College / Department</label>
              <div style={{ position: 'relative' }}>
                <select
                  id="reg-dept"
                  value={form.dept}
                  onChange={e => set('dept', e.target.value)}
                  style={{
                    ...inputStyle(fieldError.dept),
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    MozAppearance: 'none',
                    paddingRight: 40,
                    cursor: 'pointer',
                    color: form.dept ? 'var(--gray-dk)' : '#9CA3AF',
                  }}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => { e.target.style.borderColor = fieldError.dept ? '#FCA5A5' : 'var(--gray-mid)'; }}
                >
                  <option value="" disabled>-- Select College / Department --</option>
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d} style={{ color: 'var(--gray-dk)' }}>{d}</option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--gray-t)', display: 'flex', alignItems: 'center' }}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-email" style={labelStyle()}>Email</label>
              <input
                id="reg-email"
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="student@plsp.edu.ph"
                autoComplete="email"
                style={inputStyle(fieldError.email)}
                onFocus={e => Object.assign(e.target.style, focusStyle)}
                onBlur={e => { e.target.style.borderColor = fieldError.email ? '#FCA5A5' : 'var(--gray-mid)'; }}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="reg-password" style={labelStyle()}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  style={{ ...inputStyle(fieldError.password), paddingRight: 44 }}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => { e.target.style.borderColor = fieldError.password ? '#FCA5A5' : 'var(--gray-mid)'; }}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-t)' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 8 }}>
              <label htmlFor="reg-confirm" style={labelStyle()}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reg-confirm"
                  type={showCpw ? 'text' : 'password'}
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  style={{ ...inputStyle(fieldError.confirmPassword), paddingRight: 44 }}
                  onFocus={e => Object.assign(e.target.style, focusStyle)}
                  onBlur={e => { e.target.style.borderColor = fieldError.confirmPassword ? '#FCA5A5' : 'var(--gray-mid)'; }}
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
              }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                  Creating account…
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={18} /> Redirecting to login…
                </>
              ) : (
                <>
                  Create Account <ArrowRight size={18} />
                </>
              )}
            </button>

            {/* Link to login */}
            <p style={{ textAlign: 'center', marginTop: 20, fontSize: '.82rem', color: 'var(--gray-t)' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'var(--g-primary)', fontWeight: 700, textDecoration: 'none' }}>
                Sign in →
              </Link>
            </p>

          </form>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

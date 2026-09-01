import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Sparkles, Eye, EyeOff, AlertCircle, ArrowRight, UserPlus } from 'lucide-react';
import logo from '../assets/logo.png';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/handbook';

  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    }
  }, [user, navigate, from]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!studentId.trim() || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const result = await login(studentId, password);
      setLoading(false);
      if (result.success) {
        if (result.user?.role === 'admin') {
          navigate('/admin', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      } else {
        setError(result.error || 'Invalid ID or password. Please try again.');
      }
    } catch (err) {
      setLoading(false);
      setError(err?.message || 'Login failed. Please try again.');
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 70px)', background: 'var(--gray-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: 20, border: '1.5px solid var(--gray-mid)', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,.08)' }}>

          {/* Top banner */}
          <div style={{ background: 'linear-gradient(135deg, var(--g-deep) 0%, var(--g-primary) 100%)', padding: '28px 32px 24px', textAlign: 'center' }}>
            <img src={logo} alt="Plawminary logo" style={{ height: 72, width: 72, objectFit: 'contain', margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: '1.4rem', color: '#fff', letterSpacing: '.02em' }}>PLAWMINARY</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 3 }}>PLSP Student Handbook</div>
          </div>

          {/* Welcome badge */}
          <div style={{ background: 'var(--gray-bg)', borderBottom: '1px solid var(--gray-mid)', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={14} color="var(--gold-d)" />
            <span style={{ fontSize: '.78rem', color: 'var(--gray-t)', fontWeight: 600 }}>Sign in to your account</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ padding: '28px 32px 32px' }}>
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
                ID Number
              </label>
              <input
                type="text"
                value={studentId}
                onChange={e => setStudentId(e.target.value)}
                placeholder="e.g. 2023-0001"
                autoComplete="username"
                style={{ width: '100%', padding: '11px 14px', border: `1.5px solid ${error ? '#FCA5A5' : 'var(--gray-mid)'}`, borderRadius: 10, fontSize: '.925rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', transition: 'border .2s', background: '#fff' }}
                onFocus={e => e.target.style.borderColor = 'var(--g-primary)'}
                onBlur={e => e.target.style.borderColor = error ? '#FCA5A5' : 'var(--gray-mid)'}
              />
            </div>

            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: '.78rem', fontWeight: 700, color: 'var(--gray-t)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 7 }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  style={{ width: '100%', padding: '11px 44px 11px 14px', border: `1.5px solid ${error ? '#FCA5A5' : 'var(--gray-mid)'}`, borderRadius: 10, fontSize: '.925rem', fontFamily: '"Plus Jakarta Sans",sans-serif', outline: 'none', color: 'var(--gray-dk)', background: '#fff' }}
                  onFocus={e => e.target.style.borderColor = 'var(--g-primary)'}
                  onBlur={e => e.target.style.borderColor = error ? '#FCA5A5' : 'var(--gray-mid)'}
                />
                <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--gray-t)' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '.82rem', color: '#DC2626', display: 'flex', gap: 8, alignItems: 'center' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ width: '100%', padding: '13px', borderRadius: 10, background: loading ? 'var(--g-light)' : 'var(--g-primary)', color: '#fff', fontWeight: 700, fontSize: '.95rem', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: '"Plus Jakarta Sans",sans-serif', marginTop: error ? 0 : 16, transition: 'background .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
            >
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Sign In <ArrowRight size={18} />
                </>
              )}
            </button>


          </form>

          {/* Register button */}
          <div style={{ borderTop: '1px solid var(--gray-mid)', padding: '20px 32px', textAlign: 'center', background: '#FAFAFA' }}>
            <Link
              to="/register"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justify: 'center',
                gap: 8,
                width: '100%',
                padding: '12px 20px',
                borderRadius: 10,
                border: '1.5px solid var(--g-primary)',
                background: 'var(--g-pale)',
                color: 'var(--g-dark)',
                fontWeight: 700,
                fontSize: '.925rem',
                textDecoration: 'none',
                transition: 'var(--tr)',
                boxShadow: '0 2px 8px rgba(31, 111, 61, 0.08)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--g-primary)';
                e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--g-pale)';
                e.currentTarget.style.color = 'var(--g-dark)';
              }}
            >
              <UserPlus size={18} /> Create Account
            </Link>
          </div>

        </div>
      </div>


      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

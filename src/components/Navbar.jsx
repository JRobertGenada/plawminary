import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Home, FileText, Book, Settings, LogIn, LogOut, Menu, X, Bookmark } from 'lucide-react';
import logo from '../assets/logo.png';
import { getOfflineSummary, subscribeOfflineChanges } from '../utils/offlineStorage';

export default function Navbar() {
  const { pathname } = useLocation();
  const { user, isLoggedIn, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Track offline saved count
  useEffect(() => {
    let cancelled = false;
    getOfflineSummary().then(res => {
      if (!cancelled) setSavedCount(res.totalItems);
    });

    const unsub = subscribeOfflineChanges(() => {
      getOfflineSummary().then(res => {
        if (!cancelled) setSavedCount(res.totalItems);
      });
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Prevent background scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  function handleLogout() {
    logout();
    setMobileMenuOpen(false);
    navigate('/');
  }

  const links = [
    { to: '/', label: 'Home', icon: <Home size={18} /> },
    { to: '/ordinances', label: 'Ordinance Finder', icon: <FileText size={18} /> },
    { to: '/handbook', label: 'Handbook', icon: <Book size={18} /> },
    { to: '/saved', label: 'Saved', icon: <Bookmark size={18} />, badge: savedCount > 0 ? savedCount : null },
  ];

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'var(--g-dark)',
      boxShadow: '0 4px 20px rgba(0,0,0,.3)',
      height: 70,
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid rgba(255,255,255,0.08)'
    }}>
      <div style={{ width: '100%', maxWidth: 1280, margin: '0 auto', padding: '0 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Brand */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', zIndex: 1001 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={logo} alt="Logo" style={{ height: 38, width: 38, objectFit: 'contain' }} />
              <div style={{ position: 'absolute', inset: -3, border: '1px solid rgba(244,197,66,.3)', borderRadius: '50%' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: '#fff', fontFamily: '"DM Serif Display",serif', fontSize: '1.25rem', lineHeight: 1, letterSpacing: '.02em' }}>
                PLAWMINARY
              </span>
              <span style={{ fontSize: '.58rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2, opacity: 0.85 }}>
                PLSP Ordinance Finder
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex" style={{ alignItems: 'center', gap: 8 }}>
            <ul style={{ display: 'flex', alignItems: 'center', gap: 4, listStyle: 'none', margin: 0, padding: 0 }}>
              {links.map(({ to, label, icon, badge }) => {
                const isActive = pathname === to;
                return (
                  <li key={to}>
                    <Link
                      to={to}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        color: isActive ? 'var(--gold)' : 'rgba(255,255,255,.8)',
                        fontSize: '.85rem',
                        fontWeight: 600,
                        padding: '8px 14px',
                        borderRadius: 10,
                        textDecoration: 'none',
                        transition: 'all .2s ease',
                        background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                      }}
                    >
                      {icon}
                      <span>{label}</span>
                      {badge != null && (
                        <span style={{
                          background: 'var(--gold)',
                          color: 'var(--g-dark)',
                          fontSize: '.68rem',
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 999,
                          lineHeight: 1.2
                        }}>
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}

              {isAdmin && (
                <>
                  <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)', margin: '0 8px' }} />
                  <li>
                    <Link to="/admin" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: pathname === '/admin' ? 'var(--gold)' : 'rgba(255,255,255,.7)',
                      fontSize: '.85rem',
                      fontWeight: 600,
                      padding: '8px 14px',
                      borderRadius: 10,
                      textDecoration: 'none',
                      border: '1px solid rgba(244,197,66,0.2)',
                      background: pathname === '/admin' ? 'rgba(244,197,66,0.1)' : 'transparent'
                    }}>
                      <Settings size={18} />
                      Admin
                    </Link>
                  </li>
                </>
              )}
            </ul>

            {/* Desktop User Profile / Auth */}
            <div style={{ marginLeft: 12 }}>
              {isLoggedIn ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.2)', padding: '4px 6px 4px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '.75rem', color: '#fff', fontWeight: 700 }}>{user.name.split(' ')[0]}</div>
                    <div style={{ fontSize: '.6rem', color: 'rgba(255,255,255,.5)', fontWeight: 500 }}>{user.dept}</div>
                  </div>
                  <button onClick={handleLogout} style={{ background: 'var(--gold)', color: 'var(--g-dark)', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: '.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <LogOut size={14} />
                    Exit
                  </button>
                </div>
              ) : (
                <Link to="/login" style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 12,
                  background: 'var(--gold)',
                  color: 'var(--g-dark)',
                  fontWeight: 800,
                  fontSize: '.85rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(244,197,66,0.3)'
                }}>
                  <LogIn size={17} />
                  Sign In
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <div className="flex md:hidden" style={{ alignItems: 'center', gap: 8 }}>
            {!isLoggedIn && (
              <Link to="/login" style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'var(--gold)',
                color: 'var(--g-dark)',
                fontWeight: 800,
                fontSize: '.75rem',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }}>
                <LogIn size={14} /> Sign In
              </Link>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '8px',
                color: '#fff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {mobileMenuOpen ? <X size={22} color="var(--gold)" /> : <Menu size={22} />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            top: 70,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 999,
          }}
        />
      )}

      {/* Mobile Navigation Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 70,
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: 'calc(100vh - 70px)',
          background: 'var(--g-deep)',
          borderBottom: '2px solid var(--gold)',
          zIndex: 1000,
          transform: mobileMenuOpen ? 'translateY(0)' : 'translateY(-120%)',
          opacity: mobileMenuOpen ? 1 : 0,
          pointerEvents: mobileMenuOpen ? 'auto' : 'none',
          transition: 'transform .3s cubic-bezier(0.4, 0, 0.2, 1), opacity .25s ease',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '20px 20px 32px',
          boxShadow: '0 12px 30px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: '.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 4, paddingLeft: 4 }}>
            Navigation
          </div>
          {links.map(({ to, label, icon, badge }) => {
            const isActive = pathname === to;
            return (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: isActive ? 'var(--gold)' : '#fff',
                  fontSize: '.95rem',
                  fontWeight: isActive ? 800 : 600,
                  padding: '12px 16px',
                  borderRadius: 12,
                  textDecoration: 'none',
                  background: isActive ? 'rgba(244,197,66,0.15)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid rgba(244,197,66,0.3)' : '1px solid transparent',
                  transition: 'all .2s ease',
                }}
              >
                {icon}
                <span style={{ flex: 1 }}>{label}</span>
                {badge != null && (
                  <span style={{
                    background: 'var(--gold)',
                    color: 'var(--g-dark)',
                    fontSize: '.72rem',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 999
                  }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: pathname === '/admin' ? 'var(--gold)' : 'rgba(255,255,255,0.9)',
                fontSize: '.95rem',
                fontWeight: 700,
                padding: '12px 16px',
                borderRadius: 12,
                textDecoration: 'none',
                background: 'rgba(244,197,66,0.1)',
                border: '1px solid rgba(244,197,66,0.25)',
                marginTop: 4,
              }}
            >
              <Settings size={18} color="var(--gold)" />
              Admin Portal
            </Link>
          )}
        </div>

        {/* Mobile Auth / Profile Footer */}
        <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {isLoggedIn ? (
            <div style={{ background: 'rgba(0,0,0,0.25)', padding: '16px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: '.9rem', color: '#fff', fontWeight: 800 }}>{user.name}</div>
                  <div style={{ fontSize: '.75rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{user.dept} ({user.role})</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--g-primary)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '.85rem' }}>
                  {user.name[0]}
                </div>
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%',
                  background: 'var(--gold)',
                  color: 'var(--g-dark)',
                  border: 'none',
                  padding: '12px',
                  borderRadius: 10,
                  fontSize: '.85rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '14px',
                borderRadius: 12,
                background: 'var(--gold)',
                color: 'var(--g-dark)',
                fontWeight: 800,
                fontSize: '.92rem',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(244,197,66,0.3)',
                width: '100%',
                boxSizing: 'border-box'
              }}
            >
              <LogIn size={18} /> Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

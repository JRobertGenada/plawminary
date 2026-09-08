import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import { LayoutDashboard, ClipboardList, History, BarChart3, MessageSquare, LogOut, X, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NAV = [
  { id:'overview',    icon: <LayoutDashboard size={18} />, label:'Overview' },
  { id:'policies',    icon: <ClipboardList size={18} />,   label:'Manage Policies' },
  { id:'handbook',    icon: <BookOpen size={18} />,        label:'Handbook Ingestion' },
  { id:'versions',    icon: <History size={18} />,         label:'Version Control' },
  { id:'analytics',   icon: <BarChart3 size={18} />,       label:'Analytics' },
  { id:'suggestions', icon: <MessageSquare size={18} />,   label:'Suggestions' },
];

export default function AdminSidebar({ active, setActive, onCloseMobile }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'AD';

  function handleLogout() {
    logout();
    onCloseMobile?.();
    navigate('/');
  }

  function handleNavClick(id) {
    setActive(id);
    onCloseMobile?.();
  }

  return (
    <aside style={{
      width: 240, flexShrink: 0,
      background: 'var(--g-deep)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      borderRight: '1px solid rgba(255,255,255,.05)'
    }}>
      {/* Header */}
      <div style={{ padding: '20px 18px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logo} alt="Plawminary logo" style={{ height: 34, width: 34, objectFit: 'contain', flexShrink: 0 }} />
          <div>
            <div style={{ color: '#fff', fontFamily: '"DM Serif Display",serif', fontSize: '1.05rem', lineHeight: 1, letterSpacing: '.02em' }}>PLAWMINARY</div>
            <div style={{ fontSize: '.58rem', color: 'var(--gold)', fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 3, opacity: 0.85 }}>Admin Panel</div>
          </div>
        </div>
        {onCloseMobile && (
          <button onClick={onCloseMobile} className="lg:hidden" style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 4 }}>
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '16px 10px', overflowY: 'auto' }}>
        <div style={{ fontSize: '.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.12em', color: 'rgba(255,255,255,.3)', padding: '0 10px 10px' }}>Management</div>
        {NAV.map(({ id, icon, label }) => {
          const on = active === id;
          return (
            <button key={id} onClick={() => handleNavClick(id)} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '10px 12px', borderRadius: 10, marginBottom: 4,
              background: on ? 'rgba(244,197,66,.12)' : 'transparent',
              border: 'none',
              color: on ? 'var(--gold)' : 'rgba(255,255,255,.7)',
              fontSize: '.85rem', fontWeight: on ? 700 : 500,
              cursor: 'pointer', textAlign: 'left', fontFamily: '"Plus Jakarta Sans",sans-serif',
              transition: 'all .2s ease',
              position: 'relative'
            }}
              onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; } }}
            >
              {on && <div style={{ position: 'absolute', left: 0, top: '20%', bottom: '20%', width: 3, background: 'var(--gold)', borderRadius: '0 4px 4px 0' }} />}
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: on ? 1 : 0.7 }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* Footer Area */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,0.1)' }}>
        {/* Admin badge */}
        <div style={{ padding: '14px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--g-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.72rem', color: 'var(--gold)', fontWeight: 700 }}>{initials}</div>
            <div>
              <div style={{ color: '#fff', fontSize: '.78rem', fontWeight: 600 }}>{user?.name || 'Admin'}</div>
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: '.62rem' }}>{user?.dept || 'Super Admin'}</div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <div style={{ padding: '0 10px 14px' }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '9px 12px',
              borderRadius: 8,
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#FCA5A5',
              border: 'none',
              fontSize: '.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all .2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#FCA5A5'; }}
          >
            <LogOut size={15} />
            Logout Session
          </button>
        </div>
      </div>
    </aside>
  );
}

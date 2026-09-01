import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function Footer() {
  return (
    <footer style={{ background: 'var(--g-deep)', color: 'rgba(255,255,255,.75)', padding: '48px 0 24px', marginTop: 'auto' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 pb-9 border-b border-white/10">

          <div className="sm:col-span-2 lg:col-span-2">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <img src={logo} alt="Plawminary logo" style={{ height: 38, width: 38, objectFit: 'contain', flexShrink: 0 }} />
              <div style={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.35rem', color: '#fff', letterSpacing: '.02em' }}>PLAWMINARY</div>
            </div>
            <p style={{ fontSize: '.875rem', lineHeight: 1.7, color: 'rgba(255,255,255,.7)', maxWidth: 440 }}>
              A web-based Student Handbook Ordinance Finder for Pamantasan ng Lungsod ng San Pablo (PLSP).
              Making campus policies accessible, understandable, and actionable for every student.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gold)', marginBottom: 14 }}>Quick Links</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[['/', 'Home'], ['/ordinances', 'Ordinance Finder'], ['/handbook', 'PLSP Handbook']].map(([to, label]) => (
                <li key={to} style={{ marginBottom: 10 }}>
                  <Link to={to} style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.75)', textDecoration: 'none', transition: 'all .2s' }}
                    onMouseEnter={e => e.target.style.color = 'var(--gold)'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.75)'}
                  >{label}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 style={{ fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--gold)', marginBottom: 14 }}>Categories</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[['academic', 'Academic Policies'], ['conduct', 'Student Conduct'], ['discipline', 'Campus Discipline'], ['rights', 'Rights & Responsibilities']].map(([cat, label]) => (
                <li key={cat} style={{ marginBottom: 10 }}>
                  <Link to={`/ordinances?cat=${cat}`} style={{ fontSize: '.875rem', color: 'rgba(255,255,255,.75)', textDecoration: 'none', transition: 'all .2s' }}
                    onMouseEnter={e => e.target.style.color = 'var(--gold)'}
                    onMouseLeave={e => e.target.style.color = 'rgba(255,255,255,.75)'}
                  >{label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div style={{ paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.8rem', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ color: 'rgba(255,255,255,.6)' }}>© 2025 PLAWMINARY · Pamantasan ng Lungsod ng San Pablo</span>
          <span style={{ background: 'rgba(244,197,66,.12)', border: '1px solid rgba(244,197,66,.3)', color: 'var(--gold)', padding: '4px 12px', borderRadius: 999, fontSize: '.72rem', fontWeight: 700 }}>
            PLSP Official System
          </span>
        </div>
      </div>
    </footer>
  );
}

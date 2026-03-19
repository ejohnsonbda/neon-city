import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Calendar,
  LayoutDashboard,
  LogOut,
  LogIn,
  User,
  Menu,
  X,
  Trophy,
} from 'lucide-react';

const Header: React.FC = () => {
  const { isAuthenticated, currentUser, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navLinks = [
    { to: '/', label: 'Events', icon: <Trophy size={16} /> },
    { to: '/calendar', label: 'Calendar', icon: <Calendar size={16} /> },
  ];

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          height: 'var(--nav-h)',
          background: scrolled
            ? 'rgba(15,23,42,.97)'
            : 'rgba(15,23,42,.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,.3)' : 'none',
        }}
      >
        <div className="container h-full flex items-center justify-between">
          {/* ── Logo ── */}
          <Link to="/" className="flex items-center gap-3 group">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--gradient)' }}
            >
              <Trophy size={20} color="#fff" />
            </div>
            <div className="leading-tight">
              <span className="text-white font-extrabold text-lg tracking-tight">Sport</span>
              <span className="font-extrabold text-lg tracking-tight" style={{ color: 'var(--pink-light)' }}>Cal</span>
              <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,.45)', lineHeight: 1 }}>
                Bermuda Sports Events
              </div>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const active = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    color: active ? '#fff' : 'rgba(255,255,255,.65)',
                    background: active ? 'rgba(255,255,255,.1)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,.65)';
                  }}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* ── Right Side ── */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                {/* User info */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,.07)' }}>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'var(--gradient)' }}
                  >
                    {currentUser?.organizationName?.charAt(0) || 'U'}
                  </div>
                  <div className="leading-tight">
                    <div className="text-white text-xs font-semibold truncate max-w-[140px]">
                      {isAdmin ? 'Admin' : currentUser?.organizationName}
                    </div>
                    <div className="text-xs" style={{ color: 'rgba(255,255,255,.45)' }}>
                      {isAdmin ? 'Master Access' : 'Org Access'}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <Link to="/dashboard" className="btn btn-outline btn-sm" style={{ borderColor: 'rgba(255,255,255,.2)', color: 'rgba(255,255,255,.8)' }}>
                    <LayoutDashboard size={14} />
                    Dashboard
                  </Link>
                )}

                <button onClick={handleLogout} className="btn btn-sm" style={{ background: 'rgba(239,68,68,.15)', color: '#f87171', border: '1px solid rgba(239,68,68,.3)' }}>
                  <LogOut size={14} />
                  Logout
                </button>
              </>
            ) : (
              <button onClick={() => navigate('/login')} className="btn btn-gradient btn-sm">
                <LogIn size={14} />
                Login
              </button>
            )}
          </div>

          {/* ── Mobile Hamburger ── */}
          <button
            className="md:hidden p-2 rounded-lg text-white"
            style={{ background: 'rgba(255,255,255,.08)' }}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* ── Mobile Menu ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ top: 'var(--nav-h)' }}
        >
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(15,23,42,.97)', backdropFilter: 'blur(12px)' }}
            onClick={() => setMobileOpen(false)}
          />
          <nav className="relative z-10 p-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-white font-medium"
                style={{ background: 'rgba(255,255,255,.07)' }}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            {isAuthenticated ? (
              <>
                {isAdmin && (
                  <Link to="/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-white font-medium" style={{ background: 'rgba(255,255,255,.07)' }}>
                    <LayoutDashboard size={16} />
                    Dashboard
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-left"
                  style={{ background: 'rgba(239,68,68,.15)', color: '#f87171' }}
                >
                  <LogOut size={16} />
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="btn btn-gradient"
                style={{ justifyContent: 'center' }}
              >
                <LogIn size={16} />
                Login
              </button>
            )}

            {isAuthenticated && (
              <div className="mt-2 px-4 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,.05)' }}>
                <div className="flex items-center gap-2">
                  <User size={14} style={{ color: 'rgba(255,255,255,.5)' }} />
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,.7)' }}>
                    {currentUser?.organizationName}
                  </span>
                </div>
              </div>
            )}
          </nav>
        </div>
      )}
    </>
  );
};

export default Header;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';
import './Navbar.css';

// Using a placeholder SVG here, adjust based on the project's actual logo import
// import logo from '../assets/logo.svg';

const Navbar: React.FC = () => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
    setProfileDropdownOpen(false);
  };

  return (
    <nav className="navbar" style={{ background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderBottom: '1px solid var(--surface-border)' }}>
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(20, 184, 166, 0.5)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '0.5px', background: 'linear-gradient(90deg, #fff, #94a3b8)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
              AegisVision
            </span>
          </Link>
        </div>
        <ul className="navbar-links">
          <li><Link to="/" style={{ color: 'var(--text-primary)', fontWeight: 500, padding: '0.5rem 1rem', borderRadius: '6px', transition: 'all 0.3s ease' }}>Home</Link></li>
          <li
            className="dropdown"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <a href="#features" className="dropdown-toggle" style={{ color: 'var(--text-primary)', fontWeight: 500, padding: '0.5rem 1rem', borderRadius: '6px', transition: 'all 0.3s ease' }}>Features</a>
            {dropdownOpen && (
              <ul className="dropdown-menu" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--surface-border)', backdropFilter: 'blur(16px)', borderRadius: '12px', padding: '0.5rem', boxShadow: 'var(--shadow-lg)' }}>
                <li><Link to="/video-analysis" style={{ color: 'var(--text-primary)' }}>Video Analysis</Link></li>
                <li><Link to="/image-analysis" style={{ color: 'var(--text-primary)' }}>Image Analysis</Link></li>
                <li><Link to="/live-stream" style={{ color: 'var(--text-primary)' }}>Live Stream Analysis</Link></li>
                <li><Link to="/incident-detection" style={{ color: 'var(--text-primary)' }}>Incident Detection</Link></li>
                <li><Link to="/alerts" style={{ color: 'var(--text-primary)' }}>Alerts & Reports</Link></li>
              </ul>
            )}
          </li>

          <li><a href="#contact" style={{ color: 'var(--text-primary)', fontWeight: 500, padding: '0.5rem 1rem', borderRadius: '6px', transition: 'all 0.3s ease' }}>Contact</a></li>

          <li
            className="dropdown profile-dropdown-container"
            onMouseEnter={() => isAuthenticated && setProfileDropdownOpen(true)}
            onMouseLeave={() => setProfileDropdownOpen(false)}
            style={{ marginLeft: '1rem' }}
          >
            <div
              className="profile-icon"
              onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
              style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)', padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s ease' }}
            >
              {isAuthenticated && user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="nav-avatar-img" style={{ width: '24px', height: '24px', borderRadius: '50%' }} />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'color 0.3s ease' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              )}
            </div>

            {isAuthenticated && profileDropdownOpen && (
              <ul className="dropdown-menu profile-menu" style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid var(--surface-border)', backdropFilter: 'blur(16px)', borderRadius: '12px', padding: '0.5rem', boxShadow: 'var(--shadow-lg)', right: 0, left: 'auto' }}>
                <div className="profile-header-mini" style={{ padding: '0.75rem', borderBottom: '1px solid var(--surface-border)', marginBottom: '0.5rem' }}>
                  <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{user?.name}</strong>
                  <small style={{ color: 'var(--text-muted)' }}>{user?.email}</small>
                </div>
                <li><Link to="/account" style={{ color: 'var(--text-primary)' }}>Dashboard</Link></li>
                <li><button onClick={handleLogout} className="logout-btn" style={{ width: '100%', textAlign: 'left', padding: '0.5rem 1rem', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', fontWeight: 500 }}>Sign Out</button></li>
              </ul>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

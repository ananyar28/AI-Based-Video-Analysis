import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../index.css';
import './Navbar.css';
import logo from '../assets/logo.svg';

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
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logo} alt="AegisVision Logo" className="logo-img" />
            <span>AegisVision</span>
          </Link>
        </div>
        <ul className="navbar-links">
          <li><Link to="/">Home</Link></li>
          <li
            className="dropdown"
            onMouseEnter={() => setDropdownOpen(true)}
            onMouseLeave={() => setDropdownOpen(false)}
          >
            <a href="#features" className="dropdown-toggle">Features</a>
            {dropdownOpen && (
              <ul className="dropdown-menu">
                <li><a href="#video-analysis">Video Analysis</a></li>
                <li><a href="#image-analysis">Image Analysis</a></li>
                <li><a href="#live-stream">Live Stream Analysis</a></li>
                <li><a href="#incident-detection">Incident Detection</a></li>
                <li><a href="#alerts">Alerts & Reports</a></li>
              </ul>
            )}
          </li>

          <li><a href="#contact">Contact</a></li>

          <li
            className="dropdown profile-dropdown-container"
            onMouseEnter={() => isAuthenticated && setProfileDropdownOpen(true)}
            onMouseLeave={() => setProfileDropdownOpen(false)}
          >
            <div
              className="profile-icon"
              onClick={() => navigate(isAuthenticated ? '/account' : '/login')}
            >
              {isAuthenticated && user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="nav-avatar-img" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              )}
            </div>

            {isAuthenticated && profileDropdownOpen && (
              <ul className="dropdown-menu profile-menu">
                <div className="profile-header-mini">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                </div>
                <li><Link to="/account">Dashboard</Link></li>
                <li><button onClick={handleLogout} className="logout-btn">Sign Out</button></li>
              </ul>
            )}
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;

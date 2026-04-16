import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Navbar.css';

const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className={`navbar ${isDarkMode ? 'dark' : 'light'}`}>
      <div className="navbar-container">
        <div className="navbar-brand">
          <Link to="/dashboard" className="brand-link">
            <span className="brand-icon">💊</span>
            <span className="brand-text">AI Health Assistant</span>
          </Link>
        </div>
        
        <div className="navbar-menu">
          {isAuthenticated && (
            <div className="nav-links">
              <Link to="/dashboard" className="nav-link">Dashboard</Link>
              <Link to="/recommendations" className="nav-link">Recommendations</Link>
              <Link to="/profile" className="nav-link">Profile</Link>
              <Link to="/history" className="nav-link">History</Link>
            </div>
          )}
        </div>

        <div className="navbar-actions">
          <button 
            className="theme-toggle" 
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          {isAuthenticated ? (
            <div className="user-menu">
              <span className="user-name">Welcome, {user?.username}</span>
              <button className="logout-btn" onClick={handleLogout}>
                Logout
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="auth-link">Login</Link>
              <Link to="/register" className="auth-link">Register</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

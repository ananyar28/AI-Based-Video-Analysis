import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Account.css';

const Account: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const [activeTab, setActiveTab] = useState('profile');

    useEffect(() => {
        if (!isAuthenticated) {
            navigate('/login');
        }
    }, [isAuthenticated, navigate]);

    if (!user) return null; // Or a loading spinner

    // Safe default values
    const safeUser = {
        name: user.name || "User",
        email: user.email || "user@example.com",
        plan: "Free Tier",
        usage: 45, // percentage (mocked for now)
        avatar: user.avatar ? <img src={user.avatar} alt="Avatar" className="avatar-img" /> : (user.name?.charAt(0) || "U")
    };

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="account-container">
            <div className="account-sidebar">
                <div className="user-brief">
                    <div className="avatar-large">{safeUser.avatar}</div>
                    <h3>{safeUser.name}</h3>
                    <p>{safeUser.email}</p>
                </div>

                <nav className="account-nav">
                    <button
                        className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
                        onClick={() => setActiveTab('profile')}
                    >
                        Profile Settings
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'usage' ? 'active' : ''}`}
                        onClick={() => setActiveTab('usage')}
                    >
                        Usage & Billing
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        Security
                    </button>
                    <button className="nav-item logout" onClick={handleLogout}>
                        Sign Out
                    </button>
                </nav>
            </div>

            <div className="account-content">
                {activeTab === 'profile' && (
                    <div className="content-section fade-in">
                        <h2>Profile Settings</h2>
                        <div className="setting-card">
                            <div className="input-group">
                                <label>Full Name</label>
                                <input type="text" defaultValue={user.name} />
                            </div>
                            <div className="input-group">
                                <label>Email Address</label>
                                <input type="email" defaultValue={user.email} disabled />
                                <span className="helper-text">Contact support to change email</span>
                            </div>
                        </div>

                        <div className="action-row">
                            <button className="btn-primary">Save Changes</button>
                        </div>
                    </div>
                )}

                {activeTab === 'usage' && (
                    <div className="content-section fade-in">
                        <h2>Usage & Billing</h2>
                        <div className="usage-card">
                            <div className="plan-header">
                                <div>
                                    <h3>Current Plan: {safeUser.plan}</h3>
                                    <p>Renewals on Feb 18, 2026</p>
                                </div>
                                <button className="btn-secondary">Upgrade Plan</button>
                            </div>

                            <div className="usage-meter">
                                <div className="usage-label">
                                    <span>Video Analysis Minutes</span>
                                    <span>{safeUser.usage} / 100 mins</span>
                                </div>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${safeUser.usage}%` }}></div>
                                </div>
                            </div>
                        </div>

                        <h3>Payment Method</h3>
                        <div className="setting-card">
                            <div className="payment-method">
                                <span>•••• •••• •••• 4242</span>
                                <span className="card-expiry">Expires 12/28</span>
                                <button className="btn-text">Edit</button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="content-section fade-in">
                        <h2>Security</h2>
                        <div className="setting-card">
                            <div className="input-group">
                                <label>Current Password</label>
                                <input type="password" placeholder="••••••••" />
                            </div>
                            <div className="input-group">
                                <label>New Password</label>
                                <input type="password" placeholder="Enter new password" />
                            </div>
                            <div className="input-group">
                                <label>Confirm New Password</label>
                                <input type="password" placeholder="Confirm new password" />
                            </div>
                        </div>

                        <div className="action-row">
                            <button className="btn-primary">Update Password</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Account;

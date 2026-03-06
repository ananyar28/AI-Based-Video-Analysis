import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer className="footer-section" style={{ background: 'rgba(15, 23, 42, 1)', borderTop: '1px solid var(--surface-border)', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
            <div className="footer-content" style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--surface-border)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                        </svg>
                    </div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AegisVision</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem' }}>&copy; 2026 AegisVision. All rights reserved.</p>
                <div style={{ fontSize: '0.9rem' }}>
                    Contact: <a href="mailto:support@aegisvision.com" style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500 }}>support@aegisvision.com</a>
                </div>
            </div>
        </footer>
    );
};

export default Footer;

import React from 'react';
import './DummyFeatures.css';

const AlertsReports: React.FC = () => {
    return (
        <section className="dummy-feature-section">
            <div className="dummy-feature-container" style={{ maxWidth: '1200px' }}>
                <div className="dummy-feature-header" style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', marginBottom: '1rem' }}>
                        <h2 className="dummy-feature-title" style={{ margin: 0 }}>Alerts & Reports</h2>
                        <span className="dummy-badge" style={{ margin: 0 }}>Phase 2 Preview</span>
                    </div>
                    <p className="dummy-feature-subtitle">
                        Comprehensive logging, analytics dashboards, and customizable notification rules. <em>(Mockup Demonstration)</em>
                    </p>
                </div>

                {/* Dashboard Widgets */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginTop: '2rem' }}>
                    <div className="dummy-content-card" style={{ padding: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Alerts Today</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>142</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>↓ 12% vs Yesterday</div>
                    </div>
                    <div className="dummy-content-card" style={{ padding: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Critical Threats</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--error)' }}>3</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--warning)' }}>Require Immediate Action</div>
                    </div>
                    <div className="dummy-content-card" style={{ padding: '20px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Webhooks</div>
                        <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>4</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-Secondary)' }}>Slack, Email, PagerDuty</div>
                    </div>
                </div>

                {/* Data Table */}
                <div className="dummy-content-card" style={{ marginTop: '2rem', padding: '0', overflow: 'hidden', alignItems: 'stretch' }}>
                    <div style={{ padding: '20px', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Recent Security Events</h3>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button style={{ background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)', padding: '6px 12px', borderRadius: '6px' }}>Filter</button>
                            <button style={{ background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px' }}>Export CSV</button>
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.02)' }}>
                                <tr>
                                    <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--surface-border)' }}>Time</th>
                                    <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--surface-border)' }}>Event Type</th>
                                    <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--surface-border)' }}>Location / Camera</th>
                                    <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--surface-border)' }}>Severity</th>
                                    <th style={{ padding: '12px 20px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--surface-border)' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { time: '11:45:22', event: 'Weapon Detected', loc: 'Front Gate - Cam 01', sev: 'Critical', color: 'var(--error)', bg: 'rgba(239, 68, 68, 0.1)', status: 'Unresolved' },
                                    { time: '11:30:05', event: 'Unattended Bag', loc: 'Lobby - Cam 04', sev: 'Warning', color: 'var(--warning)', bg: 'rgba(245, 158, 11, 0.1)', status: 'Investigating' },
                                    { time: '10:15:40', event: 'Unauthorized Access', loc: 'Server Room - Cam 12', sev: 'Critical', color: 'var(--error)', bg: 'rgba(239, 68, 68, 0.1)', status: 'Resolved' },
                                    { time: '09:05:11', event: 'Crowd Formation', loc: 'Cafeteria - Cam 08', sev: 'Low', color: 'var(--accent-color)', bg: 'rgba(20, 184, 166, 0.1)', status: 'Resolved' },
                                ].map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                                        <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{row.time}</td>
                                        <td style={{ padding: '12px 20px', color: 'var(--text-primary)', fontWeight: 500 }}>{row.event}</td>
                                        <td style={{ padding: '12px 20px', color: 'var(--text-secondary)' }}>{row.loc}</td>
                                        <td style={{ padding: '12px 20px' }}>
                                            <span style={{ background: row.bg, color: row.color, padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 'bold' }}>{row.sev}</span>
                                        </td>
                                        <td style={{ padding: '12px 20px', color: 'var(--text-muted)' }}>{row.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AlertsReports;

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import About from './components/About';
import VideoUpload from './components/VideoUpload';
import Footer from './components/Footer';
import Login from './components/Login';
import Account from './components/Account';
import ImageAnalysis from './components/ImageAnalysis';
import LiveStreamAnalysis from './components/LiveStreamAnalysis';
import IncidentDetection from './components/IncidentDetection';
import AlertsReports from './components/AlertsReports';
import './App.css';

function App() {
  useEffect(() => {
    const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
    let lastActiveTime = Date.now();
    let timeoutId: ReturnType<typeof setTimeout>;

    const handleIdle = () => {
      if (window.location.pathname !== '/') {
        window.location.replace('/');
        window.scrollTo(0, 0);
      }
    };

    const resetTimer = () => {
      lastActiveTime = Date.now();
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleIdle, IDLE_TIMEOUT_MS);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // When user comes back to the tab, check if they've been idle for too long
        if (Date.now() - lastActiveTime > IDLE_TIMEOUT_MS) {
          handleIdle();
        } else {
          resetTimer();
        }
      }
    };

    resetTimer();

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <Routes>
          <Route path="/" element={
            <main className="main-content">
              <Hero />
              <VideoUpload />
              <About />
            </main>
          } />
          <Route path="/video-analysis" element={
            <main className="main-content">
              <VideoUpload />
            </main>
          } />
          <Route path="/image-analysis" element={
            <main className="main-content">
              <ImageAnalysis />
            </main>
          } />
          <Route path="/live-stream" element={
            <main className="main-content">
              <LiveStreamAnalysis />
            </main>
          } />
          <Route path="/incident-detection" element={
            <main className="main-content">
              <IncidentDetection />
            </main>
          } />
          <Route path="/alerts" element={
            <main className="main-content">
              <AlertsReports />
            </main>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/account" element={<Account />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

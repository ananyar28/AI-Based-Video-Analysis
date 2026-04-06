import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
    // Redirect to home page on refresh or initial load if not already there
    if (window.location.pathname !== '/') {
      window.location.replace('/');
    }
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
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;

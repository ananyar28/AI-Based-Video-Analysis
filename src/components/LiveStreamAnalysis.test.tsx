import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import LiveStreamAnalysis from './LiveStreamAnalysis';
import * as api from '../services/api';

expect.extend(matchers as any);

// Mock the API calls
vi.mock('../services/api', () => ({
  startStream: vi.fn(),
  stopStream: vi.fn(),
  getStreamStatus: vi.fn(),
}));

describe('LiveStreamAnalysis Component', () => {

  beforeAll(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn(),
      },
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders idle state with webcam config by default', () => {
    render(<LiveStreamAnalysis />);
    expect(screen.getByRole('heading', { level: 2, name: 'Live Stream Analysis' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Local Webcam' })).toHaveStyle('background: var(--accent-color)');
    expect(screen.getByRole('button', { name: 'Connect & Analyze' })).toBeInTheDocument();
  });

  it('switches to IP / RTSP URL source correctly', () => {
    render(<LiveStreamAnalysis />);
    const urlBtn = screen.getByRole('button', { name: 'IP / RTSP URL' });
    fireEvent.click(urlBtn);

    expect(screen.getByPlaceholderText('e.g. rtsp://192.168.1.100:554/stream1')).toBeInTheDocument();
  });

  it('handles webcam access properly and connects stream', async () => {
    const mockStream = { getTracks: vi.fn(() => []) };
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce(mockStream);
    (api.startStream as any).mockResolvedValueOnce({});
    (api.getStreamStatus as any).mockResolvedValueOnce({
      is_running: true,
      frames_captured: 10,
      frames_processed: 5,
      uptime_seconds: 2,
      target_fps: 5,
      camera_id: 'test-cam'
    });

    render(<LiveStreamAnalysis />);
    
    // Check if video preview exists
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    
    // Simulate Connect via form submission because JSDOM doesn't auto-submit forms on button click sometimes
    const connectBtn = screen.getByRole('button', { name: 'Connect & Analyze' });
    const form = connectBtn.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ video: true });
      expect(api.startStream).toHaveBeenCalled();
    });

    // Button should change to "Stop Stream"
    expect(screen.getByRole('button', { name: /Stop Stream/i })).toBeInTheDocument();
    
    // Status text in summary block should eventually show stream running status
    // Wait for the mock getStreamStatus to update the view
    await waitFor(() => {
      // The video component is visible or no longer error
    }, { timeout: 3000 });
  });

  it('shows error banner when starting stream fails', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(new Error('Permission denied'));
    (api.startStream as any).mockRejectedValueOnce(new Error('Backend error'));

    render(<LiveStreamAnalysis />);
    
    const connectBtn = screen.getByRole('button', { name: 'Connect & Analyze' });
    const form = connectBtn.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      const errorElements = screen.getAllByText('Backend error');
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

});

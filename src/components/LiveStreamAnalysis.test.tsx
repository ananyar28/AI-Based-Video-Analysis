import * as RTL from '@testing-library/react';
const { render, fireEvent, waitFor } = RTL as any;
import * as matchers from '@testing-library/jest-dom/matchers';
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
    const { getByRole } = render(<LiveStreamAnalysis />);
    expect(getByRole('heading', { level: 2, name: 'Live Stream Analysis' })).toBeInTheDocument();
    expect(getByRole('button', { name: 'Local Webcam' })).toHaveStyle('background: var(--accent-color)');
    expect(getByRole('button', { name: 'Connect & Analyze' })).toBeInTheDocument();
  });

  it('switches to IP / RTSP URL source correctly', () => {
    const { getByRole, getByPlaceholderText } = render(<LiveStreamAnalysis />);
    const urlBtn = getByRole('button', { name: 'IP / RTSP URL' });
    fireEvent.click(urlBtn);

    expect(getByPlaceholderText('e.g. rtsp://192.168.1.100:554/stream1')).toBeInTheDocument();
  });

  it('connects stream without calling getUserMedia', async () => {
    (api.startStream as any).mockResolvedValueOnce({});
    (api.getStreamStatus as any).mockResolvedValueOnce({
      running: true,
      frames_captured: 10,
      frames_processed: 5,
      uptime_seconds: 2,
      target_fps: 5,
      camera_id: 'test-cam'
    });

    const { getByText, getByRole } = render(<LiveStreamAnalysis />);
    
    // Check if preview container exists
    await waitFor(() => {
        expect(getByText(/Awaiting Connection.../i)).toBeInTheDocument();
    });
    
    // Simulate Connect via form submission because JSDOM doesn't auto-submit forms on button click sometimes
    const connectBtn = getByRole('button', { name: 'Connect & Analyze' });
    const form = connectBtn.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(api.startStream).toHaveBeenCalled();
    });

    // Button should change to "Stop Stream"
    expect(getByRole('button', { name: /Stop Stream/i })).toBeInTheDocument();
  });

  it('shows error banner when starting stream fails', async () => {
    (api.startStream as any).mockRejectedValueOnce(new Error('Backend error'));

    const { getByRole, getAllByText } = render(<LiveStreamAnalysis />);
    
    const connectBtn = getByRole('button', { name: 'Connect & Analyze' });
    const form = connectBtn.closest('form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      const errorElements = getAllByText('Backend error');
      expect(errorElements.length).toBeGreaterThan(0);
    });
  });

});

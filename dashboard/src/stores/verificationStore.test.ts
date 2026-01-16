import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useVerificationStore,
  handleVerificationWebSocketEvent,
} from './verificationStore';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiPost: vi.fn(),
}));

describe('verificationStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useVerificationStore.setState({
      verifications: new Map(),
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('updateVerification', () => {
    it('creates new verification entry when none exists', () => {
      const { updateVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', { status: 'pending' });

      const verification = getVerification('3-6-test');
      expect(verification).toBeDefined();
      expect(verification?.status).toBe('pending');
      expect(verification?.storyKey).toBe('3-6-test');
    });

    it('updates existing verification entry', () => {
      const { updateVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', { status: 'pending' });
      updateVerification('3-6-test', { status: 'verified', verifiedAt: '2026-01-16T12:00:00Z' });

      const verification = getVerification('3-6-test');
      expect(verification?.status).toBe('verified');
      expect(verification?.verifiedAt).toBe('2026-01-16T12:00:00Z');
    });

    it('preserves existing fields when updating partially', () => {
      const { updateVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', {
        status: 'mismatch',
        claimed: 'done',
        actual: 'in-progress',
      });
      updateVerification('3-6-test', { status: 'verified' });

      const verification = getVerification('3-6-test');
      expect(verification?.status).toBe('verified');
      expect(verification?.claimed).toBe('done');
      expect(verification?.actual).toBe('in-progress');
    });
  });

  describe('triggerReVerification', () => {
    it('sets pending state optimistically', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification, getVerification } =
        useVerificationStore.getState();

      const promise = triggerReVerification('3-6-test');

      // Check pending state was set immediately
      expect(getVerification('3-6-test')?.status).toBe('pending');

      await promise;
    });

    it('calls API with correct endpoint', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification } = useVerificationStore.getState();

      await triggerReVerification('3-6-test');

      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/stories/3-6-test/verify',
        undefined
      );
    });

    it('passes projectPath to API when provided', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification } = useVerificationStore.getState();

      await triggerReVerification('3-6-test', '/path/to/project');

      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/stories/3-6-test/verify',
        { projectPath: '/path/to/project' }
      );
    });

    it('sets verified state on successful match', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification, getVerification } =
        useVerificationStore.getState();

      await triggerReVerification('3-6-test');

      const verification = getVerification('3-6-test');
      expect(verification?.status).toBe('verified');
      expect(verification?.claimed).toBe('done');
      expect(verification?.actual).toBe('done');
      expect(verification?.verifiedAt).toBe('2026-01-16T12:00:00Z');
    });

    it('sets mismatch state on failed match', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'in-progress',
        match: false,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification, getVerification } =
        useVerificationStore.getState();

      await triggerReVerification('3-6-test');

      const verification = getVerification('3-6-test');
      expect(verification?.status).toBe('mismatch');
      expect(verification?.claimed).toBe('done');
      expect(verification?.actual).toBe('in-progress');
    });

    it('increments attempt count on each re-verification', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification, getVerification } =
        useVerificationStore.getState();

      await triggerReVerification('3-6-test');
      await triggerReVerification('3-6-test');

      expect(getVerification('3-6-test')?.attemptCount).toBe(2);
    });

    it('sets error state on API failure', async () => {
      vi.mocked(api.apiPost).mockRejectedValue(new Error('Network error'));

      const { triggerReVerification } = useVerificationStore.getState();

      await triggerReVerification('3-6-test');

      const state = useVerificationStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('reverts to mismatch on API failure', async () => {
      vi.mocked(api.apiPost).mockRejectedValue(new Error('Network error'));

      const { triggerReVerification, getVerification } =
        useVerificationStore.getState();

      await triggerReVerification('3-6-test');

      expect(getVerification('3-6-test')?.status).toBe('mismatch');
    });

    it('encodes storyKey in URL', async () => {
      vi.mocked(api.apiPost).mockResolvedValue({
        storyKey: '3-6-test/special',
        claimed: 'done',
        actual: 'done',
        match: true,
        timestamp: '2026-01-16T12:00:00Z',
      });

      const { triggerReVerification } = useVerificationStore.getState();

      await triggerReVerification('3-6-test/special');

      expect(api.apiPost).toHaveBeenCalledWith(
        '/api/stories/3-6-test%2Fspecial/verify',
        undefined
      );
    });
  });

  describe('clearVerification', () => {
    it('removes verification entry', () => {
      const { updateVerification, clearVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', { status: 'verified' });
      clearVerification('3-6-test');

      expect(getVerification('3-6-test')).toBeUndefined();
    });

    it('does not affect other entries', () => {
      const { updateVerification, clearVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', { status: 'verified' });
      updateVerification('3-7-other', { status: 'pending' });
      clearVerification('3-6-test');

      expect(getVerification('3-6-test')).toBeUndefined();
      expect(getVerification('3-7-other')).toBeDefined();
    });
  });

  describe('clearError', () => {
    it('clears error state', () => {
      useVerificationStore.setState({ error: 'Some error' });

      useVerificationStore.getState().clearError();

      expect(useVerificationStore.getState().error).toBeNull();
    });
  });

  describe('getVerification', () => {
    it('returns undefined for non-existent key', () => {
      const { getVerification } = useVerificationStore.getState();

      expect(getVerification('non-existent')).toBeUndefined();
    });

    it('returns verification state for existing key', () => {
      const { updateVerification, getVerification } =
        useVerificationStore.getState();

      updateVerification('3-6-test', { status: 'verified' });

      const verification = getVerification('3-6-test');
      expect(verification).toBeDefined();
      expect(verification?.status).toBe('verified');
    });
  });
});

describe('handleVerificationWebSocketEvent', () => {
  beforeEach(() => {
    useVerificationStore.setState({
      verifications: new Map(),
      isLoading: false,
      error: null,
    });
  });

  it('handles story:verified event', () => {
    handleVerificationWebSocketEvent('story:verified', {
      storyKey: '3-6-test',
      status: 'done',
      timestamp: '2026-01-16T12:00:00Z',
    });

    const verification = useVerificationStore.getState().getVerification('3-6-test');
    expect(verification?.status).toBe('verified');
    expect(verification?.actual).toBe('done');
    expect(verification?.verifiedAt).toBe('2026-01-16T12:00:00Z');
  });

  it('handles story:verification_failed event', () => {
    handleVerificationWebSocketEvent('story:verification_failed', {
      storyKey: '3-6-test',
      claimed: 'done',
      actual: 'in-progress',
      attempts: 2,
    });

    const verification = useVerificationStore.getState().getVerification('3-6-test');
    expect(verification?.status).toBe('mismatch');
    expect(verification?.claimed).toBe('done');
    expect(verification?.actual).toBe('in-progress');
    expect(verification?.attemptCount).toBe(2);
  });

  it('handles story:verification_pending event', () => {
    handleVerificationWebSocketEvent('story:verification_pending', {
      storyKey: '3-6-test',
    });

    const verification = useVerificationStore.getState().getVerification('3-6-test');
    expect(verification?.status).toBe('pending');
  });

  it('ignores unknown event types', () => {
    handleVerificationWebSocketEvent('unknown:event', {
      storyKey: '3-6-test',
    });

    const verification = useVerificationStore.getState().getVerification('3-6-test');
    expect(verification).toBeUndefined();
  });
});

/**
 * Verification Zustand Store
 * Manages verification state for stories
 */

import { create } from 'zustand';
import { apiPost } from '../services/api';
import type { VerificationStatus } from '../components/status/VerificationBadge';

export interface VerificationState {
  storyKey: string;
  status: VerificationStatus;
  claimed: string;
  actual: string;
  verifiedAt?: string;
  attemptCount: number;
}

interface VerificationResult {
  storyKey: string;
  claimed: string;
  actual: string;
  match: boolean;
  timestamp: string;
}

interface VerificationStoreState {
  verifications: Map<string, VerificationState>;
  isLoading: boolean;
  error: string | null;

  // Actions
  updateVerification: (storyKey: string, state: Partial<VerificationState>) => void;
  triggerReVerification: (storyKey: string, projectPath?: string) => Promise<void>;
  clearVerification: (storyKey: string) => void;
  clearError: () => void;
  getVerification: (storyKey: string) => VerificationState | undefined;
}

export const useVerificationStore = create<VerificationStoreState>((set, get) => ({
  verifications: new Map(),
  isLoading: false,
  error: null,

  updateVerification: (storyKey, state) => {
    set((prev) => {
      const verifications = new Map(prev.verifications);
      const current = verifications.get(storyKey) || {
        storyKey,
        status: 'unknown' as VerificationStatus,
        claimed: '',
        actual: '',
        attemptCount: 0,
      };
      verifications.set(storyKey, { ...current, ...state });
      return { verifications };
    });
  },

  triggerReVerification: async (storyKey, projectPath) => {
    const { updateVerification } = get();

    // Optimistic update: show pending state
    updateVerification(storyKey, {
      status: 'pending',
      attemptCount: (get().verifications.get(storyKey)?.attemptCount || 0) + 1,
    });

    set({ isLoading: true, error: null });

    try {
      const result = await apiPost<VerificationResult>(
        `/api/stories/${encodeURIComponent(storyKey)}/verify`,
        projectPath ? { projectPath } : undefined
      );

      updateVerification(storyKey, {
        status: result.match ? 'verified' : 'mismatch',
        claimed: result.claimed,
        actual: result.actual,
        verifiedAt: result.timestamp,
      });

      set({ isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Verification failed';
      set({ error: errorMessage, isLoading: false });

      // Revert to mismatch state on error (safest assumption)
      updateVerification(storyKey, {
        status: 'mismatch',
      });
    }
  },

  clearVerification: (storyKey) => {
    set((prev) => {
      const verifications = new Map(prev.verifications);
      verifications.delete(storyKey);
      return { verifications };
    });
  },

  clearError: () => set({ error: null }),

  getVerification: (storyKey) => {
    return get().verifications.get(storyKey);
  },
}));

/**
 * Handle WebSocket verification events
 * Call this from the WebSocket message handler
 */
export function handleVerificationWebSocketEvent(
  type: string,
  data: Record<string, unknown>
): void {
  const { updateVerification } = useVerificationStore.getState();

  switch (type) {
    case 'story:verified':
      updateVerification(data.storyKey as string, {
        status: 'verified',
        actual: data.status as string,
        verifiedAt: data.timestamp as string,
      });
      break;

    case 'story:verification_failed':
      updateVerification(data.storyKey as string, {
        status: 'mismatch',
        claimed: data.claimed as string,
        actual: data.actual as string,
        attemptCount: (data.attempts as number) || 1,
      });
      break;

    case 'story:verification_pending':
      updateVerification(data.storyKey as string, {
        status: 'pending',
      });
      break;
  }
}

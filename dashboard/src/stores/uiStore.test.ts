import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUIStore } from './uiStore';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('uiStore', () => {
  beforeEach(() => {
    // Reset Zustand store state
    useUIStore.setState({
      sidebarCollapsed: false,
      activeProjectId: null,
      agentPanelVisible: true,
      connectionStatus: 'disconnected',
      toasts: [],
    });
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('defaults sidebarCollapsed to false when localStorage is empty', () => {
      const state = useUIStore.getState();
      expect(state.sidebarCollapsed).toBe(false);
    });
  });

  describe('toggleSidebar', () => {
    it('toggles sidebarCollapsed from false to true', () => {
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();

      expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    });

    it('toggles sidebarCollapsed from true to false', () => {
      useUIStore.setState({ sidebarCollapsed: true });
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();

      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('persists state to localStorage when toggling', () => {
      const { toggleSidebar } = useUIStore.getState();

      toggleSidebar();

      expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
    });
  });

  describe('setSidebarCollapsed', () => {
    it('sets sidebarCollapsed to the provided value', () => {
      const { setSidebarCollapsed } = useUIStore.getState();

      setSidebarCollapsed(true);
      expect(useUIStore.getState().sidebarCollapsed).toBe(true);

      setSidebarCollapsed(false);
      expect(useUIStore.getState().sidebarCollapsed).toBe(false);
    });

    it('persists state to localStorage', () => {
      const { setSidebarCollapsed } = useUIStore.getState();

      setSidebarCollapsed(true);

      expect(localStorageMock.setItem).toHaveBeenCalledWith('sidebar-collapsed', 'true');
    });
  });

  describe('agentPanelVisible', () => {
    it('defaults agentPanelVisible to true', () => {
      const state = useUIStore.getState();
      expect(state.agentPanelVisible).toBe(true);
    });

    it('toggles agentPanelVisible from true to false', () => {
      const { toggleAgentPanel } = useUIStore.getState();

      toggleAgentPanel();

      expect(useUIStore.getState().agentPanelVisible).toBe(false);
    });

    it('toggles agentPanelVisible from false to true', () => {
      useUIStore.setState({ agentPanelVisible: false });
      const { toggleAgentPanel } = useUIStore.getState();

      toggleAgentPanel();

      expect(useUIStore.getState().agentPanelVisible).toBe(true);
    });

    it('persists state to localStorage when toggling', () => {
      const { toggleAgentPanel } = useUIStore.getState();

      toggleAgentPanel();

      expect(localStorageMock.setItem).toHaveBeenCalledWith('agent-panel-visible', 'false');
    });

    it('setAgentPanelVisible sets to provided value', () => {
      const { setAgentPanelVisible } = useUIStore.getState();

      setAgentPanelVisible(false);
      expect(useUIStore.getState().agentPanelVisible).toBe(false);

      setAgentPanelVisible(true);
      expect(useUIStore.getState().agentPanelVisible).toBe(true);
    });
  });

  describe('connectionStatus', () => {
    it('defaults connectionStatus to disconnected', () => {
      const state = useUIStore.getState();
      expect(state.connectionStatus).toBe('disconnected');
    });

    it('setConnectionStatus updates connection status', () => {
      const { setConnectionStatus } = useUIStore.getState();

      setConnectionStatus('connected');
      expect(useUIStore.getState().connectionStatus).toBe('connected');

      setConnectionStatus('reconnecting');
      expect(useUIStore.getState().connectionStatus).toBe('reconnecting');

      setConnectionStatus('disconnected');
      expect(useUIStore.getState().connectionStatus).toBe('disconnected');
    });
  });

  describe('toasts', () => {
    it('defaults toasts to empty array', () => {
      const state = useUIStore.getState();
      expect(state.toasts).toEqual([]);
    });

    it('addToast adds a toast with generated id', () => {
      const { addToast } = useUIStore.getState();

      addToast({ type: 'success', message: 'Test message' });

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0]).toMatchObject({
        type: 'success',
        message: 'Test message',
      });
      expect(toasts[0].id).toMatch(/^toast-\d+$/);
    });

    it('addToast appends to existing toasts', () => {
      const { addToast } = useUIStore.getState();

      addToast({ type: 'success', message: 'First' });
      addToast({ type: 'error', message: 'Second' });

      const toasts = useUIStore.getState().toasts;
      expect(toasts).toHaveLength(2);
      expect(toasts[0].message).toBe('First');
      expect(toasts[1].message).toBe('Second');
    });

    it('removeToast removes toast by id', () => {
      const { addToast, removeToast } = useUIStore.getState();

      addToast({ type: 'success', message: 'Test' });
      const toasts = useUIStore.getState().toasts;
      const toastId = toasts[0].id;

      removeToast(toastId);

      expect(useUIStore.getState().toasts).toHaveLength(0);
    });

    it('removeToast leaves other toasts intact', () => {
      const { addToast, removeToast } = useUIStore.getState();

      addToast({ type: 'success', message: 'First' });
      addToast({ type: 'error', message: 'Second' });
      const toasts = useUIStore.getState().toasts;
      const firstId = toasts[0].id;

      removeToast(firstId);

      const remaining = useUIStore.getState().toasts;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].message).toBe('Second');
    });
  });
});

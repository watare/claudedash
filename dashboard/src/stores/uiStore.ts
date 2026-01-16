import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface UIState {
  sidebarCollapsed: boolean;
  activeProjectId: string | null;
  agentPanelVisible: boolean;
  connectionStatus: ConnectionStatus;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveProject: (id: string | null) => void;
  toggleAgentPanel: () => void;
  setAgentPanelVisible: (visible: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

let toastIdCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: typeof window !== 'undefined'
    ? localStorage.getItem('sidebar-collapsed') === 'true'
    : false,
  activeProjectId: null,
  agentPanelVisible: typeof window !== 'undefined'
    ? localStorage.getItem('agent-panel-visible') !== 'false'
    : true,
  connectionStatus: 'disconnected',
  toasts: [],

  toggleSidebar: () => set((state) => {
    const newValue = !state.sidebarCollapsed;
    localStorage.setItem('sidebar-collapsed', String(newValue));
    return { sidebarCollapsed: newValue };
  }),

  setSidebarCollapsed: (collapsed: boolean) => {
    localStorage.setItem('sidebar-collapsed', String(collapsed));
    set({ sidebarCollapsed: collapsed });
  },

  setActiveProject: (id: string | null) => set({ activeProjectId: id }),

  toggleAgentPanel: () => set((state) => {
    const newValue = !state.agentPanelVisible;
    localStorage.setItem('agent-panel-visible', String(newValue));
    return { agentPanelVisible: newValue };
  }),

  setAgentPanelVisible: (visible: boolean) => {
    localStorage.setItem('agent-panel-visible', String(visible));
    set({ agentPanelVisible: visible });
  },

  setConnectionStatus: (status: ConnectionStatus) => set({ connectionStatus: status }),

  addToast: (toast) => {
    const id = `toast-${++toastIdCounter}`;
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },

  removeToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

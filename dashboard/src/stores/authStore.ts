import { create } from 'zustand';
import { setAccessToken, getAccessToken } from '@/services/api';
import { authService, type User } from '@/services/auth';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  handleOAuthCallback: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start true to prevent redirect before auth check completes
  error: null,

  login: async (email, password) => {
    try {
      set({ isLoading: true, error: null });

      const { user, accessToken } = await authService.login(email, password);

      // Store access token in memory
      setAccessToken(accessToken);

      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      await authService.logout();
    } finally {
      // Clear access token
      setAccessToken(null);
      set({ user: null, isAuthenticated: false, error: null });
    }
  },

  setUser: (user) => set({ user, isAuthenticated: true }),

  clearError: () => set({ error: null }),

  checkAuth: async () => {
    try {
      set({ isLoading: true });

      // First, try /auth/me with cookies (works for OAuth) or memory token
      const currentToken = getAccessToken();
      const headers: HeadersInit = {};
      if (currentToken) {
        headers.Authorization = `Bearer ${currentToken}`;
      }

      const response = await fetch(`${API_URL}/auth/me`, {
        headers,
        credentials: 'include', // Send cookies (accessToken cookie from OAuth)
      });

      if (response.ok) {
        const data = await response.json();
        set({
          user: data.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      // Token invalid/expired, try to refresh
      const refreshed = await get().refreshToken();

      if (refreshed) {
        // Verify the new token
        const newToken = getAccessToken();
        const newHeaders: HeadersInit = {};
        if (newToken) {
          newHeaders.Authorization = `Bearer ${newToken}`;
        }

        const retryResponse = await fetch(`${API_URL}/auth/me`, {
          headers: newHeaders,
          credentials: 'include',
        });

        if (retryResponse.ok) {
          const data = await retryResponse.json();
          set({
            user: data.data.user,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }

      // Not authenticated
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  refreshToken: async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      setAccessToken(data.data.accessToken);
      return true;
    } catch {
      return false;
    }
  },

  handleOAuthCallback: (token: string) => {
    // Store access token from OAuth callback
    setAccessToken(token);
    set({ isAuthenticated: true });
  },
}));

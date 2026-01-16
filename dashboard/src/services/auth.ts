const API_URL = import.meta.env.VITE_API_URL || '';

export interface User {
  userId: string;
  username?: string;
  email?: string;
  avatarUrl?: string;
}

export interface LoginResult {
  user: User;
  accessToken: string;
}

interface ApiResponse<T> {
  data: T;
  meta?: { timestamp: string };
}

interface ApiError {
  error: string;
  code?: string;
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      credentials: 'include', // Include cookies
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Too many attempts. Please try again later.');
      }
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || 'Invalid email or password');
    }

    const result: ApiResponse<LoginResult> = await response.json();
    return result.data;
  },

  async logout(): Promise<void> {
    await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  },

  async checkAuth(): Promise<LoginResult | null> {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    } catch {
      return null;
    }
  },

  getGitHubAuthUrl(): string {
    return `${API_URL}/auth/github`;
  },
};

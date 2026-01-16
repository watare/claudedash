/**
 * GitHub OAuth implementation
 */

import { getGitHubCredentials } from '../config/secrets.js';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Build the GitHub OAuth authorization URL
 * @param {string} state - Random state parameter for CSRF protection
 * @param {string} redirectUri - Callback URL for OAuth redirect
 * @returns {string} Full authorization URL
 */
export function getAuthorizationUrl(state, redirectUri) {
  const { client_id } = getGitHubCredentials();

  const params = new URLSearchParams({
    client_id,
    redirect_uri: redirectUri,
    scope: 'read:user',
    state,
  });

  return `${GITHUB_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token
 * @param {string} code - Authorization code from GitHub callback
 * @param {string} redirectUri - Callback URL (must match original)
 * @returns {Promise<string>} GitHub access token
 * @throws {Error} If token exchange fails
 */
export async function exchangeCodeForToken(code, redirectUri) {
  const { client_id, client_secret } = getGitHubCredentials();

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id,
      client_secret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub token exchange failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data.access_token;
}

/**
 * Fetch the authenticated user's profile from GitHub API
 * @param {string} accessToken - GitHub access token
 * @returns {Promise<{ id: number, login: string, name: string, avatar_url: string }>} User profile
 * @throws {Error} If API request fails
 */
export async function getGitHubUser(accessToken) {
  const response = await fetch(GITHUB_USER_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'bmad-orchestrator',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }

  const user = await response.json();

  return {
    id: user.id,
    login: user.login,
    name: user.name || user.login,
    avatar_url: user.avatar_url,
  };
}

/**
 * Generate a random state parameter for OAuth CSRF protection
 * @returns {string} Random hex string
 */
export function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

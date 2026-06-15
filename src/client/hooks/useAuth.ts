/**
 * Authentication Hook
 * Manages authentication state and provides login/logout functions
 */

import { useState, useEffect, useCallback, useRef } from 'react';

const TOKEN_KEY = 'staff_token';
const TOKEN_EXPIRES_KEY = 'staff_token_expires';

export interface AuthState {
  isLoading: boolean;
  isAuthenticated: boolean;
  requireAuth: boolean;
  error: string | null;
  remainingAttempts: number | null;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}

// Helper functions outside the hook (no closure issues)
function storeTokenHelper(token: string, expiresAt: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRES_KEY, expiresAt.toString());
}

function clearTokenHelper() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRES_KEY);
}

function getStoredToken(): { token: string | null; expiresAt: number | null } {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiresAt = localStorage.getItem(TOKEN_EXPIRES_KEY);
  return {
    token,
    expiresAt: expiresAt ? parseInt(expiresAt, 10) : null,
  };
}

function isTokenExpired(expiresAt: number | null): boolean {
  return !expiresAt || Date.now() / 1000 > expiresAt;
}

async function checkAuthRequired(): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/check');
    const data = await response.json();
    return data.requireAuth === true;
  } catch {
    return true; // Default to requiring auth on error
  }
}

async function verifyToken(token: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/verify', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return data.valid === true;
  } catch {
    return false;
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    isLoading: true,
    isAuthenticated: false,
    requireAuth: true,
    error: null,
    remainingAttempts: null,
  });

  // Use ref to track if initialized (prevents double init in strict mode)
  const initRef = useRef(false);

  // Store token (for login)
  const storeToken = useCallback((token: string, expiresAt: number) => {
    storeTokenHelper(token, expiresAt);
  }, []);

  // Clear token (for logout)
  const clearToken = useCallback(() => {
    clearTokenHelper();
  }, []);

  // Login with password
  const login = useCallback(async (password: string): Promise<LoginResult> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        storeTokenHelper(data.token, data.expiresAt);
        setState({
          isLoading: false,
          isAuthenticated: true,
          requireAuth: true,
          error: null,
          remainingAttempts: null,
        });
        return { success: true };
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || '登录失败',
          remainingAttempts: data.remainingAttempts ?? null,
        }));
        return {
          success: false,
          error: data.error,
          remainingAttempts: data.remainingAttempts,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '登录失败，请重试';
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  }, []);

  // Logout
  const logout = useCallback(() => {
    clearTokenHelper();
    setState({
      isLoading: false,
      isAuthenticated: false,
      requireAuth: true,
      error: null,
      remainingAttempts: null,
    });
  }, []);

  // Initialize auth state - runs once
  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (initRef.current) return;
    initRef.current = true;

    let mounted = true;

    async function initAuth() {
      // Check URL for token (from push notification)
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');

      if (urlToken) {
        // Store token from URL
        storeTokenHelper(urlToken, Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60);
        // Clean URL
        urlParams.delete('token');
        const newUrl = urlParams.toString()
          ? `${window.location.pathname}?${urlParams.toString()}`
          : window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }

      // Get stored token
      const { token, expiresAt } = getStoredToken();

      // Check if token is expired
      const expired = isTokenExpired(expiresAt);

      if (token && !expired) {
        // Verify token with server
        const valid = await verifyToken(token);

        if (mounted) {
          if (valid) {
            setState({
              isLoading: false,
              isAuthenticated: true,
              requireAuth: true,
              error: null,
              remainingAttempts: null,
            });
          } else {
            // Token invalid, clear and check if auth required
            clearTokenHelper();
            const requireAuth = await checkAuthRequired();
            setState({
              isLoading: false,
              isAuthenticated: !requireAuth,
              requireAuth,
              error: null,
              remainingAttempts: null,
            });
          }
        }
      } else {
        // No valid token, check if auth required
        if (token) {
          clearTokenHelper();
        }
        const requireAuth = await checkAuthRequired();
        if (mounted) {
          setState({
            isLoading: false,
            isAuthenticated: !requireAuth,
            requireAuth,
            error: null,
            remainingAttempts: null,
          });
        }
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []); // Empty dependency - only run once

  return {
    ...state,
    login,
    logout,
    storeToken,
    clearToken,
  };
}

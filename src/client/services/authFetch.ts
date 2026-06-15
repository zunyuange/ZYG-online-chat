/**
 * Auth-aware fetch wrapper
 * Automatically handles authentication errors and token injection
 */

const TOKEN_KEY = 'staff_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('staff_token_expires');
    
    if (window.location.pathname.startsWith('/staff')) {
      window.location.reload();
    }
  }
  
  return response;
}

export async function authFetchJson<T>(url: string, options: RequestInit = {}): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const response = await authFetch(url, options);
    const result = await response.json();
    return result;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}
/**
 * Admin Login Page - Backend Management Login
 * Standalone login page for admin/authentication
 */

import { useState, useEffect } from 'react';
import { useI18n } from '../context/I18nContext';

export function AdminLoginPage() {
  const { t, locale, setLocale } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const supportedLocales = [
    { code: 'zh-CN', nativeName: '中文' },
    { code: 'en-US', nativeName: 'English' },
  ];

  useEffect(() => {
    checkAuthRequired();
  }, []);

  const checkAuthRequired = async () => {
    try {
      const response = await fetch('/api/auth/check');
      const data = await response.json();
      if (!data.requireAuth) {
        window.location.href = '/admin';
      }
    } catch {
      // Continue to login page
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin-auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        localStorage.setItem('admin_token', data.token);
        localStorage.setItem('admin_token_expires', data.expiresAt.toString());
        localStorage.setItem('admin_username', data.username || '');
        // Redirect to admin page
        window.location.href = '/admin';
      } else {
        setError(data.error || t('login_failed'));
        setRemainingAttempts(data.remainingAttempts ?? null);
      }
    } catch (error) {
      setError(t('login_failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    color: '#1a1a2e',
    textAlign: 'center',
    marginBottom: '8px',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: '#666',
    textAlign: 'center',
    marginBottom: '32px',
  };

  const inputContainerStyle: React.CSSProperties = {
    marginBottom: '16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    border: '2px solid #e1e1e1',
    borderRadius: '10px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  };

  const buttonStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    border: 'none',
    borderRadius: '10px',
    cursor: isLoading || remainingAttempts === 0 ? 'not-allowed' : 'pointer',
    opacity: isLoading || remainingAttempts === 0 ? 0.6 : 1,
    transition: 'transform 0.2s, box-shadow 0.2s',
  };

  const errorStyle: React.CSSProperties = {
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#dc2626',
    fontSize: '14px',
  };

  const warningStyle: React.CSSProperties = {
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '20px',
    color: '#d97706',
    fontSize: '14px',
  };

  const remainingStyle: React.CSSProperties = {
    marginTop: '8px',
    fontSize: '13px',
    color: '#ef4444',
  };

  const langSelectorStyle: React.CSSProperties = {
    position: 'absolute',
    top: '16px',
    right: '16px',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
  };

  const linkStyle: React.CSSProperties = {
    display: 'block',
    textAlign: 'center',
    marginTop: '16px',
    color: '#1890ff',
    fontSize: '14px',
    textDecoration: 'none',
  };

  return (
    <div style={containerStyle}>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as any)}
        style={langSelectorStyle}
      >
        {supportedLocales.map((l) => (
          <option key={l.code} value={l.code} style={{ color: '#000' }}>
            {l.nativeName}
          </option>
        ))}
      </select>

      <div style={cardStyle}>
        <h1 style={titleStyle}>🔐 {t('admin_login_title')}</h1>
        <p style={subtitleStyle}>{t('login_desc')}</p>

        <form onSubmit={handleLogin}>
          {error && (
            <div style={errorStyle}>
              <div>{error}</div>
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <div style={remainingStyle}>
                  {t('remaining_attempts')}: {remainingAttempts}
                </div>
              )}
            </div>
          )}

          {remainingAttempts === 0 && (
            <div style={warningStyle}>
              {t('too_many_attempts')}
            </div>
          )}

          <div style={inputContainerStyle}>
            <input
              type="text"
              placeholder={t('username')}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={inputContainerStyle}>
            <input
              type="password"
              placeholder={t('password')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || remainingAttempts === 0}
            style={buttonStyle}
          >
            {isLoading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <svg
                  style={{ animation: 'spin 1s linear infinite', width: '20px', height: '20px' }}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="31.4 31.4"
                    strokeDashoffset="0"
                  />
                </svg>
                {t('logging_in')}
              </span>
            ) : (
              t('login')
            )}
          </button>
        </form>

        <a href="/staff" style={linkStyle}>
          {t('go_to_staff')}
        </a>

        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          input:focus {
            border-color: #667eea !important;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2) !important;
          }
          button:not(:disabled):hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(102, 126, 234, 0.4);
          }
          button:not(:disabled):active {
            transform: translateY(0);
          }
          a:hover {
            text-decoration: underline;
          }
        `}</style>
      </div>
    </div>
  );
}
/**
 * Login Form Component
 * Username and password input form for staff authentication
 */

import { useState, FormEvent } from 'react';
import type { LoginResult } from '../../hooks/useAuth';

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<LoginResult>;
  error: string | null;
  remainingAttempts: number | null;
  isLoading: boolean;
}

export function LoginForm({ onLogin, error, remainingAttempts, isLoading }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.trim()) {
      await onLogin(username.trim(), password.trim());
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

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>🔐 客服后台</h1>
        <p style={subtitleStyle}>请输入账号密码登录客服工作台</p>

        <form onSubmit={handleSubmit}>
          {error && (
            <div style={errorStyle}>
              <div>{error}</div>
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <div style={remainingStyle}>
                  剩余尝试次数: {remainingAttempts}
                </div>
              )}
            </div>
          )}

          {remainingAttempts === 0 && (
            <div style={warningStyle}>
              尝试次数过多，请 10 分钟后重试
            </div>
          )}

          <div style={inputContainerStyle}>
            <input
              type="text"
              placeholder="用户名"
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
              placeholder="密码"
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
                登录中...
              </span>
            ) : (
              '登录'
            )}
          </button>
        </form>

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
        `}</style>
      </div>
    </div>
  );
}
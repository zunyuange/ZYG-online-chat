/**
 * Admin Page - User Management
 * Staff account management interface
 */

import { useState, useEffect } from 'react';
import { User, UserPlus, Edit, Trash2, Shield, X, Check } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

interface UserData {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  created_at: number;
  updated_at: number;
}

interface UserFormData {
  username: string;
  password: string;
  email: string;
  name: string;
  role: string;
}

export function AdminPage() {
  const { t, locale, setLocale } = useI18n();
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    email: '',
    name: '',
    role: 'staff',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const supportedLocales = [
    { code: 'zh-CN', nativeName: '中文' },
    { code: 'en-US', nativeName: 'English' },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/adminlogin';
      return;
    }
    loadUsers();
  };

  const loadUsers = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin-auth/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
      } else {
        setError(data.error || t('load_failed'));
      }
    } catch (err) {
      setError(t('load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingUser(null);
    setFormData({
      username: '',
      password: '',
      email: '',
      name: '',
      role: 'staff',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      name: user.name || '',
      role: user.role,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin-auth/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      
      if (data.success) {
        setUsers(users.filter(u => u.id !== id));
        setDeleteConfirm(null);
      } else {
        setError(data.error || t('delete_failed'));
      }
    } catch (err) {
      setError(t('delete_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.username.trim()) {
      setFormError(t('please_enter_username'));
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      setFormError(t('please_enter_password'));
      return;
    }

    setFormLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const url = editingUser 
        ? `/api/admin-auth/users/${editingUser.id}` 
        : '/api/admin-auth/users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        username: formData.username,
        email: formData.email || undefined,
        name: formData.name || undefined,
      };

      if (editingUser && formData.password) {
        body.password = formData.password;
      } else if (!editingUser) {
        body.password = formData.password;
      }

      const response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      
      if (data.success) {
        setShowModal(false);
        loadUsers();
      } else {
        setFormError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setFormError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token_expires');
    localStorage.removeItem('admin_username');
    window.location.href = '/adminlogin';
  };

  // Styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#001529',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#fff',
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '24px',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
  };

  const thStyle: React.CSSProperties = {
    textAlign: 'left',
    padding: '12px 16px',
    backgroundColor: '#fafafa',
    borderBottom: '1px solid #f0f0f0',
    fontWeight: 600,
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
  };

  const buttonStyle = (variant: 'primary' | 'danger' | 'default'): React.CSSProperties => ({
    padding: '6px 12px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    ...(variant === 'primary' && {
      backgroundColor: '#1890ff',
      color: '#fff',
    }),
    ...(variant === 'danger' && {
      backgroundColor: '#ff4d4f',
      color: '#fff',
    }),
    ...(variant === 'default' && {
      backgroundColor: '#f0f0f0',
      color: '#666',
    }),
  });

  const badgeStyle = (status: string): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: status === 'active' ? '#f6ffed' : '#fff1f0',
    color: status === 'active' ? '#52c41a' : '#ff4d4f',
    border: `1px solid ${status === 'active' ? '#b7eb8f' : '#ffa39e'}`,
  });

  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#333',
  };

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="animate-spin" style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e5e7eb',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            margin: '0 auto 16px',
          }}></div>
          <p>{t('loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={24} />
          <span style={{ fontSize: '18px', fontWeight: 500 }}>{t('admin_panel')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as any)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {supportedLocales.map((l) => (
              <option key={l.code} value={l.code} style={{ color: '#000' }}>
                {l.nativeName}
              </option>
            ))}
          </select>
          <button 
            onClick={handleLogout}
            style={{ ...buttonStyle('default'), color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            {t('logout')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={containerStyle}>
        {error && (
          <div style={{
            backgroundColor: '#fff2f0',
            border: '1px solid #ffccc7',
            borderRadius: '4px',
            padding: '12px 16px',
            marginBottom: '16px',
            color: '#ff4d4f',
          }}>
            {error}
            <button 
              onClick={() => setError(null)}
              style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4f' }}
            >
              ×
            </button>
          </div>
        )}

        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>{t('user_management')}</h2>
            <button onClick={handleCreate} style={buttonStyle('primary')}>
              <UserPlus size={16} />
              {t('add_user')}
            </button>
          </div>

          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>{t('username')}</th>
                <th style={thStyle}>{t('name')}</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>{t('role')}</th>
                <th style={thStyle}>{t('status')}</th>
                <th style={thStyle}>{t('created_at')}</th>
                <th style={thStyle}>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                    {t('no_data')}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id}>
                    <td style={tdStyle}>{user.id}</td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <User size={16} style={{ color: '#999' }} />
                        {user.username}
                      </div>
                    </td>
                    <td style={tdStyle}>{user.name || '-'}</td>
                    <td style={tdStyle}>{user.email || '-'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        backgroundColor: user.role === 'admin' ? '#e6f7ff' : '#f9f0ff',
                        color: user.role === 'admin' ? '#1890ff' : '#722ed1',
                      }}>
                        {user.role === 'admin' ? t('admin') : t('staff')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={badgeStyle(user.status)}>
                        {user.status === 'active' ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={() => handleEdit(user)}
                          style={buttonStyle('default')}
                          title={t('edit')}
                        >
                          <Edit size={14} />
                        </button>
                        {deleteConfirm === user.id ? (
                          <>
                            <button 
                              onClick={() => handleDelete(user.id)}
                              disabled={formLoading}
                              style={{ ...buttonStyle('danger'), opacity: formLoading ? 0.6 : 1 }}
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={() => setDeleteConfirm(null)}
                              style={buttonStyle('default')}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button 
                            onClick={() => setDeleteConfirm(user.id)}
                            style={buttonStyle('danger')}
                            title={t('delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={modalOverlayStyle} onClick={() => setShowModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '16px' }}>
                {editingUser ? t('edit_user') : t('add_user')}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' }}
              >
                ×
              </button>
            </div>

            {formError && (
              <div style={{
                backgroundColor: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                padding: '8px 12px',
                marginBottom: '16px',
                color: '#ff4d4f',
                fontSize: '14px',
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('username')} *</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!editingUser}
                  style={{ ...inputStyle, backgroundColor: editingUser ? '#f5f5f5' : '#fff' }}
                  placeholder={t('please_enter_username')}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>
                  {t('password')} {editingUser ? `(${t('optional')})` : '*'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  style={inputStyle}
                  placeholder={editingUser ? t('enter_new_password') : t('please_enter_password')}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>{t('name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={inputStyle}
                  placeholder={t('please_enter_name')}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={inputStyle}
                  placeholder={t('please_enter_email')}
                />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>{t('role')}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={inputStyle}
                >
                  <option value="staff">{t('staff')}</option>
                  <option value="admin">{t('admin')}</option>
                </select>
              </div>

              {editingUser && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t('status')}</label>
                  <select
                    value={editingUser.status}
                    onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="active">{t('active')}</option>
                    <option value="inactive">{t('inactive')}</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  style={buttonStyle('default')}
                >
                  {t('cancel')}
                </button>
                <button 
                  type="submit"
                  disabled={formLoading}
                  style={{ ...buttonStyle('primary'), opacity: formLoading ? 0.6 : 1 }}
                >
                  {formLoading ? t('loading') : t('submit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
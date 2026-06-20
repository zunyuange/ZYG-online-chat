import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Edit2, Save, X, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@client/context/I18nContext';

interface StaffUser {
  id: number;
  business_id: number;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  created_at: number;
  updated_at: number;
}

interface CreateUserModal {
  show: boolean;
  editing?: StaffUser | null;
}

export function StaffManagement() {
  const { t } = useI18n();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<CreateUserModal>({ show: false });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    name: '',
    email: '',
    role: 'staff',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/staff/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      } else {
        console.error('Failed to fetch users:', result.error);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (user?: StaffUser) => {
    if (user) {
      setFormData({
        username: user.username,
        password: '',
        name: user.name || '',
        email: user.email || '',
        role: user.role,
      });
      setModal({ show: true, editing: user });
    } else {
      setFormData({
        username: '',
        password: '',
        name: '',
        email: '',
        role: 'staff',
      });
      setModal({ show: true, editing: null });
    }
  };

  const handleCloseModal = () => {
    setModal({ show: false, editing: null });
    setMessage('');
  };

  const handleSubmit = async () => {
    if (!formData.username) {
      setMessage(t('staff_mgmt_username_required'));
      return;
    }
    if (!modal.editing && !formData.password) {
      setMessage(t('staff_mgmt_password_required'));
      return;
    }

    try {
      const response = await fetch('/api/staff/users', {
        method: modal.editing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
        body: JSON.stringify(formData),
      });
      const result = await response.json();
      if (result.success) {
        setMessage(modal.editing ? t('staff_mgmt_update_success') : t('staff_mgmt_create_success'));
        fetchUsers();
        setTimeout(() => {
          handleCloseModal();
        }, 1000);
      } else {
        setMessage(result.error || t('operation_failed'));
      }
    } catch (error) {
      setMessage(t('operation_failed'));
      console.error('Failed to submit:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t('staff_mgmt_delete_confirm'))) return;

    try {
      const response = await fetch(`/api/staff/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('staff_token')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        fetchUsers();
      } else {
        alert(result.error || t('delete_failed'));
      }
    } catch (error) {
      console.error('Failed to delete:', error);
      alert(t('delete_failed'));
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(navigator.language || 'en');
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <div className="animate-spin" style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e5e7eb',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          margin: '0 auto 16px',
        }}></div>
        <p style={{ color: '#6b7280' }}>{t('loading_text')}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 500, margin: 0 }}>{t('staff_mgmt_title')}</h2>
        <button
          onClick={() => handleOpenModal()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          <UserPlus size={18} />
          {t('staff_mgmt_add_account')}
        </button>
      </div>

      {/* User List */}
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#fafafa' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('staff_mgmt_username')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('staff_mgmt_name')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('email')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('staff_mgmt_role')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('staff_mgmt_status')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('created_at')}</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '14px', fontWeight: 500, color: '#666', borderBottom: '1px solid #e8e8e8' }}>{t('staff_mgmt_actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
                  {t('staff_mgmt_no_accounts')}
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #e8e8e8' }}>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{user.username}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{user.name || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>{user.email || '-'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: user.role === 'admin' ? '#fff7e6' : '#f6ffed',
                      color: user.role === 'admin' ? '#d46b08' : '#52c41a',
                    }}>
                      {user.role === 'admin' ? t('staff_mgmt_role_admin') : t('staff_mgmt_role_staff')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px' }}>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      backgroundColor: user.status === 'active' ? '#f6ffed' : '#fff2f0',
                      color: user.status === 'active' ? '#52c41a' : '#ff4d4f',
                    }}>
                      {user.status === 'active' ? t('staff_mgmt_enabled') : t('staff_mgmt_disabled')}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '14px', color: '#999' }}>
                    {formatDate(user.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenModal(user)}
                        style={{
                          padding: '4px 8px',
                          border: 'none',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#666',
                        }}
                        title={t('staff_mgmt_edit')}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        style={{
                          padding: '4px 8px',
                          border: 'none',
                          backgroundColor: '#fff2f0',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#ff4d4f',
                        }}
                        title={t('staff_mgmt_delete')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modal.show && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '480px',
            position: 'relative',
          }}>
            <button
              onClick={handleCloseModal}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                color: '#999',
              }}
            >
              <X size={20} />
            </button>

            <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>
              {modal.editing ? t('staff_mgmt_edit_account') : t('staff_mgmt_add_account')}
            </h3>

            {message && (
              <div style={{
                padding: '12px',
                borderRadius: '4px',
                marginBottom: '16px',
                backgroundColor: message.includes(t('success')) ? '#f6ffed' : '#fff2f0',
                color: message.includes(t('success')) ? '#52c41a' : '#ff4d4f',
                fontSize: '14px',
              }}>
                {message}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('staff_mgmt_username_label')}</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={!!modal.editing}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    backgroundColor: modal.editing ? '#f5f5f5' : '#fff',
                  }}
                  placeholder={t('staff_mgmt_username_placeholder')}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>
                  {t('staff_mgmt_password_label')}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      paddingRight: '40px',
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                    }}
                    placeholder={t('staff_mgmt_password_placeholder')}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: 'pointer',
                      color: '#999',
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('staff_mgmt_name')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder={t('staff_mgmt_name_placeholder')}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('email')}</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                  placeholder={t('staff_mgmt_email_placeholder')}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500 }}>{t('staff_mgmt_role')}</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="staff">{t('staff_mgmt_role_staff')}</option>
                  <option value="admin">{t('staff_mgmt_role_admin')}</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '16px' }}>
                <button
                  onClick={handleCloseModal}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #d9d9d9',
                    borderRadius: '4px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleSubmit}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: '#1890ff',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                  }}
                >
                  <Save size={16} />
                  {modal.editing ? t('save') : t('staff_mgmt_create')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
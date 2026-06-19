/**
 * Admin Page - Complete Management System
 * Dashboard, Staff Management, Admin Management, Role Management, Settings
 */

import { useState, useEffect } from 'react';
import { 
  Shield, User, Users, Settings, BarChart3, 
  UserPlus, Edit, Trash2, X, Check, Plus, 
  Home, Key, Globe, MessageCircle, ArrowRightLeft
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';

type TabType = 'dashboard' | 'staff' | 'admin' | 'roles' | 'settings' | 'sessions';

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

interface StaffData {
  id: number;
  username: string;
  email: string | null;
  name: string | null;
  role: string;
  status: string;
  created_at: number;
  business_id: number;
}

interface RoleData {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  created_at: number;
}

interface StatCard {
  title: string;
  value: number;
  icon: typeof User;
  color: string;
}

interface UserFormData {
  username: string;
  password: string;
  email: string;
  name: string;
  role: string;
  business_id: number;
}

interface RoleFormData {
  name: string;
  description: string;
  permissions: string[];
}

interface SessionData {
  id: string;
  visitor_name: string;
  status: string;
  task_status: string;
  assigned_staff_id: number | null;
  assigned_staff_name?: string;
  created_at: number;
  last_message_at?: number;
  unread_by_staff: number;
}

export function AdminPage() {
  const { t, locale, setLocale } = useI18n();
  const { siteName: globalSiteName } = useSiteSettings();
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [adminUsers, setAdminUsers] = useState<UserData[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffData[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [statistics, setStatistics] = useState<{
    adminCount: number;
    staffCount: number;
    roleCount: number;
    onlineStaff: number;
  }>({ adminCount: 0, staffCount: 0, roleCount: 0, onlineStaff: 0 });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showUserModal, setShowUserModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | StaffData | null>(null);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    username: '',
    password: '',
    email: '',
    name: '',
    role: 'staff',
    business_id: 1,
  });
  const [roleFormData, setRoleFormData] = useState<RoleFormData>({
    name: '',
    description: '',
    permissions: [],
  });
  const [formError, setFormError] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<{
    siteName: string;
    defaultLanguage: string;
    enableAuth: boolean;
  }>({
    siteName: '在线客服系统',
    defaultLanguage: 'zh-CN',
    enableAuth: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const supportedLocales = [
    { code: 'zh-CN', nativeName: '中文' },
    { code: 'en-US', nativeName: 'English' },
  ];

  const allPermissions = [
    { key: 'admin_view', label: '查看管理后台' },
    { key: 'admin_edit', label: '编辑管理员' },
    { key: 'staff_view', label: '查看商家' },
    { key: 'staff_edit', label: '编辑商家' },
    { key: 'role_view', label: '查看角色' },
    { key: 'role_edit', label: '编辑角色' },
    { key: 'settings', label: '系统设置' },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  // Override global overflow:hidden to allow scrolling on admin page
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');

    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    const prevRoot = root?.style.overflow;

    html.style.overflow = 'auto';
    body.style.overflow = 'auto';
    if (root) root.style.overflow = 'auto';

    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
      if (root) root.style.overflow = prevRoot || '';
    };
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      window.location.href = '/adminlogin';
      return;
    }
    await loadData();
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      
      const [adminRes, staffRes, roleRes, settingsRes, onlineStaffRes, sessionsRes] = await Promise.all([
        fetch('/api/admin-auth/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/staff-users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/online-staff', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/chat/sessions?limit=100', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [adminData, staffData, roleData, settingsData, onlineStaffData, sessionsData] = await Promise.all([
        adminRes.json(),
        staffRes.json(),
        roleRes.json(),
        settingsRes.json(),
        onlineStaffRes.json(),
        sessionsRes.json(),
      ]);

      if (adminData.success) setAdminUsers(adminData.data);
      if (staffData.success) setStaffUsers(staffData.data);
      if (roleData.success) setRoles(roleData.data);
      if (sessionsData.success && sessionsData.data) {
        // Enrich sessions with staff names
        const enrichedSessions = sessionsData.data.map((session: SessionData) => {
          const staff = staffData.success ? staffData.data.find((s: StaffData) => s.id === session.assigned_staff_id) : null;
          return {
            ...session,
            assigned_staff_name: staff ? (staff.name || staff.username) : null,
          };
        });
        setSessions(enrichedSessions);
      }
      
      if (settingsData.success) {
        const data = settingsData.data;
        setSettings({
          siteName: data.siteName?.value || data.site_name?.value || '在线客服系统',
          defaultLanguage: data.defaultLanguage?.value || data.default_language?.value || 'zh-CN',
          enableAuth: (data.enableAuth?.value || data.enable_auth?.value || 'true') === 'true',
        });
      }

      setStatistics({
        adminCount: adminData.success ? adminData.data.length : 0,
        staffCount: staffData.success ? staffData.data.length : 0,
        roleCount: roleData.success ? roleData.data.length : 0,
        onlineStaff: onlineStaffData.success ? onlineStaffData.data : 0,
      });
    } catch (err) {
      setError(t('load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_token_expires');
    localStorage.removeItem('admin_username');
    window.location.href = '/adminlogin';
  };

  const handleSaveSettings = async () => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          site_name: settings.siteName,
          default_language: settings.defaultLanguage,
          enable_auth: settings.enableAuth.toString(),
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        alert(t('save_ok'));
      } else {
        setError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  // Admin User Management
  const handleCreateAdmin = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', email: '', name: '', role: 'admin' });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleEditAdmin = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      name: user.name || '',
      role: user.role,
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleDeleteAdmin = async (id: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin-auth/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setAdminUsers(adminUsers.filter(u => u.id !== id));
        setStatistics(prev => ({ ...prev, adminCount: prev.adminCount - 1 }));
      } else {
        setError(data.error || t('delete_failed'));
      }
    } catch (err) {
      setError(t('delete_failed'));
    } finally {
      setFormLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleSubmitAdmin = async (e: React.FormEvent) => {
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
        status: 'active',
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
        setShowUserModal(false);
        loadData();
      } else {
        setFormError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setFormError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  // Staff User Management
  const handleCreateStaff = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', email: '', name: '', role: 'admin' });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleEditStaff = (user: StaffData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      email: user.email || '',
      name: user.name || '',
      role: user.role,
      business_id: user.business_id || 1,
    });
    setFormError(null);
    setShowUserModal(true);
  };

  const handleDeleteStaff = async (id: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/staff-users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setStaffUsers(staffUsers.filter(u => u.id !== id));
        setStatistics(prev => ({ ...prev, staffCount: prev.staffCount - 1 }));
      } else {
        setError(data.error || t('delete_failed'));
      }
    } catch (err) {
      setError(t('delete_failed'));
    } finally {
      setFormLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleSubmitStaff = async (e: React.FormEvent) => {
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
        ? `/api/admin/staff-users/${editingUser.id}` 
        : '/api/admin/staff-users';
      const method = editingUser ? 'PUT' : 'POST';

      const body: any = {
        username: formData.username,
        email: formData.email || undefined,
        name: formData.name || undefined,
        role: formData.role,
        status: 'active',
      };

      // Only include business_id when creating a new staff user, not when editing
      if (activeTab === 'staff' && !editingUser) {
        body.business_id = formData.business_id;
      }

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
        setShowUserModal(false);
        loadData();
      } else {
        setFormError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setFormError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  // Role Management
  const handleCreateRole = () => {
    setEditingRole(null);
    setRoleFormData({ name: '', description: '', permissions: [] });
    setFormError(null);
    setShowRoleModal(true);
  };

  const handleEditRole = (role: RoleData) => {
    setEditingRole(role);
    setRoleFormData({
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
    setFormError(null);
    setShowRoleModal(true);
  };

  const handleDeleteRole = async (id: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`/api/admin/roles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setRoles(roles.filter(r => r.id !== id));
        setStatistics(prev => ({ ...prev, roleCount: prev.roleCount - 1 }));
      } else {
        setError(data.error || t('delete_failed'));
      }
    } catch (err) {
      setError(t('delete_failed'));
    } finally {
      setFormLoading(false);
      setDeleteConfirm(null);
    }
  };

  const handleSubmitRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!roleFormData.name.trim()) {
      setFormError(t('please_enter_name'));
      return;
    }

    setFormLoading(true);

    try {
      const token = localStorage.getItem('admin_token');
      const url = editingRole 
        ? `/api/admin/roles/${editingRole.id}` 
        : '/api/admin/roles';
      const method = editingRole ? 'PUT' : 'POST';

      const body = {
        name: roleFormData.name,
        description: roleFormData.description || undefined,
        permissions: roleFormData.permissions,
      };

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
        setShowRoleModal(false);
        loadData();
      } else {
        setFormError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setFormError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const togglePermission = (permissionKey: string) => {
    setRoleFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionKey)
        ? prev.permissions.filter(p => p !== permissionKey)
        : [...prev.permissions, permissionKey],
    }));
  };

  // Styles
  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    display: 'flex',
    flexDirection: 'column',
  };

  const headerStyle: React.CSSProperties = {
    backgroundColor: '#001529',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    color: '#fff',
    flexWrap: 'wrap',
    gap: '16px',
  };

  const navStyle: React.CSSProperties = {
    backgroundColor: '#002140',
    padding: '0 24px',
    borderBottom: '1px solid #001529',
  };

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '14px 20px',
    color: active ? '#fff' : '#8b9dc3',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? 500 : 400,
    borderBottom: active ? '2px solid #1890ff' : '2px solid transparent',
    transition: 'all 0.2s',
    gap: '8px',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.05)',
      color: '#fff',
    },
  });

  const containerStyle: React.CSSProperties = {
    flex: 1,
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    padding: '24px',
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '24px',
    marginBottom: '24px',
  };

  const statCardStyle: React.CSSProperties = {
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
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
    fontSize: '13px',
  };

  const tdStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
    fontSize: '14px',
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
    transition: 'all 0.2s',
    ...(variant === 'primary' && {
      backgroundColor: '#1890ff',
      color: '#fff',
      '&:hover': { backgroundColor: '#40a9ff' },
    }),
    ...(variant === 'danger' && {
      backgroundColor: '#ff4d4f',
      color: '#fff',
      '&:hover': { backgroundColor: '#ff7875' },
    }),
    ...(variant === 'default' && {
      backgroundColor: '#f0f0f0',
      color: '#666',
      '&:hover': { backgroundColor: '#e8e8e8' },
    }),
  });

  const badgeStyle = (status: string): React.CSSProperties => ({
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: status === 'active' ? '#f6ffed' : '#fff1f0',
    color: status === 'active' ? '#52c41a' : '#ff4d4f',
    border: `1px solid ${status === 'active' ? '#b7eb8f' : '#ffa39e'}`,
    display: 'inline-block',
  });

  const roleBadgeStyle: React.CSSProperties = {
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    backgroundColor: '#e6f7ff',
    color: '#1890ff',
    border: '1px solid #91d5ff',
    display: 'inline-block',
  };

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
    position: 'relative',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d9d9d9',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
    marginBottom: '12px',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    color: '#333',
    fontWeight: 500,
  };

  const statIconStyle = (color: string): React.CSSProperties => ({
    width: '56px',
    height: '56px',
    borderRadius: '12px',
    backgroundColor: `${color}20`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color,
  });

  // 角色中文映射
  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: '管理员',
      staff: '客服',
    };
    return roleMap[role] || role;
  };

  const navItems = [
    { key: 'dashboard' as const, label: t('dashboard'), icon: Home },
    { key: 'staff' as const, label: t('staff_management'), icon: Users },
    { key: 'admin' as const, label: t('admin_management'), icon: User },
    { key: 'roles' as const, label: t('role_management'), icon: Key },
    { key: 'sessions' as const, label: '会话管理', icon: MessageCircle },
    { key: 'settings' as const, label: t('settings'), icon: Settings },
  ];

  const statCards: StatCard[] = [
    { title: t('admin_count'), value: statistics.adminCount, icon: Shield, color: '#1890ff' },
    { title: t('staff_count'), value: statistics.staffCount, icon: Users, color: '#52c41a' },
    { title: t('role_count'), value: statistics.roleCount, icon: Key, color: '#722ed1' },
    { title: t('online_staff'), value: statistics.onlineStaff, icon: Globe, color: '#fa8c16' },
  ];

  if (loading) {
    return (
      <div style={{ ...pageStyle, alignItems: 'center', justifyContent: 'center' }}>
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

  const renderDashboard = () => (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '24px' }}>{t('dashboard')}</h1>
      
      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {statCards.map((stat) => (
          <div key={stat.title} style={statCardStyle}>
            <div style={statIconStyle(stat.color)}>
              <stat.icon size={28} />
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 600, color: '#1f2937' }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>{stat.title}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px' }}>{t('quick_actions')}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <button 
            onClick={() => setActiveTab('staff')}
            style={{ 
              ...buttonStyle('default'), 
              padding: '16px', 
              justifyContent: 'flex-start',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Users size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('manage_staff')}</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('view_edit_staff')}</div>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('admin')}
            style={{ 
              ...buttonStyle('default'), 
              padding: '16px', 
              justifyContent: 'flex-start',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
            }}
          >
            <User size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('manage_admins')}</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('view_edit_admins')}</div>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('roles')}
            style={{ 
              ...buttonStyle('default'), 
              padding: '16px', 
              justifyContent: 'flex-start',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Key size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('manage_roles')}</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('view_edit_roles')}</div>
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            style={{ 
              ...buttonStyle('default'), 
              padding: '16px', 
              justifyContent: 'flex-start',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Settings size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('system_settings')}</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('configure_system')}</div>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Staff */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px' }}>{t('recent_staff')}</h2>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>{t('username')}</th>
              <th style={thStyle}>{t('name')}</th>
              <th style={thStyle}>{t('role')}</th>
              <th style={thStyle}>{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {staffUsers.slice(0, 5).map((user) => (
              <tr key={user.id}>
                <td style={tdStyle}>{user.username}</td>
                <td style={tdStyle}>{user.name || '-'}</td>
                <td style={tdStyle}><span style={roleBadgeStyle}>{getRoleLabel(user.role)}</span></td>
                <td style={tdStyle}><span style={badgeStyle(user.status)}>{user.status === 'active' ? t('active') : t('inactive')}</span></td>
              </tr>
            ))}
            {staffUsers.length === 0 && (
              <tr>
                <td colSpan={4} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                  {t('no_data')}
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderStaffManagement = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('staff_management')}</h1>
        <button onClick={handleCreateStaff} style={buttonStyle('primary')}>
          <UserPlus size={16} />
          {t('add_staff')}
        </button>
      </div>

      <div style={cardStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>{t('username')}</th>
              <th style={thStyle}>{t('name')}</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>商家</th>
              <th style={thStyle}>{t('role')}</th>
              <th style={thStyle}>{t('status')}</th>
              <th style={thStyle}>{t('created_at')}</th>
              <th style={thStyle}>{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {staffUsers.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                  {t('no_data')}
                </td>
              </tr>
            ) : (
              staffUsers.map((user) => {
                // Use business_name from backend (already joined with staff_users table)
                const businessName = user.business_id === 0 
                  ? (user as any)?.business_name || '商家主账号'
                  : (user as any)?.business_name || '未分配';
                return (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.id}</td>
                  <td style={tdStyle}>{user.username}</td>
                  <td style={tdStyle}>{user.name || '-'}</td>
                  <td style={tdStyle}>{user.email || '-'}</td>
                  <td style={tdStyle}>{businessName}</td>
                  <td style={tdStyle}><span style={roleBadgeStyle}>{getRoleLabel(user.role)}</span></td>
                  <td style={tdStyle}><span style={badgeStyle(user.status)}>{user.status === 'active' ? t('active') : t('inactive')}</span></td>
                  <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleEditStaff(user)} 
                        style={buttonStyle('default')}
                        title={t('edit')}
                      >
                        <Edit size={14} />
                      </button>
                      {deleteConfirm === user.id ? (
                        <>
                          <button 
                            onClick={() => handleDeleteStaff(user.id)} 
                            style={buttonStyle('danger')}
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
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAdminManagement = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('admin_management')}</h1>
        <button onClick={handleCreateAdmin} style={buttonStyle('primary')}>
          <UserPlus size={16} />
          {t('add_admin')}
        </button>
      </div>

      <div style={cardStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>{t('username')}</th>
              <th style={thStyle}>{t('name')}</th>
              <th style={thStyle}>Email</th>
              <th style={thStyle}>{t('status')}</th>
              <th style={thStyle}>{t('created_at')}</th>
              <th style={thStyle}>{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {adminUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                  {t('no_data')}
                </td>
              </tr>
            ) : (
              adminUsers.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.id}</td>
                  <td style={tdStyle}>{user.username}</td>
                  <td style={tdStyle}>{user.name || '-'}</td>
                  <td style={tdStyle}>{user.email || '-'}</td>
                  <td style={tdStyle}><span style={badgeStyle(user.status)}>{user.status === 'active' ? t('active') : t('inactive')}</span></td>
                  <td style={tdStyle}>{new Date(user.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => handleEditAdmin(user)} 
                        style={buttonStyle('default')}
                        title={t('edit')}
                      >
                        <Edit size={14} />
                      </button>
                      {deleteConfirm === user.id ? (
                        <>
                          <button 
                            onClick={() => handleDeleteAdmin(user.id)} 
                            style={buttonStyle('danger')}
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
  );

  const renderRoleManagement = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('role_management')}</h1>
        <button onClick={handleCreateRole} style={buttonStyle('primary')}>
          <Plus size={16} />
          {t('add_role')}
        </button>
      </div>

      <div style={cardStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>{t('name')}</th>
              <th style={thStyle}>{t('description')}</th>
              <th style={thStyle}>{t('permissions')}</th>
              <th style={thStyle}>{t('created_at')}</th>
              <th style={thStyle}>{t('action')}</th>
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>
                  {t('no_data')}
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.id}>
                  <td style={tdStyle}>{role.id}</td>
                  <td style={tdStyle}>{role.name}</td>
                  <td style={tdStyle}>{role.description || '-'}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {role.permissions.map((p) => (
                        <span key={p} style={{ ...roleBadgeStyle, fontSize: '11px' }}>
                          {allPermissions.find(perm => perm.key === p)?.label || p}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={tdStyle}>{new Date(role.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {role.is_system ? (
                        <span style={{ color: '#999', fontSize: '12px' }}>{t('system_role')}</span>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEditRole(role)} 
                            style={buttonStyle('default')}
                            title={t('edit')}
                          >
                            <Edit size={14} />
                          </button>
                          {deleteConfirm === role.id ? (
                            <>
                              <button 
                                onClick={() => handleDeleteRole(role.id)} 
                                style={buttonStyle('danger')}
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
                              onClick={() => setDeleteConfirm(role.id)} 
                              style={buttonStyle('danger')}
                              title={t('delete')}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
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
  );

  const renderSessionManagement = () => {
    const formatTime = (timestamp: number) => {
      return new Date(timestamp).toLocaleString('zh-CN');
    };

    const getStatusText = (status: string) => {
      const statusMap: Record<string, string> = {
        active: '活跃',
        closed: '已关闭',
        pending: '等待中',
      };
      return statusMap[status] || status;
    };

    const getTaskStatusText = (taskStatus: string) => {
      const taskStatusMap: Record<string, string> = {
        requirement_discussion: '需求讨论',
        requirement_confirmed: '需求确认',
        in_progress: '进行中',
        delivered: '已交付',
        reviewed: '已评价',
      };
      return taskStatusMap[taskStatus] || taskStatus;
    };

    return (
      <div>
        <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '24px' }}>会话管理</h1>

        <div style={cardStyle}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 500 }}>所有会话 ({sessions.length})</h2>
            <button
              onClick={loadData}
              style={{ ...buttonStyle('primary'), padding: '6px 12px', fontSize: '13px' }}
            >
              刷新
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f0f0f0' }}>
                  <th style={thStyle}>访客名称</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>任务阶段</th>
                  <th style={thStyle}>归属客服</th>
                  <th style={thStyle}>未读消息</th>
                  <th style={thStyle}>创建时间</th>
                  <th style={thStyle}>最后消息</th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                      暂无会话数据
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr key={session.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={tdStyle}>{session.visitor_name}</td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: session.status === 'active' ? '#f6ffed' : '#f5f5f5',
                            color: session.status === 'active' ? '#52c41a' : '#999',
                          }}
                        >
                          {getStatusText(session.status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            backgroundColor: '#e6f7ff',
                            color: '#1890ff',
                          }}
                        >
                          {getTaskStatusText(session.task_status)}
                        </span>
                      </td>
                      <td style={tdStyle}>
                        {session.assigned_staff_name ? (
                          <span style={{ color: '#52c41a', fontWeight: 500 }}>
                            {session.assigned_staff_name}
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>未分配</span>
                        )}
                      </td>
                      <td style={tdStyle}>
                        {session.unread_by_staff > 0 ? (
                          <span
                            style={{
                              backgroundColor: '#ff4d4f',
                              color: '#fff',
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '12px',
                            }}
                          >
                            {session.unread_by_staff}
                          </span>
                        ) : (
                          <span style={{ color: '#999' }}>0</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: '#999' }}>
                        {formatTime(session.created_at)}
                      </td>
                      <td style={{ ...tdStyle, fontSize: '12px', color: '#999' }}>
                        {session.last_message_at ? formatTime(session.last_message_at) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div>
      <h1 style={{ fontSize: '20px', fontWeight: 500, marginBottom: '24px' }}>{t('settings')}</h1>

      <div style={cardStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '24px' }}>{t('system_settings')}</h2>
        
        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('site_name')}</label>
            <input 
              type="text" 
              value={settings.siteName}
              onChange={(e) => setSettings(prev => ({ ...prev, siteName: e.target.value }))}
              style={inputStyle}
              placeholder={t('enter_site_name')}
            />
          </div>
          
          <div>
            <label style={labelStyle}>{t('default_language')}</label>
            <select 
              value={settings.defaultLanguage}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultLanguage: e.target.value }))}
              style={inputStyle}
            >
              <option value="zh-CN">中文</option>
              <option value="en-US">English</option>
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>{t('enable_auth')}</label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="radio" 
                  name="auth" 
                  checked={settings.enableAuth}
                  onChange={() => setSettings(prev => ({ ...prev, enableAuth: true }))}
                />
                {t('yes')}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="radio" 
                  name="auth" 
                  checked={!settings.enableAuth}
                  onChange={() => setSettings(prev => ({ ...prev, enableAuth: false }))}
                />
                {t('no')}
              </label>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <button 
              onClick={handleSaveSettings}
              disabled={formLoading}
              style={{ 
                ...buttonStyle('primary'),
                opacity: formLoading ? 0.6 : 1,
                cursor: formLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {formLoading ? t('saving') : t('save_settings')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Shield size={24} />
          <span style={{ fontSize: '18px', fontWeight: 500 }}>{settings.siteName || globalSiteName || t('admin_panel')}</span>
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

      {/* Navigation */}
      <div style={navStyle}>
        {navItems.map((item) => (
          <span 
            key={item.key}
            onClick={() => setActiveTab(item.key)}
            style={navItemStyle(activeTab === item.key)}
          >
            <item.icon size={16} />
            {item.label}
          </span>
        ))}
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

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'staff' && renderStaffManagement()}
        {activeTab === 'admin' && renderAdminManagement()}
        {activeTab === 'roles' && renderRoleManagement()}
        {activeTab === 'sessions' && renderSessionManagement()}
        {activeTab === 'settings' && renderSettings()}
      </div>

      {/* User Modal */}
      {showUserModal && (
        <div style={modalOverlayStyle} onClick={() => setShowUserModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500 }}>
                {editingUser ? t('edit_user') : t('add_user')}
              </h2>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                backgroundColor: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px',
                color: '#ff4d4f',
                fontSize: '14px',
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={editingUser && editingUser.role === 'admin' ? handleSubmitAdmin : handleSubmitStaff}>
              <label style={labelStyle}>{t('username')}</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={inputStyle}
                placeholder={t('enter_username')}
              />

              <label style={labelStyle}>{t('password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={inputStyle}
                placeholder={editingUser ? t('leave_empty_to_keep') : t('enter_password')}
              />

              <label style={labelStyle}>{t('name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder={t('enter_name')}
              />

              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                placeholder="enter email"
              />

              {activeTab === 'staff' ? (
                <>
                  <label style={labelStyle}>{t('role')}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="admin">管理员</option>
                    <option value="staff">客服</option>
                  </select>
                </>
              ) : (
                !editingUser || editingUser.role !== 'admin' && (
                  <>
                    <label style={labelStyle}>{t('role')}</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      style={inputStyle}
                    >
                      <option value="staff">客服</option>
                      <option value="admin">管理员</option>
                    </select>
                  </>
                )
              )}

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowUserModal(false)} style={buttonStyle('default')}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={formLoading} style={{ ...buttonStyle('primary'), opacity: formLoading ? 0.6 : 1 }}>
                  {formLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Modal */}
      {showRoleModal && (
        <div style={modalOverlayStyle} onClick={() => setShowRoleModal(false)}>
          <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500 }}>
                {editingRole ? t('edit_role') : t('add_role')}
              </h2>
              <button onClick={() => setShowRoleModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                backgroundColor: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px',
                color: '#ff4d4f',
                fontSize: '14px',
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitRole}>
              <label style={labelStyle}>{t('name')}</label>
              <input
                type="text"
                value={roleFormData.name}
                onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
                style={inputStyle}
                placeholder={t('enter_role_name')}
              />

              <label style={labelStyle}>{t('description')}</label>
              <textarea
                value={roleFormData.description}
                onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
                style={{ ...inputStyle, minHeight: '80px' }}
                placeholder={t('enter_role_description')}
              />

              <label style={labelStyle}>{t('permissions')}</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {allPermissions.map((perm) => (
                  <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={roleFormData.permissions.includes(perm.key)}
                      onChange={() => togglePermission(perm.key)}
                    />
                    <span style={{ fontSize: '13px' }}>{perm.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button type="button" onClick={() => setShowRoleModal(false)} style={buttonStyle('default')}>
                  {t('cancel')}
                </button>
                <button type="submit" disabled={formLoading} style={{ ...buttonStyle('primary'), opacity: formLoading ? 0.6 : 1 }}>
                  {formLoading ? t('saving') : t('save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
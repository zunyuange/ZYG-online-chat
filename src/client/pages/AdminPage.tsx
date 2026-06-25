/**
 * Admin Page - Complete Management System
 * Dashboard, Staff Management, Admin Management, Role Management, Settings
 */

import { useState, useEffect } from 'react';
import { 
  Shield, User, Users, Settings,
  UserPlus, Edit, Trash2, X, Check, Plus, 
  Home, Key, Globe, Loader2, Zap, Building2, XCircle
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';
import { DomainManager } from '@client/components/staff/DomainManager';

type TabType = 'dashboard' | 'business' | 'staff' | 'admin' | 'roles' | 'settings' | 'domains';

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
  is_system?: boolean;
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
  business_id?: number;
}

interface RoleFormData {
  name: string;
  description: string;
  permissions: string[];
}

interface BusinessData {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: number;
}

interface BusinessFormData {
  name: string;
  description: string;
  username: string;
  password: string;
}

interface BusinessCreateResult {
  success: boolean;
  message: string;
  data?: {
    id: number;
    name: string;
    slug: string;
    chatUrl: string;
    autoDomain: string | null;
    autoDomainError: string | null;
    legacyChatUrl: string;
    workersDevUrl: string;
  };
  error?: string;
}

export function AdminPage() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { siteName: globalSiteName } = useSiteSettings();
  
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [adminUsers, setAdminUsers] = useState<UserData[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffData[]>([]);
  const [roles, setRoles] = useState<RoleData[]>([]);
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
    siteName: '', // will be loaded from settings
    defaultLanguage: 'zh-CN',
    enableAuth: true,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // 🆕 AI Config State
  const [aiConfig, setAiConfig] = useState<{
    aiMode: string;
    cfAccountId: string | null;
    hasToken: boolean;
    monthlyTranslateCount: number;
    monthlyTranslateLimit: number;
    resetDay: number;
  } | null>(null);
  const [aiConfigLoading, setAiConfigLoading] = useState(false);
  const [aiConfigForm, setAiConfigForm] = useState({
    aiMode: 'platform' as string,
    cfAccountId: '',
    cfAiToken: '',
  });
  const [aiConfigMessage, setAiConfigMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 🆕 Business Management State
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [businessForm, setBusinessForm] = useState<BusinessFormData>({
    name: '', description: '', username: '', password: '',
  });
  const [businessFormError, setBusinessFormError] = useState<string | null>(null);
  const [businessResult, setBusinessResult] = useState<BusinessCreateResult | null>(null);

  // 🆕 AI Config Functions
  const loadAiConfig = async () => {
    setAiConfigLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/business/ai-config', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAiConfig(data.data);
        setAiConfigForm({
          aiMode: data.data.aiMode || 'platform',
          cfAccountId: data.data.cfAccountId || '',
          cfAiToken: '',
        });
      }
    } catch (err) {
      console.error('Failed to load AI config:', err);
    } finally {
      setAiConfigLoading(false);
    }
  };

  const handleSaveAiConfig = async () => {
    setAiConfigMessage(null);
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const body: Record<string, string | number> = {
        aiMode: aiConfigForm.aiMode,
      };
      if (aiConfigForm.aiMode === 'own_cf') {
        body.cfAccountId = aiConfigForm.cfAccountId;
        if (aiConfigForm.cfAiToken) {
          body.cfAiToken = aiConfigForm.cfAiToken;
        }
      }
      const res = await fetch('/api/business/ai-config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setAiConfigMessage({ type: 'success', text: t('ai_config_saved') });
        // 清除 token 输入
        setAiConfigForm(prev => ({ ...prev, cfAiToken: '' }));
        loadAiConfig(); // 刷新
      } else {
        setAiConfigMessage({ type: 'error', text: data.error || t('ai_config_save_failed') });
      }
    } catch {
      setAiConfigMessage({ type: 'error', text: t('ai_config_save_failed') });
    } finally {
      setFormLoading(false);
    }
  };

  // 🆕 Business Management Functions
  const loadBusinesses = async () => {
    setBusinessesLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/business/list', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load businesses:', err);
    } finally {
      setBusinessesLoading(false);
    }
  };

  const handleCreateBusiness = () => {
    setBusinessForm({ name: '', description: '', username: '', password: '' });
    setBusinessFormError(null);
    setBusinessResult(null);
    setShowBusinessModal(true);
  };

  const handleSubmitBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessFormError(null);
    setBusinessResult(null);

    if (!businessForm.name.trim()) {
      setBusinessFormError(t('please_enter_name'));
      return;
    }
    if (!businessForm.username.trim()) {
      setBusinessFormError(t('please_enter_username'));
      return;
    }
    if (!businessForm.password.trim()) {
      setBusinessFormError(t('please_enter_password'));
      return;
    }

    setFormLoading(true);

    try {
      const res = await fetch('/api/business/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: businessForm.name.trim(),
          description: businessForm.description.trim(),
          username: businessForm.username.trim(),
          password: businessForm.password,
        }),
      });
      const data: BusinessCreateResult = await res.json();

      if (data.success) {
        setBusinessResult(data);
        loadBusinesses();
      } else {
        setBusinessFormError(data.error || t('operation_failed'));
      }
    } catch (err) {
      setBusinessFormError(t('operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCloseBusinessModal = () => {
    setShowBusinessModal(false);
    setBusinessResult(null);
    setBusinessFormError(null);
  };

  const allPermissions = [
    { key: 'admin_view', label: t('permission_admin_view') },
    { key: 'admin_edit', label: t('permission_admin_edit') },
    { key: 'staff_view', label: t('permission_staff_view') },
    { key: 'staff_edit', label: t('permission_staff_edit') },
    { key: 'role_view', label: t('permission_role_view') },
    { key: 'role_edit', label: t('permission_role_edit') },
    { key: 'settings', label: t('permission_settings') },
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  // 🆕 DomainManager 组件内部自行管理数据加载，无需在此触发

  // 🆕 切换到设置Tab时自动加载AI配置
  useEffect(() => {
    if (activeTab === 'settings' && !loading) {
      loadAiConfig();
    }
  }, [activeTab, loading]);

  // 🆕 切换到商家管理Tab时自动加载商家列表
  useEffect(() => {
    if (activeTab === 'business' && !loading) {
      loadBusinesses();
    }
  }, [activeTab, loading]);

  // ★ 定期向服务端发送心跳，保持客服在线状态
  // 管理后台没有 SSE 连接，需要主动 ping 来更新 last_active
  useEffect(() => {
    // 只在数据加载完成后（即认证通过）才启动心跳
    if (loading) return;

    const pingInterval = setInterval(async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        await fetch('/api/staff/ping', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // 静默失败，ping 不是关键操作
      }
    }, 120000); // 每 2 分钟 ping 一次（在线阈值是 5 分钟）

    return () => clearInterval(pingInterval);
  }, [loading]);

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
      
      const [adminRes, staffRes, roleRes, settingsRes, onlineStaffRes] = await Promise.all([
        fetch('/api/admin-auth/users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/staff-users', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/roles', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/online-staff', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      const [adminData, staffData, roleData, settingsData, onlineStaffData] = await Promise.all([
        adminRes.json(),
        staffRes.json(),
        roleRes.json(),
        settingsRes.json(),
        onlineStaffRes.json(),
      ]);

      if (adminData.success) setAdminUsers(adminData.data);
      if (staffData.success) setStaffUsers(staffData.data);
      if (roleData.success) setRoles(roleData.data);
      
      if (settingsData.success) {
        const data = settingsData.data;
        setSettings({
          siteName: data.siteName?.value || data.site_name?.value || t('default_site_name'),
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
    display: 'flex',
    flexWrap: 'nowrap',
    overflowX: 'auto',
    scrollbarWidth: 'thin',
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
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as React.CSSProperties);

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

  // Role label mapping
  const getRoleLabel = (role: string): string => {
    const roleMap: Record<string, string> = {
      admin: t('admin_role_admin'),
      staff: t('admin_role_staff'),
    };
    return roleMap[role] || role;
  };

  const navItems = [
    { key: 'dashboard' as const, label: t('dashboard'), icon: Home },
    { key: 'business' as const, label: t('business_management') || '商家管理', icon: Building2 },
    { key: 'staff' as const, label: t('staff_management'), icon: Users },
    { key: 'admin' as const, label: t('admin_management'), icon: User },
    { key: 'roles' as const, label: t('role_management'), icon: Key },
    { key: 'domains' as const, label: t('domain_management'), icon: Globe },
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
            onClick={() => setActiveTab('domains')}
            style={{ 
              ...buttonStyle('default'), 
              padding: '16px', 
              justifyContent: 'flex-start',
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
            }}
          >
            <Globe size={20} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>{t('manage_domains')}</div>
              <div style={{ fontSize: '12px', opacity: 0.6 }}>{t('view_edit_domains')}</div>
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
              <th style={thStyle}>{t('admin_table_business')}</th>
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
                  ? (user as any)?.business_name || t('staff_primary_account')
                  : (user as any)?.business_name || t('unassigned');
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
              <option value="zh-CN">{t('lang_zh_CN')}</option>
              <option value="en-US">{t('lang_en_US')}</option>
              <option value="tc">{t('lang_tc')}</option>
              <option value="jp">{t('lang_jp')}</option>
              <option value="kr">{t('lang_kr')}</option>
              <option value="es">{t('lang_es')}</option>
              <option value="fr">{t('lang_fr')}</option>
              <option value="it">{t('lang_it')}</option>
              <option value="de">{t('lang_de')}</option>
              <option value="pt">{t('lang_pt')}</option>
              <option value="vi">{t('lang_vi')}</option>
              <option value="ru">{t('lang_ru')}</option>
              <option value="id">{t('lang_id')}</option>
              <option value="th">{t('lang_th')}</option>
              <option value="ar">{t('lang_ar')}</option>
              <option value="el">{t('lang_el')}</option>
              <option value="pl">{t('lang_pl')}</option>
              <option value="da">{t('lang_da')}</option>
              <option value="nl">{t('lang_nl')}</option>
              <option value="fi">{t('lang_fi')}</option>
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

      {/* 🆕 AI 翻译配置 */}
      <div style={cardStyle}>
        <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} style={{ color: '#722ed1' }} />
          {t('ai_config')}
        </h2>
        <p style={{ fontSize: '13px', color: '#999', marginBottom: '20px' }}>{t('ai_config_desc')}</p>

        {aiConfigLoading ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#999' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p>{t('loading')}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '20px' }}>
            {/* AI 模式选择 */}
            <div>
              <label style={labelStyle}>{t('ai_mode_label')}</label>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAiConfigForm(prev => ({ ...prev, aiMode: 'platform' }))}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '8px',
                    border: aiConfigForm.aiMode === 'platform' ? '2px solid #1890ff' : '1px solid #d9d9d9',
                    backgroundColor: aiConfigForm.aiMode === 'platform' ? '#e6f7ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px', color: '#333' }}>
                    🏢 {t('ai_platform_mode')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{t('ai_mode_platform_desc')}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setAiConfigForm(prev => ({ ...prev, aiMode: 'own_cf' }))}
                  style={{
                    flex: 1,
                    padding: '16px',
                    borderRadius: '8px',
                    border: aiConfigForm.aiMode === 'own_cf' ? '2px solid #722ed1' : '1px solid #d9d9d9',
                    backgroundColor: aiConfigForm.aiMode === 'own_cf' ? '#f9f0ff' : '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontWeight: 500, fontSize: '14px', marginBottom: '4px', color: '#333' }}>
                    ☁️ {t('ai_own_cf_mode')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{t('ai_mode_own_cf_desc')}</div>
                </button>
              </div>
            </div>

            {/* 自有CF AI 配置 */}
            {aiConfigForm.aiMode === 'own_cf' && (
              <>
                <div>
                  <label style={labelStyle}>{t('ai_cf_account_id')}</label>
                  <input
                    type="text"
                    value={aiConfigForm.cfAccountId}
                    onChange={(e) => setAiConfigForm(prev => ({ ...prev, cfAccountId: e.target.value }))}
                    style={inputStyle}
                    placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  />
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>{t('ai_cf_account_id_hint')}</p>
                </div>
                <div>
                  <label style={labelStyle}>{t('ai_cf_api_token')}</label>
                  <input
                    type="password"
                    value={aiConfigForm.cfAiToken}
                    onChange={(e) => setAiConfigForm(prev => ({ ...prev, cfAiToken: e.target.value }))}
                    style={inputStyle}
                    placeholder={aiConfig?.hasToken ? t('ai_cf_token_placeholder') : ''}
                  />
                  <p style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
                    {aiConfig?.hasToken && (
                      <span style={{ color: '#52c41a', marginRight: '12px' }}>✓ {t('ai_token_saved')}</span>
                    )}
                    {t('ai_cf_api_token_hint')}
                  </p>
                </div>
              </>
            )}

            {/* 用量统计 */}
            {aiConfig && (aiConfig.aiMode !== 'platform' || aiConfig.monthlyTranslateCount > 0) && (
              <div style={{
                backgroundColor: '#f5f5f5',
                borderRadius: '8px',
                padding: '16px',
                display: 'flex',
                gap: '24px',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#999', marginBottom: '4px' }}>{t('ai_monthly_quota')}</div>
                  <div style={{ fontSize: '24px', fontWeight: 600, color: '#333' }}>
                    {aiConfig.monthlyTranslateCount.toLocaleString()}
                    <span style={{ fontSize: '14px', fontWeight: 400, color: '#999' }}> / {aiConfig.monthlyTranslateLimit.toLocaleString()}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '8px',
                    backgroundColor: '#e5e7eb',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min((aiConfig.monthlyTranslateCount / aiConfig.monthlyTranslateLimit) * 100, 100)}%`,
                      backgroundColor: aiConfig.monthlyTranslateCount / aiConfig.monthlyTranslateLimit > 0.8 ? '#ff4d4f' : '#52c41a',
                      borderRadius: '4px',
                      transition: 'width 0.3s',
                    }} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
                    {t('ai_quota_reset_day').replace('{day}', String(aiConfig.resetDay))}
                  </div>
                </div>
              </div>
            )}

            {/* 提示消息 */}
            {aiConfigMessage && (
              <div style={{
                padding: '10px 16px',
                borderRadius: '4px',
                fontSize: '13px',
                backgroundColor: aiConfigMessage.type === 'success' ? '#f6ffed' : '#fff2f0',
                border: `1px solid ${aiConfigMessage.type === 'success' ? '#b7eb8f' : '#ffccc7'}`,
                color: aiConfigMessage.type === 'success' ? '#52c41a' : '#ff4d4f',
              }}>
                {aiConfigMessage.text}
              </div>
            )}

            {/* 保存按钮 */}
            <div>
              <button
                onClick={handleSaveAiConfig}
                disabled={formLoading}
                style={{
                  ...buttonStyle('primary'),
                  opacity: formLoading ? 0.6 : 1,
                  cursor: formLoading ? 'not-allowed' : 'pointer',
                }}
              >
                {formLoading ? <Loader2 size={14} className="animate-spin" style={{ marginRight: '8px' }} /> : null}
                {t('ai_save_config')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // 🆕 Business Management Tab
  const renderBusinessManagement = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('business_management') || '商家管理'}</h1>
        <button onClick={handleCreateBusiness} style={buttonStyle('primary')}>
          <Plus size={16} />
          {t('add_business') || '添加商家'}
        </button>
      </div>

      <div style={cardStyle}>
        {businessesLoading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p>{t('loading')}</p>
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
            <Building2 size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>{t('business_no_data') || '暂无商家'}</p>
            <p style={{ fontSize: '14px', marginBottom: '24px' }}>{t('business_create_hint') || '点击上方按钮创建第一个商家'}</p>
          </div>
        ) : (
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>{t('name') || '商家名称'}</th>
                <th style={thStyle}>Slug</th>
                <th style={thStyle}>{t('description') || '描述'}</th>
                <th style={thStyle}>{t('created_at') || '创建时间'}</th>
                <th style={thStyle}>{t('domain_url') || '三级域名'}</th>
              </tr>
            </thead>
            <tbody>
              {businesses.map((biz) => (
                <tr key={biz.id}>
                  <td style={tdStyle}>{biz.id}</td>
                  <td style={tdStyle}><strong>{biz.name}</strong></td>
                  <td style={tdStyle}>
                    <code style={{ backgroundColor: '#f5f5f5', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                      {biz.slug}
                    </code>
                  </td>
                  <td style={tdStyle}>{biz.description || '-'}</td>
                  <td style={tdStyle}>{new Date(biz.created_at).toLocaleDateString()}</td>
                  <td style={tdStyle}>
                    <a
                      href={`https://${biz.slug}.zygonlinechat.zygmail.icu`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1890ff', fontSize: '13px' }}
                    >
                      {biz.slug}.zygonlinechat.zygmail.icu
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 提示信息 */}
      <div style={{ ...cardStyle, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
        <p style={{ fontSize: '13px', color: '#52c41a', margin: 0 }}>
          ✅ {t('business_auto_domain_hint') || '创建商家时，系统会自动为其生成专属三级子域名 (slug.zygonlinechat.zygmail.icu)，无需额外配置。'}
        </p>
      </div>
    </div>
  );

  // 🆕 Domain Management Tab - using shared DomainManager component
  const renderDomains = () => (
    <DomainManager
      businessId={1}
      authToken={localStorage.getItem('admin_token') || ''}
      t={t as any}
      isPlatformAdmin={true}
    />
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
        {activeTab === 'business' && renderBusinessManagement()}
        {activeTab === 'staff' && renderStaffManagement()}
        {activeTab === 'admin' && renderAdminManagement()}
        {activeTab === 'roles' && renderRoleManagement()}
        {activeTab === 'domains' && renderDomains()}
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
                placeholder={t('staff_mgmt_username_placeholder')}
              />

              <label style={labelStyle}>{t('password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                style={inputStyle}
                placeholder={editingUser ? t('staff_mgmt_password_leave_empty') : t('staff_mgmt_password_placeholder')}
              />

              <label style={labelStyle}>{t('name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={inputStyle}
                placeholder={t('staff_mgmt_name_placeholder')}
              />

              <label style={labelStyle}>{t('email') || 'Email'}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={inputStyle}
                placeholder={t('please_enter_email')}
              />

              {activeTab === 'staff' ? (
                <>
                  <label style={labelStyle}>{t('role')}</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="admin">{t('admin_role_admin')}</option>
                    <option value="staff">{t('admin_role_staff')}</option>
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
                      <option value="staff">{t('role_staff')}</option>
                      <option value="admin">{t('role_admin')}</option>
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

      {/* 🆕 Business Creation Modal */}
      {showBusinessModal && (
        <div style={modalOverlayStyle} onClick={handleCloseBusinessModal}>
          <div style={{ ...modalStyle, maxWidth: businessResult ? '580px' : '500px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500 }}>
                {t('add_business') || '添加商家'}
              </h2>
              <button onClick={handleCloseBusinessModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            {/* 结果展示 */}
            {businessResult ? (
              <div>
                {businessResult.success ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{
                      width: '64px', height: '64px', borderRadius: '50%',
                      backgroundColor: '#f6ffed', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', margin: '0 auto 16px',
                    }}>
                      <Check size={32} color="#52c41a" />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px', color: '#52c41a' }}>
                      {t('business_created') || '商家创建成功'}
                    </h3>
                    {businessResult.data && (
                      <div style={{ textAlign: 'left', backgroundColor: '#f9f9f9', borderRadius: '8px', padding: '16px', marginTop: '16px' }}>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#999', fontSize: '13px' }}>{t('name') || '商家名称'}: </span>
                          <strong>{businessResult.data.name}</strong>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#999', fontSize: '13px' }}>Slug: </span>
                          <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px' }}>{businessResult.data.slug}</code>
                        </div>
                        {businessResult.data.autoDomain ? (
                          <div style={{ marginBottom: '8px' }}>
                            <span style={{ color: '#999', fontSize: '13px' }}>{t('domain_auto_subdomain') || '专属三级域名'}: </span>
                            <a href={`https://${businessResult.data.autoDomain}`} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
                              {businessResult.data.autoDomain}
                            </a>
                          </div>
                        ) : businessResult.data.autoDomainError && (
                          <div style={{ marginBottom: '8px', color: '#faad14', fontSize: '13px' }}>
                            ⚠️ {t('domain_auto_failed') || '自动生成三级域名失败'}: {businessResult.data.autoDomainError}
                          </div>
                        )}
                        <div style={{ marginBottom: '8px' }}>
                          <span style={{ color: '#999', fontSize: '13px' }}>{t('domain_legacy_url') || '备用URL'}: </span>
                          <code style={{ backgroundColor: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                            {businessResult.data.legacyChatUrl}
                          </code>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={handleCloseBusinessModal}
                      style={{ ...buttonStyle('primary'), marginTop: '24px', padding: '8px 24px' }}
                    >
                      {t('domain_step_finish') || '完成'}
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <XCircle size={48} color="#ff4d4f" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#ff4d4f', marginBottom: '16px' }}>
                      {businessResult.error || t('operation_failed')}
                    </p>
                    <button
                      onClick={() => setBusinessResult(null)}
                      style={buttonStyle('default')}
                    >
                      {t('retry') || '重试'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitBusiness}>
                {businessFormError && (
                  <div style={{
                    backgroundColor: '#fff2f0', border: '1px solid #ffccc7',
                    borderRadius: '4px', padding: '12px', marginBottom: '16px',
                    color: '#ff4d4f', fontSize: '14px',
                  }}>
                    {businessFormError}
                  </div>
                )}

                <label style={labelStyle}>{t('name') || '商家名称'} *</label>
                <input
                  type="text"
                  value={businessForm.name}
                  onChange={(e) => setBusinessForm({ ...businessForm, name: e.target.value })}
                  style={inputStyle}
                  placeholder={t('business_name_input_hint') || '例如: 某某科技'}
                />

                <label style={labelStyle}>{t('description') || '商家描述'}</label>
                <input
                  type="text"
                  value={businessForm.description}
                  onChange={(e) => setBusinessForm({ ...businessForm, description: e.target.value })}
                  style={inputStyle}
                  placeholder={t('business_desc_placeholder') || '可选，商家简要描述'}
                />

                <label style={labelStyle}>{t('username') || '管理员用户名'} *</label>
                <input
                  type="text"
                  value={businessForm.username}
                  onChange={(e) => setBusinessForm({ ...businessForm, username: e.target.value })}
                  style={inputStyle}
                  placeholder={t('business_admin_username_placeholder') || '商家管理员登录用户名'}
                />
                <p style={{ fontSize: '12px', color: '#999', marginTop: '-8px', marginBottom: '12px' }}>
                  {t('business_admin_username_hint') || '此账号将作为该商家的管理员，可管理客服、域名、设置等'}
                </p>

                <label style={labelStyle}>{t('password') || '密码'} *</label>
                <input
                  type="password"
                  value={businessForm.password}
                  onChange={(e) => setBusinessForm({ ...businessForm, password: e.target.value })}
                  style={inputStyle}
                  placeholder={t('staff_mgmt_password_placeholder') || '请输入密码'}
                />

                <div style={{
                  backgroundColor: '#e6f7ff', border: '1px solid #91d5ff',
                  borderRadius: '4px', padding: '10px 12px', marginTop: '12px',
                  fontSize: '12px', color: '#1890ff',
                }}>
                  💡 {t('business_auto_domain_note') || '创建后将自动为商家分配专属三级子域名 (slug.zygonlinechat.zygmail.icu) 和随机 Slug 标识'}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={handleCloseBusinessModal} style={buttonStyle('default')}>
                    {t('cancel')}
                  </button>
                  <button type="submit" disabled={formLoading} style={{ ...buttonStyle('primary'), opacity: formLoading ? 0.6 : 1 }}>
                    {formLoading ? <Loader2 size={14} className="animate-spin" style={{ marginRight: '8px' }} /> : null}
                    {formLoading ? t('saving') : t('add_business') || '创建商家'}
                  </button>
                </div>
              </form>
            )}
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
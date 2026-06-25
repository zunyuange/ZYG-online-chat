/**
 * Admin Page - Complete Management System
 * Dashboard, Staff Management, Admin Management, Role Management, Settings
 */

import { useState, useEffect } from 'react';
import { 
  Shield, User, Users, Settings,
  UserPlus, Edit, Trash2, X, Check, Plus, 
  Home, Key, Globe, Link, Copy, ExternalLink,
  Loader2, AlertCircle, ChevronRight, ChevronLeft,
  Cloud, Server, Zap
} from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';

type TabType = 'dashboard' | 'staff' | 'admin' | 'roles' | 'settings' | 'domains';

type DomainTypeLabel = 'auto_subdomain' | 'custom_cf' | 'custom_external';

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

interface DomainData {
  id: number;
  businessId: number;
  domainType: string;
  domain: string;
  subdomain: string | null;
  domainPlatform: string;
  verificationStatus: string;
  sslStatus: string;
  isPrimary: number;
  status: string;
  createdAt: number;
  updatedAt: number;
  errorMessage?: string;
}

interface DomainBindFormData {
  domain: string;
  platform: string;
  cfApiToken: string;
  step: number; // 1=输入域名, 2=授权(CF)/显示配置(手工), 3=完成
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

  // 🆕 Domain Management State
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [domainBindForm, setDomainBindForm] = useState<DomainBindFormData>({
    domain: '',
    platform: 'cloudflare',
    cfApiToken: '',
    step: 1,
  });
  const [domainModalError, setDomainModalError] = useState<string | null>(null);
  const [domainBindResult, setDomainBindResult] = useState<{
    domain?: string;
    dnsRecord?: { type: string; name: string; value: string };
    verificationStatus?: string;
  } | null>(null);
  const [domainDetachConfirm, setDomainDetachConfirm] = useState<number | null>(null);

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

  const handleSettingsTabEnter = () => {
    if (!aiConfig) {
      loadAiConfig();
    }
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

  // 🆕 切换到域名管理Tab时自动加载
  useEffect(() => {
    if (activeTab === 'domains' && !loading) {
      loadDomains();
    }
  }, [activeTab, loading]);

  // 🆕 切换到设置Tab时自动加载AI配置
  useEffect(() => {
    if (activeTab === 'settings' && !loading) {
      loadAiConfig();
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

  // 🆕 Domain Management Functions
  const loadDomains = async () => {
    setDomainsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch('/api/business/domains', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDomains(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setDomainsLoading(false);
    }
  };

  const handleDomainTabEnter = () => {
    if (domains.length === 0) {
      loadDomains();
    }
  };

  const handleOpenDomainBind = () => {
    setDomainBindForm({ domain: '', platform: 'cloudflare', cfApiToken: '', step: 1 });
    setDomainModalError(null);
    setDomainBindResult(null);
    setShowDomainModal(true);
  };

  const handleDomainModalNext = () => {
    if (domainBindForm.step === 1) {
      if (!domainBindForm.domain.trim()) {
        setDomainModalError(t('domain_input_hint'));
        return;
      }
      if (domainBindForm.platform === 'cloudflare') {
        setDomainBindForm({ ...domainBindForm, step: 2 });
      } else {
        // 手动绑定：直接跳到配置指引步骤（step 2 显示 DNS 配置）
        setDomainBindForm({ ...domainBindForm, step: 2 });
      }
      setDomainModalError(null);
    } else if (domainBindForm.step === 2 && domainBindForm.platform === 'cloudflare') {
      if (!domainBindForm.cfApiToken.trim()) {
        setDomainModalError(t('cf_api_token_hint'));
        return;
      }
      handleBindDomain();
    }
  };

  const handleDomainModalPrev = () => {
    if (domainBindForm.step > 1) {
      setDomainBindForm({ ...domainBindForm, step: domainBindForm.step - 1 });
      setDomainModalError(null);
    }
  };

  const handleBindDomain = async () => {
    setDomainModalError(null);
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const endpoint =
        domainBindForm.platform === 'cloudflare'
          ? '/api/business/domains/bind-cf'
          : '/api/business/domains/bind-manual';

      const body: Record<string, string> = {
        domain: domainBindForm.domain.trim(),
        platform: domainBindForm.platform,
      };
      if (domainBindForm.platform === 'cloudflare' && domainBindForm.cfApiToken) {
        body.cfApiToken = domainBindForm.cfApiToken;
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.success) {
        setDomainBindResult({
          domain: data.domain,
          dnsRecord: data.dnsRecord,
          verificationStatus: data.verificationStatus,
        });
        setDomainBindForm({ ...domainBindForm, step: 3 });
      } else {
        setDomainModalError(data.error || t('domain_bind_failed'));
      }
    } catch (err) {
      setDomainModalError(t('domain_bind_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleVerifyDomain = async (domainId: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/business/domains/${domainId}/verify`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        setError(null);
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDetachDomain = async (domainId: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/business/domains/${domainId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDomainDetachConfirm(null);
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleSetPrimaryDomain = async (domainId: number) => {
    setFormLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`/api/business/domains/${domainId}/primary`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      if (data.success) {
        loadDomains();
      } else {
        setError(data.error || t('domain_operation_failed'));
      }
    } catch {
      setError(t('domain_operation_failed'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const handleCloseDomainModal = () => {
    setShowDomainModal(false);
    setDomainBindForm({ domain: '', platform: 'cloudflare', cfApiToken: '', step: 1 });
    setDomainModalError(null);
    setDomainBindResult(null);
    loadDomains(); // 刷新列表
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

  // 🆕 Domain Management Tab
  const renderDomains = () => {
    const autoDomains = domains.filter(d => d.domainType === 'auto_subdomain');
    const customDomains = domains.filter(d => d.domainType !== 'auto_subdomain');

    const domainTypeLabel = (type: string): string => {
      const map: Record<string, string> = {
        auto_subdomain: t('domain_auto_subdomain'),
        custom_cf: t('domain_cf_auto'),
        custom_external: t('domain_manual'),
      };
      return map[type] || type;
    };

    const statusBadgeStyle = (status: string): React.CSSProperties => {
      const colorMap: Record<string, { bg: string; color: string; border: string }> = {
        active: { bg: '#f6ffed', color: '#52c41a', border: '#b7eb8f' },
        dns_verified: { bg: '#f6ffed', color: '#52c41a', border: '#b7eb8f' },
        pending: { bg: '#fffbe6', color: '#faad14', border: '#ffe58f' },
        dns_verifying: { bg: '#e6f7ff', color: '#1890ff', border: '#91d5ff' },
        ssl_provisioning: { bg: '#e6f7ff', color: '#1890ff', border: '#91d5ff' },
        failed: { bg: '#fff1f0', color: '#ff4d4f', border: '#ffa39e' },
      };
      const c = colorMap[status] || { bg: '#f5f5f5', color: '#999', border: '#d9d9d9' };
      return {
        padding: '2px 10px',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        display: 'inline-block',
      };
    };

    const statusLabel = (status: string): string => {
      const map: Record<string, string> = {
        active: t('domain_active'),
        pending: t('domain_pending'),
        dns_verifying: t('domain_verifying'),
        dns_verified: t('domain_active'),
        ssl_provisioning: t('domain_ssl_provisioning'),
        failed: t('domain_failed'),
      };
      return map[status] || status;
    };

    const platformLabel = (platform: string): string => {
      const map: Record<string, string> = {
        cloudflare: t('domain_platform_cloudflare'),
        aliyun: t('domain_platform_aliyun'),
        tencent: t('domain_platform_tencent'),
        godaddy: t('domain_platform_godaddy'),
        namesilo: t('domain_platform_namesilo'),
        other: t('domain_platform_other'),
      };
      return map[platform] || platform;
    };

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 500 }}>{t('domain_management')}</h1>
          <button 
            onClick={handleOpenDomainBind}
            style={{ ...buttonStyle('primary'), padding: '8px 20px' }}
          >
            <Plus size={16} /> {t('bind_domain')}
          </button>
        </div>

        {domainsLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
            <p>{t('loading')}</p>
          </div>
        ) : (
          <>
            {/* 平台专属域名（自动生成） */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} /> {t('platform_domain')}
              </h2>
              {autoDomains.length === 0 ? (
                <p style={{ color: '#999', fontSize: '14px' }}>{t('loading')}</p>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('domain_url')}</th>
                      <th style={thStyle}>{t('domain_type')}</th>
                      <th style={thStyle}>{t('domain_status')}</th>
                      <th style={thStyle}></th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>{t('domain_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoDomains.map((d) => (
                      <tr key={d.id} style={{ backgroundColor: d.isPrimary ? '#f6ffed' : 'transparent' }}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <a 
                              href={`https://${d.domain}`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ color: '#1890ff', textDecoration: 'none' }}
                            >
                              {d.domain}
                            </a>
                            <ExternalLink size={14} style={{ color: '#999' }} />
                            <button 
                              onClick={() => handleCopyLink(`https://${d.domain}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                              title={t('copy_link')}
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '13px', color: '#666' }}>
                            {domainTypeLabel(d.domainType)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={statusBadgeStyle(d.verificationStatus)}>
                            {statusLabel(d.verificationStatus)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          {d.isPrimary ? (
                            <span style={{ ...roleBadgeStyle, backgroundColor: '#f6ffed', color: '#52c41a', border: '1px solid #b7eb8f' }}>
                              {t('is_primary')}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleSetPrimaryDomain(d.id)}
                              style={{ ...buttonStyle('default'), fontSize: '12px', padding: '2px 8px' }}
                              disabled={formLoading}
                            >
                              {t('set_as_primary')}
                            </button>
                          )}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button
                            onClick={() => handleCopyLink(`https://${d.domain}`)}
                            style={{ ...buttonStyle('default'), fontSize: '12px', marginRight: '8px' }}
                          >
                            <Copy size={12} /> {t('copy_link')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 自定义域名 */}
            <div style={cardStyle}>
              <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={18} /> {t('custom_domain')}
              </h2>
              {customDomains.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
                  <Link size={40} style={{ marginBottom: '12px', opacity: 0.3 }} />
                  <p>{t('domain_no_custom')}</p>
                </div>
              ) : (
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>{t('domain_url')}</th>
                      <th style={thStyle}>{t('domain_type')}</th>
                      <th style={thStyle}>{t('domain_platform_label')}</th>
                      <th style={thStyle}>{t('domain_status')}</th>
                      <th style={{ ...thStyle, textAlign: 'center' }}>{t('domain_actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customDomains.map((d) => (
                      <tr key={d.id} style={{ backgroundColor: d.isPrimary ? '#f6ffed' : 'transparent' }}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 500 }}>{d.domain}</span>
                            <button 
                              onClick={() => handleCopyLink(`https://${d.domain}`)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                              title={t('copy_link')}
                            >
                              <Copy size={14} />
                            </button>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '13px', color: '#666' }}>
                            {domainTypeLabel(d.domainType)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: '13px', color: '#666' }}>
                            {platformLabel(d.domainPlatform)}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={statusBadgeStyle(d.verificationStatus)}>
                              {statusLabel(d.verificationStatus)}
                            </span>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {d.verificationStatus === 'pending' && (
                              <button
                                onClick={() => handleVerifyDomain(d.id)}
                                style={{ ...buttonStyle('primary'), fontSize: '12px' }}
                                disabled={formLoading}
                              >
                                <Check size={12} /> {t('verify_domain')}
                              </button>
                            )}
                            {!d.isPrimary && d.verificationStatus !== 'pending' && d.verificationStatus !== 'failed' && (
                              <button
                                onClick={() => handleSetPrimaryDomain(d.id)}
                                style={{ ...buttonStyle('default'), fontSize: '12px' }}
                                disabled={formLoading}
                              >
                                {t('set_as_primary')}
                              </button>
                            )}
                            {d.isPrimary && (
                              <span style={{ ...roleBadgeStyle, backgroundColor: '#f6ffed', color: '#52c41a', border: '1px solid #b7eb8f' }}>
                                {t('is_primary')}
                              </span>
                            )}
                            {d.domainType !== 'auto_subdomain' && (
                              <button
                                onClick={() => setDomainDetachConfirm(d.id)}
                                style={{ ...buttonStyle('danger'), fontSize: '12px' }}
                                disabled={formLoading}
                              >
                                <Trash2 size={12} /> {t('detach_domain')}
                              </button>
                            )}
                          </div>
                          {d.errorMessage && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#ff4d4f' }}>
                              <AlertCircle size={12} style={{ verticalAlign: 'middle' }} /> {d.errorMessage}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* 旧版链接提示 */}
            <div style={{ ...cardStyle, backgroundColor: '#fafafa' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> {t('domain_legacy_url')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px', color: '#999' }}>
                {autoDomains.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}>
                      https://zygonlinechat.zygmail.icu/chat?business={autoDomains[0]?.subdomain || '...'}
                    </code>
                    <button 
                      onClick={() => handleCopyLink(`https://zygonlinechat.zygmail.icu/chat?business=${autoDomains[0]?.subdomain || ''}`)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#999' }}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                )}
                <span>{t('domain_workers_dev_url')}: <code style={{ backgroundColor: '#fff', padding: '4px 8px', borderRadius: '4px', border: '1px solid #d9d9d9' }}>zyg-online-chat.linzihai.workers.dev</code></span>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

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

      {/* 🆕 Domain Bind Modal (Step Wizard) */}
      {showDomainModal && (
        <div style={modalOverlayStyle} onClick={handleCloseDomainModal}>
          <div style={{ ...modalStyle, maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500 }}>
                {domainBindForm.platform === 'cloudflare' ? t('bind_cf_domain') : t('bind_manual_domain')}
              </h2>
              <button onClick={handleCloseDomainModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}>
                <X size={20} />
              </button>
            </div>

            {/* Step Indicator */}
            {domainBindForm.step < 3 && (
              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
                {[1, 2].map((s) => (
                  <div key={s} style={{
                    flex: 1,
                    height: '4px',
                    borderRadius: '2px',
                    backgroundColor: domainBindForm.step >= s ? '#1890ff' : '#e5e7eb',
                    transition: 'background-color 0.3s',
                  }} />
                ))}
              </div>
            )}

            {domainModalError && (
              <div style={{
                backgroundColor: '#fff2f0',
                border: '1px solid #ffccc7',
                borderRadius: '4px',
                padding: '12px',
                marginBottom: '16px',
                color: '#ff4d4f',
                fontSize: '14px',
              }}>
                {domainModalError}
              </div>
            )}

            {/* Step 1: 输入域名 */}
            {domainBindForm.step === 1 && (
              <div>
                <label style={{ ...labelStyle, marginBottom: '8px' }}>{t('domain_platform_label')}</label>
                <select
                  value={domainBindForm.platform}
                  onChange={(e) => setDomainBindForm({ ...domainBindForm, platform: e.target.value })}
                  style={{ ...inputStyle, marginBottom: '16px' }}
                >
                  <option value="cloudflare">{t('domain_platform_cloudflare')}</option>
                  <option value="aliyun">{t('domain_platform_aliyun')}</option>
                  <option value="tencent">{t('domain_platform_tencent')}</option>
                  <option value="godaddy">{t('domain_platform_godaddy')}</option>
                  <option value="namesilo">{t('domain_platform_namesilo')}</option>
                  <option value="other">{t('domain_platform_other')}</option>
                </select>

                <label style={labelStyle}>{t('domain_url')}</label>
                <input
                  type="text"
                  value={domainBindForm.domain}
                  onChange={(e) => setDomainBindForm({ ...domainBindForm, domain: e.target.value })}
                  style={inputStyle}
                  placeholder={t('domain_input_placeholder')}
                />
                <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>{t('domain_input_hint')}</p>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={handleCloseDomainModal} style={buttonStyle('default')}>
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDomainModalNext}
                    style={buttonStyle('primary')}
                  >
                    {domainBindForm.platform === 'cloudflare' ? t('domain_step_next') : t('domain_step_next')}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: 授权(CF) / DNS配置指引(手工) */}
            {domainBindForm.step === 2 && (
              <div>
                {domainBindForm.platform === 'cloudflare' ? (
                  <>
                    <label style={labelStyle}>{t('cf_api_token')}</label>
                    <input
                      type="password"
                      value={domainBindForm.cfApiToken}
                      onChange={(e) => setDomainBindForm({ ...domainBindForm, cfApiToken: e.target.value })}
                      style={inputStyle}
                      placeholder="●●●●●●●●●●●●●●●●●●●●"
                    />
                    <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>{t('cf_api_token_hint')}</p>
                    <div style={{
                      backgroundColor: '#e6f7ff',
                      border: '1px solid #91d5ff',
                      borderRadius: '4px',
                      padding: '12px',
                      marginTop: '12px',
                      fontSize: '13px',
                      color: '#1890ff',
                    }}>
                      <strong>{t('cf_api_token_get')}</strong>
                      <ol style={{ margin: '8px 0 0 16px', padding: 0 }}>
                        <li>访问 dash.cloudflare.com → 右上角头像 → My Profile</li>
                        <li>选择 API Tokens 标签 → Create Token</li>
                        <li>权限选择: Zone:DNS:Edit + Account:Read</li>
                        <li>创建后将Token粘贴到上方输入框</li>
                      </ol>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{
                      backgroundColor: '#fffbe6',
                      border: '1px solid #ffe58f',
                      borderRadius: '4px',
                      padding: '16px',
                      marginBottom: '16px',
                    }}>
                      <h3 style={{ fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                        <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        {t('domain_dns_config_guide')}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                        {t('domain_dns_config_desc')}
                      </p>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <tbody>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_type')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              CNAME
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_name')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              {domainBindForm.domain.split('.')[0] || '@'}
                            </td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', fontWeight: 500, backgroundColor: '#fff' }}>
                              {t('domain_dns_value')}
                            </td>
                            <td style={{ padding: '6px 12px', border: '1px solid #f0f0f0', backgroundColor: '#fff', fontFamily: 'monospace' }}>
                              zygonlinechat.zygmail.icu
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginTop: '24px' }}>
                  <button type="button" onClick={handleDomainModalPrev} style={buttonStyle('default')}>
                    <ChevronLeft size={16} /> {t('domain_step_prev')}
                  </button>
                  <button
                    type="button"
                    onClick={handleDomainModalNext}
                    style={buttonStyle('primary')}
                    disabled={formLoading}
                  >
                    {formLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : domainBindForm.platform === 'cloudflare' ? (
                      t('domain_step_bind')
                    ) : (
                      t('domain_step_bind')
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: 绑定完成 */}
            {domainBindForm.step === 3 && domainBindResult && (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#f6ffed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <Check size={32} color="#52c41a" />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '8px' }}>
                  {t('domain_bind_result_title')}
                </h3>
                <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
                  {domainBindResult.domain || domainBindForm.domain}
                </p>

                <div style={{
                  backgroundColor: '#f9f9f9',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '20px',
                  textAlign: 'left',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#666' }}>{t('domain_bind_result_dns')}</span>
                    <span style={statusBadgeStyle('active')}>{t('domain_active')}</span>
                  </div>
                  {domainBindResult.dnsRecord && (
                    <div style={{ fontSize: '12px', color: '#999', padding: '8px', backgroundColor: '#fff', borderRadius: '4px', fontFamily: 'monospace' }}>
                      {domainBindResult.dnsRecord.type} {domainBindResult.dnsRecord.name} → {domainBindResult.dnsRecord.value}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => handleCopyLink(`https://${domainBindResult.domain || domainBindForm.domain}`)}
                    style={buttonStyle('default')}
                  >
                    <Copy size={14} /> {t('copy_link')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseDomainModal}
                    style={buttonStyle('primary')}
                  >
                    {t('domain_step_finish')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🆕 Domain Detach Confirmation Modal */}
      {domainDetachConfirm !== null && (
        <div style={modalOverlayStyle} onClick={() => setDomainDetachConfirm(null)}>
          <div style={{ ...modalStyle, maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <AlertCircle size={48} color="#faad14" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>{t('detach_domain')}</h3>
              <p style={{ fontSize: '14px', color: '#666', marginBottom: '24px' }}>{t('detach_domain_confirm')}</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  onClick={() => setDomainDetachConfirm(null)}
                  style={buttonStyle('default')}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={() => handleDetachDomain(domainDetachConfirm)}
                  style={buttonStyle('danger')}
                  disabled={formLoading}
                >
                  {formLoading ? <Loader2 size={14} className="animate-spin" /> : t('detach_domain')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from 'react';

export interface SiteSettings {
  siteName: string;
  defaultLanguage: string;
  enableAuth: boolean;
}

const defaultSettings: SiteSettings = {
  siteName: '在线客服系统',
  defaultLanguage: 'zh-CN',
  enableAuth: true,
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/settings');
        const data = await response.json();
        
        if (data.success && data.data) {
          const siteData = data.data;
          setSettings({
            siteName: siteData.siteName?.value || siteData.site_name?.value || defaultSettings.siteName,
            defaultLanguage: siteData.defaultLanguage?.value || siteData.default_language?.value || defaultSettings.defaultLanguage,
            enableAuth: (siteData.enableAuth?.value || siteData.enable_auth?.value || 'true') === 'true',
          });
          
          document.title = siteData.siteName?.value || siteData.site_name?.value || defaultSettings.siteName;
        }
      } catch (err) {
        console.error('Failed to fetch site settings:', err);
        setError('Failed to load site settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  return {
    settings,
    siteName: settings.siteName,
    defaultLanguage: settings.defaultLanguage,
    enableAuth: settings.enableAuth,
    loading,
    error,
  };
}
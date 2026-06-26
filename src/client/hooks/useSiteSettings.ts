import { useState, useEffect } from 'react';

export interface SiteSettings {
  siteName: string;
  defaultLanguage: string;
  enableAuth: boolean;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/site-settings');
        const data = await response.json();
        
        if (data.success && data.data) {
          const siteData = data.data;
          const newSettings: SiteSettings = {
            siteName: siteData.site_name?.value || 'CF智能多语言在线客服系统',
            defaultLanguage: siteData.default_language?.value || 'zh-CN',
            enableAuth: (siteData.enable_auth?.value || 'true') === 'true',
          };
          
          setSettings(newSettings);
          document.title = newSettings.siteName;
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
    siteName: settings?.siteName || 'CF智能多语言在线客服系统',
    defaultLanguage: settings?.defaultLanguage || 'zh-CN',
    enableAuth: settings?.enableAuth ?? true,
    loading,
    error,
  };
}
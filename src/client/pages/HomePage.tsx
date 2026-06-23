/**
 * HomePage - 平台首页/功能介绍页面
 * 当访客直接通过域名访问（无business参数）时展示
 * 访客必须通过商家的专属链接（?business=xxx）才能进入客服聊天
 */

import { useEffect } from 'react';
import { I18nProvider } from '@client/context/I18nContext';
import { useI18n } from '@client/context/I18nContext';
import { useSiteSettings } from '@client/hooks/useSiteSettings';
import { MessageCircle, Globe, Shield, Zap, Users, FileText, Link2, Code2, ArrowRight } from 'lucide-react';

function HomeContent() {
  const { t, locale, setLocale, supportedLocales } = useI18n();
  const { siteName } = useSiteSettings();

  const platformName = siteName || t('service_title');
  const currentDomain = typeof window !== 'undefined' ? window.location.hostname : '';

  // Override overflow:hidden to allow scrolling on home page
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

  const features = [
    {
      icon: <MessageCircle size={28} />,
      title: t('home_feature_chat_title'),
      desc: t('home_feature_chat_desc'),
      color: '#1890ff',
    },
    {
      icon: <Globe size={28} />,
      title: t('home_feature_translate_title'),
      desc: t('home_feature_translate_desc'),
      color: '#52c41a',
    },
    {
      icon: <Shield size={28} />,
      title: t('home_feature_isolation_title'),
      desc: t('home_feature_isolation_desc'),
      color: '#722ed1',
    },
    {
      icon: <Zap size={28} />,
      title: t('home_feature_pwa_title'),
      desc: t('home_feature_pwa_desc'),
      color: '#fa8c16',
    },
    {
      icon: <Users size={28} />,
      title: t('home_feature_route_title'),
      desc: t('home_feature_route_desc'),
      color: '#eb2f96',
    },
    {
      icon: <FileText size={28} />,
      title: t('home_feature_visitor_title'),
      desc: t('home_feature_visitor_desc'),
      color: '#13c2c2',
    },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #001529 0%, #002140 40%, #003366 100%)',
        color: '#fff',
        padding: '80px 32px 72px',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Logo / Icon */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #1890ff, #096dd9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 24px rgba(24,144,255,0.3)',
          }}>
            <MessageCircle size={40} color="#fff" />
          </div>

          <h1 style={{
            fontSize: '40px',
            fontWeight: 700,
            margin: '0 0 16px 0',
            letterSpacing: '-0.5px',
          }}>
            {platformName}
          </h1>

          <p style={{
            fontSize: '18px',
            color: 'rgba(255,255,255,0.75)',
            lineHeight: '1.8',
            maxWidth: '600px',
            margin: '0 auto 24px',
          }}>
            {t('home_hero_subtitle')}
          </p>

          {/* Language Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}>
            <Globe size={16} color="rgba(255,255,255,0.55)" />
            <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginRight: '4px' }}>
              {t('home_lang_switch')}:
            </span>
            {supportedLocales?.map((l) => (
              <button
                key={l.code}
                onClick={() => setLocale(l.code as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: locale === l.code ? '1px solid rgba(24,144,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: locale === l.code ? 'rgba(24,144,255,0.15)' : 'transparent',
                  color: locale === l.code ? '#1890ff' : 'rgba(255,255,255,0.65)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontWeight: locale === l.code ? 600 : 400,
                }}
                title={l.name}
              >
                {l.nativeName}
              </button>
            ))}
          </div>

          {/* CTA Button */}
          <a
            href="/docs"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 32px',
              backgroundColor: '#1890ff',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 500,
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(24,144,255,0.4)',
            }}
          >
            {t('home_hero_cta')}
            <ArrowRight size={18} />
          </a>
        </div>
      </div>

      {/* Features Section */}
      <div style={{
        maxWidth: '1040px',
        margin: '0 auto',
        padding: '64px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1a1a2e',
            margin: '0 0 12px 0',
          }}>
            {t('home_features_title')}
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#666',
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            {t('home_features_subtitle')}
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}>
          {features.map((feature, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                padding: '32px 28px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)';
              }}
            >
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: `${feature.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: feature.color,
              }}>
                {feature.icon}
              </div>
              <h3 style={{
                fontSize: '18px',
                fontWeight: 600,
                color: '#1a1a2e',
                margin: '0 0 10px 0',
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '14px',
                color: '#666',
                lineHeight: '1.7',
                margin: 0,
              }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div style={{
        backgroundColor: '#fff',
        padding: '64px 24px',
        borderTop: '1px solid #f0f0f0',
        borderBottom: '1px solid #f0f0f0',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#1a1a2e',
            textAlign: 'center',
            margin: '0 0 48px 0',
          }}>
            {t('home_how_title')}
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '32px',
          }}>
            {[
              {
                step: '01',
                icon: <Users size={24} />,
                title: t('home_step1_title'),
                desc: t('home_step1_desc'),
              },
              {
                step: '02',
                icon: <Link2 size={24} />,
                title: t('home_step2_title'),
                desc: t('home_step2_desc', { domain: currentDomain }),
              },
              {
                step: '03',
                icon: <Code2 size={24} />,
                title: t('home_step3_title'),
                desc: t('home_step3_desc'),
              },
            ].map((step, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '16px',
                  backgroundColor: '#e6f7ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  color: '#1890ff',
                  position: 'relative',
                }}>
                  {step.icon}
                  <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#1890ff',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {i + 1}
                  </span>
                </div>
                <h4 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: '#1a1a2e',
                  margin: '0 0 8px 0',
                }}>
                  {step.title}
                </h4>
                <p style={{
                  fontSize: '13px',
                  color: '#666',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>

          <div style={{
            textAlign: 'center',
            marginTop: '48px',
          }}>
            <a
              href="/docs"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 28px',
                backgroundColor: '#1890ff',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '15px',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {t('home_how_cta')}
              <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>

      {/* Tech Stack & Support */}
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '64px 24px',
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 600,
          color: '#1a1a2e',
          textAlign: 'center',
          margin: '0 0 36px 0',
        }}>
          {t('home_tech_title')}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px',
        }}>
          {[
            {
              icon: '🌐',
              title: t('home_tech_i18n_title'),
              desc: t('home_tech_i18n_desc', { count: supportedLocales?.length || 22 }),
            },
            {
              icon: '🔄',
              title: t('home_tech_translate_title'),
              desc: t('home_tech_translate_desc'),
            },
            {
              icon: '📱',
              title: t('home_tech_pwa_title'),
              desc: t('home_tech_pwa_desc'),
            },
            {
              icon: '🔒',
              title: t('home_tech_security_title'),
              desc: t('home_tech_security_desc'),
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                backgroundColor: '#fafbfc',
                borderRadius: '10px',
                padding: '24px',
                border: '1px solid #f0f0f0',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px' }}>{item.icon}</div>
              <h4 style={{
                fontSize: '15px',
                fontWeight: 600,
                color: '#1a1a2e',
                margin: '0 0 6px 0',
              }}>
                {item.title}
              </h4>
              <p style={{
                fontSize: '13px',
                color: '#888',
                lineHeight: '1.6',
                margin: 0,
              }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{
        backgroundColor: '#001529',
        color: 'rgba(255,255,255,0.6)',
        padding: '32px 24px',
        textAlign: 'center',
        fontSize: '13px',
      }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <p style={{ margin: '0 0 16px 0' }}>
            <span style={{ color: '#fff', fontWeight: 500 }}>{platformName}</span>
            {t('home_footer_powered')}
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/stafflogin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              {t('home_footer_staff_login')}
            </a>
            <a href="/adminlogin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              {t('home_footer_admin_login')}
            </a>
            <a href="/docs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              {t('home_footer_docs')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  return (
    <I18nProvider>
      <HomeContent />
    </I18nProvider>
  );
}

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

  const platformName = siteName || t('service_title') || '在线客服';

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
      title: '实时在线聊天',
      desc: '访客与客服实时文字沟通，支持图片、视频、文件等多种消息类型，消息加密传输保障安全',
      color: '#1890ff',
    },
    {
      icon: <Globe size={28} />,
      title: '多语言自动翻译',
      desc: '内置多引擎AI翻译，访客和客服使用各自语言交流，系统自动互译，打破语言障碍',
      color: '#52c41a',
    },
    {
      icon: <Shield size={28} />,
      title: '独立商家隔离',
      desc: '每个商家拥有独立的数据空间和客服团队，会话、消息、配置完全隔离，互不干扰',
      color: '#722ed1',
    },
    {
      icon: <Zap size={28} />,
      title: 'PWA渐进式应用',
      desc: '支持安装到手机/桌面，离线时仍可访问历史消息，消息推送实时到达，媲美原生App体验',
      color: '#fa8c16',
    },
    {
      icon: <Users size={28} />,
      title: '智能客服分配',
      desc: '支持客服轮询/空闲分配策略，可管理客服在线状态，支持会话转接和多客服协作处理',
      color: '#eb2f96',
    },
    {
      icon: <FileText size={28} />,
      title: '访客身份识别',
      desc: '通过URL参数传递访客身份信息（用户名、邮箱、电话等），客服端实时显示访客画像',
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
            margin: '0 auto 32px',
          }}>
            轻量级在线客服系统，支持多商家独立运营、多语言实时翻译。
            访客通过商家专属链接接入，客服通过后台统一管理。
          </p>

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
            查看接入文档
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
            平台核心功能
          </h2>
          <p style={{
            fontSize: '15px',
            color: '#666',
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: '1.6',
          }}>
            为您提供一站式的在线客服解决方案
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
            如何接入使用
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
                title: '注册商家',
                desc: '在支持的部署环境中添加商家，每个商家拥有独立的客服团队和数据空间',
              },
              {
                step: '02',
                icon: <Link2 size={24} />,
                title: '获取链接',
                desc: '获取商家专属的接入链接：{域名}/chat?business=你的商家标识',
              },
              {
                step: '03',
                icon: <Code2 size={24} />,
                title: '嵌入网站',
                desc: '通过 Script 标签或 iframe 嵌入到你的网站，5分钟快速接入',
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
              查看详细接入文档
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
          技术支持
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: '20px',
        }}>
          {[
            {
              icon: '🌐',
              title: '多语言界面',
              desc: `支持 ${supportedLocales?.length || 22}+ 种界面语言，自动检测浏览器语言`,
            },
            {
              icon: '🔄',
              title: '多引擎翻译',
              desc: 'Cloudflare AI / PearApi / SimplyTranslate / Google 自动切换容灾',
            },
            {
              icon: '📱',
              title: 'PWA 离线支持',
              desc: '可安装为桌面/移动应用，离线访问历史聊天记录',
            },
            {
              icon: '🔒',
              title: '数据安全隔离',
              desc: '商家数据完全隔离，客服权限分级管理，支持自定义字段',
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
            {' - Powered by Cloudflare Workers + D1 + Hono'}
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/stafflogin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              客服登录
            </a>
            <a href="/adminlogin" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              管理员登录
            </a>
            <a href="/docs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>
              接入文档
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

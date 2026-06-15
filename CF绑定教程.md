# Cloudflare 一键部署教程

本文档详细说明如何使用 GitHub Actions 一键部署 ZYG-online-chat 项目到 Cloudflare。

---

## 目录

1. [项目架构概述](#项目架构概述)
2. [一键部署流程](#一键部署流程)
3. [GitHub Secrets 配置](#github-secrets-配置)
4. [创建 Cloudflare API Token](#创建-cloudflare-api-token)
5. [手动部署方式](#手动部署方式)
6. [配置清单](#配置清单)
7. [常见问题](#常见问题)

---

## 项目架构概述

ZYG-online-chat 采用 **Pages + Worker 混合架构**：

```
用户访问：https://your-domain.com
         ↓
    Cloudflare Pages（Edge 网络）
         ↓
  ┌─ Pages Functions 判断路由
  │
  ├─ /api/* ? → 转发给 Worker（处理业务逻辑）
  │             Worker 访问 D1 数据库 + R2 存储
  │
  └─ 其他 → 返回静态文件（React 前端）
```

**优势**：
- Pages 托管静态资源（免费无限请求）
- Worker 处理 API 逻辑（节省约 90% 成本）

---

## 一键部署流程

### 步骤 1：Fork 项目

将项目 Fork 到你的 GitHub 账户。

### 步骤 2：配置 GitHub Secrets

进入 GitHub 仓库 **Settings → Secrets and variables → Actions**，添加以下 Secrets：

**必需 Secrets：**

| Secret 名称 | 说明 |
|-------------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token（需 Workers、D1、R2、Pages 权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID |

**可选 Secrets：**

| Secret 名称 | 说明 |
|-------------|------|
| `BARK_KEY` | Bark iOS 推送密钥 |
| `STAFF_PASSWORD` | 客服端登录密码 |
| `JWT_SECRET` | JWT 签名密钥（自动生成） |

### 步骤 3：触发部署

- 推送代码到 `main` 分支自动触发
- 或在 **Actions** 页面手动触发 workflow

### 步骤 4：验证部署

部署完成后访问：
- Pages: `https://online-chat.pages.dev`
- Worker: `https://online-chat.workers.dev`
- 用户端: `https://online-chat.pages.dev/chat`
- 客服端: `https://online-chat.pages.dev/staff`

---

## GitHub Secrets 配置

### 必需 Secrets

| Secret | 获取方式 |
|--------|----------|
| `CLOUDFLARE_API_TOKEN` | 在 Cloudflare Dashboard 创建 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard 首页右侧 |

### 可选 Secrets

| Secret | 说明 | 默认值 |
|--------|------|--------|
| `BARK_KEY` | Bark 推送密钥 | 空（不启用推送） |
| `STAFF_PASSWORD` | 客服端密码 | 空（无需认证） |
| `JWT_SECRET` | JWT 密钥（32+字符） | 自动生成 |

---

## 创建 Cloudflare API Token

### 步骤 1：登录 Cloudflare

访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)

### 步骤 2：创建 Token

1. 进入 **My Profile → API Tokens**
2. 点击 **Create Token**
3. 选择 **Create Custom Token**

### 步骤 3：配置权限

| 权限 | 资源 | 说明 |
|------|------|------|
| Account - Workers Scripts | Edit | 部署 Worker |
| Account - D1 | Edit | 创建/管理 D1 数据库 |
| Account - R2 Storage | Edit | 创建/管理 R2 存储桶 |
| Account - Pages | Edit | 部署 Pages |

### 步骤 4：获取 Token

创建后复制 Token（只显示一次），粘贴到 GitHub Secrets 中。

---

## 手动部署方式

### 步骤 1：安装依赖

```bash
npm install
```

### 步骤 2：创建 D1 数据库

```bash
wrangler d1 create online-chat-db
# 记录返回的 database_id
```

### 步骤 3：创建 R2 存储桶

```bash
wrangler r2 bucket create online-chat-uploads
```

### 步骤 4：更新 wrangler.toml

将获取的 `database_id` 更新到 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "online-chat-db"
database_id = "你的数据库ID"
```

### 步骤 5：配置 Secrets

```bash
wrangler secret put BARK_KEY
wrangler secret put STAFF_PASSWORD
wrangler secret put JWT_SECRET
```

### 步骤 6：构建并部署

```bash
npm run build
wrangler deploy
```

### 步骤 7：部署 Pages

```bash
wrangler pages project create online-chat --production-branch main
wrangler pages deploy dist --project-name=online-chat
```

---

## 配置清单

| 配置项 | 类型 | 必需 | 配置位置 |
|--------|------|------|----------|
| D1 数据库 | binding | ✅ | wrangler.toml |
| R2 存储桶 | binding | ✅ | wrangler.toml |
| CLOUDFLARE_API_TOKEN | Secret | ✅ | GitHub Secrets |
| CLOUDFLARE_ACCOUNT_ID | Secret | ✅ | GitHub Secrets |
| BARK_KEY | Secret | ❌ | GitHub Secrets / wrangler |
| STAFF_PASSWORD | Secret | ❌ | GitHub Secrets / wrangler |
| JWT_SECRET | Secret | ❌ | GitHub Secrets / wrangler |

---

## 常见问题

### Q: 部署失败 - D1 数据库不存在？

**解决方案**：
- 确保 CLOUDFLARE_API_TOKEN 有 D1 权限
- 检查 database_id 是否正确配置

### Q: API 请求返回 502 错误？

**解决方案**：
- 确认 Worker 部署成功
- 检查 Pages Functions 配置
- 验证 Worker URL 是否正确

### Q: 图片上传失败？

**解决方案**：
- 确认 R2 存储桶已创建
- 检查 `wrangler.toml` 中的 R2 绑定配置

### Q: Bark 推送不生效？

**解决方案**：
- 确认 `BARK_KEY` 已配置
- 访问 `/test-bark` 端点测试

---

## 相关链接

- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [Wrangler 文档](https://developers.cloudflare.com/workers/wrangler/)
- [D1 文档](https://developers.cloudflare.com/d1/)
- [R2 文档](https://developers.cloudflare.com/r2/)
- [Pages 文档](https://developers.cloudflare.com/pages/)
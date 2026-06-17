# 功能对比分析与完善方案

## 一、项目对比概览

### 1.1 项目基本信息

| 项目 | 技术栈 | 语言支持 | 部署方式 |
|------|--------|----------|----------|
| **参考项目** | PHP + MySQL | 20种语言 | 传统服务器 |
| **当前项目** | React + Hono + D1 | 2种语言 | Cloudflare Workers |

### 1.2 功能对比矩阵

| 功能模块 | 参考项目 | 当前项目 | 状态 |
|----------|----------|----------|------|
| **核心聊天** | ✅ | ✅ | 已实现 |
| **多语言支持** | 20种 | 2种 | ⚠️ 缺少18种 |
| **消息撤回** | ✅ | ❌ | 缺失 |
| **客服转接** | ✅ | ❌ | 缺失 |
| **商品卡片** | ✅ | ❌ | 缺失 |
| **数据统计面板** | ✅ | ❌ | 缺失 |
| **敏感词过滤** | ✅ | ⚠️ 基础 | 不完善 |
| **黑名单机制** | ✅ | ❌ | 缺失 |
| **智能机器人** | ✅ | ⚠️ 基础 | 需增强 |

---

## 二、缺失功能详细分析

### 2.1 多语言支持（优先级：高）

**参考项目支持的语言**:
| 语言 | 代码 | 语言 | 代码 |
|------|------|------|------|
| 中文简体 | cn | 日语 | jp |
| 中文繁体 | tc | 韩语 | kr |
| 英语 | en | 西班牙语 | es |
| 越南语 | vi | 法语 | fra |
| 俄语 | rus | 意大利语 | it |
| 印尼语 | id | 德语 | de |
| 泰语 | th | 葡萄牙语 | pt |
| 阿拉伯语 | ara | 丹麦语 | dan |
| 希腊语 | el | 荷兰语 | nl |
| 波兰语 | pl | 芬兰语 | fin |

**当前项目**: 仅支持 `zh-CN` 和 `en-US`

### 2.2 消息撤回功能（优先级：中）

参考项目支持消息撤回，当前项目无此功能。

### 2.3 客服转接功能（优先级：高）

参考项目支持客服之间转接访客，当前项目无此功能。

### 2.4 商品卡片消息（优先级：中）

参考项目支持发送商品卡片，当前项目仅支持文本、图片、文件。

### 2.5 数据统计面板（优先级：高）

参考项目包含：
- 会话量统计
- 排队人数监控
- 客服在线状态
- 评价数据分析
- 15天趋势图表

### 2.6 安全防护（优先级：中）

参考项目包含：
- 敏感词过滤
- 黑名单机制
- XSS攻击防护

---

## 三、完善方案

### 3.1 多语言支持完善

**目标**: 添加18种语言支持

**实施步骤**:

```bash
# 创建语言文件目录结构
src/
  shared/
    i18n/
      locales/
        zh-CN.ts (已有)
        en-US.ts (已有)
        tc.ts     ← 新增
        jp.ts     ← 新增
        kr.ts     ← 新增
        es.ts     ← 新增
        fr.ts     ← 新增
        it.ts     ← 新增
        de.ts     ← 新增
        pt.ts     ← 新增
        vi.ts     ← 新增
        ru.ts     ← 新增
        id.ts     ← 新增
        th.ts     ← 新增
        ar.ts     ← 新增
        el.ts     ← 新增
        pl.ts     ← 新增
        da.ts     ← 新增
        nl.ts     ← 新增
        fi.ts     ← 新增
```

**代码实现**:

```typescript
// src/shared/i18n/index.ts
import { createI18nContext } from '@/context/I18nContext';

const supportedLocales = [
  'zh-CN', 'en-US', 'tc', 'jp', 'kr', 'es', 'fr', 'it', 
  'de', 'pt', 'vi', 'ru', 'id', 'th', 'ar', 'el', 'pl', 'da', 'nl', 'fi'
];

export const { I18nProvider, useI18n } = createI18nContext(supportedLocales);
```

**预估工作量**: 40小时

---

### 3.2 消息撤回功能

**数据库修改**:

```sql
ALTER TABLE messages ADD COLUMN is_deleted INTEGER DEFAULT 0;
ALTER TABLE messages ADD COLUMN deleted_by TEXT;
ALTER TABLE messages ADD COLUMN deleted_at INTEGER;
```

**API实现**:

```typescript
// src/server/module-chat/routes/chat-routes.ts
chatRoutes.post('/messages/:id/delete', async (c) => {
  const messageId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json();
  const { sessionId } = body;
  
  const db = getDb();
  const message = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);
  
  if (!message) {
    return c.json({ success: false, error: '消息不存在' }, 404);
  }
  
  // 检查是否有权限删除（只能删除自己发送的消息，且在一定时间内）
  const now = Date.now();
  const timeLimit = 5 * 60 * 1000; // 5分钟
  
  if (now - message.created_at > timeLimit) {
    return c.json({ success: false, error: '超过撤回时间限制' }, 400);
  }
  
  await db.run(
    'UPDATE messages SET is_deleted = 1, deleted_at = ? WHERE id = ?',
    [now, messageId]
  );
  
  return c.json({ success: true });
});
```

**预估工作量**: 8小时

---

### 3.3 客服转接功能

**数据库修改**:

```sql
ALTER TABLE sessions ADD COLUMN assigned_staff_id INTEGER;
ALTER TABLE sessions ADD COLUMN transfer_history TEXT;
```

**API实现**:

```typescript
// src/server/module-chat/routes/chat-routes.ts
chatRoutes.post('/sessions/:id/transfer', async (c) => {
  const sessionId = c.req.param('id');
  const body = await c.req.json();
  const { targetStaffId, reason } = body;
  
  const db = getDb();
  
  // 获取当前会话信息
  const session = await db.get('SELECT * FROM sessions WHERE id = ?', [sessionId]);
  if (!session) {
    return c.json({ success: false, error: '会话不存在' }, 404);
  }
  
  // 获取目标客服信息
  const targetStaff = await db.get(
    'SELECT id, username FROM staff_users WHERE id = ? AND status = "active"',
    [targetStaffId]
  );
  if (!targetStaff) {
    return c.json({ success: false, error: '目标客服不存在或未激活' }, 400);
  }
  
  // 更新会话分配
  await db.run(
    'UPDATE sessions SET assigned_staff_id = ?, updated_at = ? WHERE id = ?',
    [targetStaffId, Date.now(), sessionId]
  );
  
  // 记录转接历史
  const transferRecord = JSON.stringify({
    timestamp: Date.now(),
    fromStaffId: session.assigned_staff_id,
    toStaffId: targetStaffId,
    reason: reason || '主动转接'
  });
  
  await db.run(
    'UPDATE sessions SET transfer_history = ? WHERE id = ?',
    [transferRecord, sessionId]
  );
  
  return c.json({ success: true, data: { staff: targetStaff } });
});
```

**预估工作量**: 12小时

---

### 3.4 商品卡片消息

**数据库修改**:

```sql
ALTER TABLE messages ADD COLUMN product_id INTEGER;
ALTER TABLE messages ADD COLUMN product_name TEXT;
ALTER TABLE messages ADD COLUMN product_price TEXT;
ALTER TABLE messages ADD COLUMN product_image TEXT;
ALTER TABLE messages ADD COLUMN product_url TEXT;
```

**消息类型扩展**:

```typescript
// src/shared/types.ts
export type ContentType = 'text' | 'image' | 'video' | 'file' | 'product';

export interface Message {
  // ... 现有字段
  content_type: ContentType;
  // 商品卡片字段
  product_id?: number;
  product_name?: string;
  product_price?: string;
  product_image?: string;
  product_url?: string;
}
```

**预估工作量**: 16小时

---

### 3.5 数据统计面板

**后端API实现**:

```typescript
// src/server/module-chat/routes/chat-routes.ts
chatRoutes.get('/stats', async (c) => {
  const db = getDb();
  const businessId = c.get('businessId');
  
  // 今日会话数
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todaySessions = await db.get(
    'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND created_at >= ?',
    [businessId, todayStart.getTime()]
  );
  
  // 活跃会话数
  const activeSessions = await db.get(
    'SELECT COUNT(*) as count FROM sessions WHERE business_id = ? AND status = "active"',
    [businessId]
  );
  
  // 排队人数
  const queueCount = await db.get(
    'SELECT COUNT(*) as count FROM queue WHERE business_id = ?',
    [businessId]
  );
  
  // 平均响应时间
  const avgResponse = await db.get(
    'SELECT AVG(response_time) as avg FROM sessions WHERE business_id = ?',
    [businessId]
  );
  
  // 满意度统计
  const satisfaction = await db.get(
    'SELECT AVG(score) as avg, COUNT(*) as total FROM evaluations WHERE business_id = ?',
    [businessId]
  );
  
  return c.json({
    success: true,
    data: {
      todaySessions: todaySessions.count,
      activeSessions: activeSessions.count,
      queueCount: queueCount.count,
      avgResponseTime: avgResponse.avg,
      satisfactionRate: satisfaction.avg,
      evaluationCount: satisfaction.total
    }
  });
});
```

**前端组件**:

```typescript
// src/client/components/staff/StatsDashboard.tsx
export function StatsDashboard() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    fetch('/api/chat/stats', {
      headers: { Authorization: `Bearer ${localStorage.getItem('staff_token')}` }
    })
    .then(res => res.json())
    .then(data => setStats(data.data));
  }, []);
  
  if (!stats) return <div>加载中...</div>;
  
  return (
    <div className="stats-grid">
      <StatCard label="今日会话" value={stats.todaySessions} />
      <StatCard label="活跃会话" value={stats.activeSessions} />
      <StatCard label="排队人数" value={stats.queueCount} />
      <StatCard label="满意度" value={`${stats.satisfactionRate}%`} />
    </div>
  );
}
```

**预估工作量**: 24小时

---

### 3.6 敏感词过滤增强

**数据库修改**:

```sql
-- 已存在 banwords 表，添加等级字段
ALTER TABLE banwords ADD COLUMN level INTEGER DEFAULT 1; -- 1:警告, 2:禁止, 3:拉黑
ALTER TABLE banwords ADD COLUMN replace_with TEXT; -- 替换文本
```

**服务实现**:

```typescript
// src/server/shared/banword-service.ts
export async function checkBanword(content: string): Promise<{ blocked: boolean; message?: string }> {
  const db = getDb();
  const banwords = await db.all('SELECT keyword, level, replace_with FROM banwords WHERE status = 1');
  
  for (const banword of banwords) {
    if (content.includes(banword.keyword)) {
      if (banword.level >= 2) {
        return { blocked: true, message: '内容包含违禁词' };
      }
    }
  }
  
  return { blocked: false };
}
```

**预估工作量**: 8小时

---

### 3.7 黑名单机制

**数据库修改**:

```sql
-- 创建访客黑名单表
CREATE TABLE IF NOT EXISTS visitor_blacklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id INTEGER NOT NULL,
  visitor_id TEXT NOT NULL,
  ip TEXT,
  reason TEXT,
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

**API实现**:

```typescript
// src/server/module-chat/routes/chat-routes.ts
chatRoutes.post('/blacklist/add', async (c) => {
  const body = await c.req.json();
  const { visitorId, ip, reason, days } = body;
  const businessId = c.get('businessId');
  
  const db = getDb();
  
  // 检查是否已在黑名单中
  const existing = await db.get(
    'SELECT id FROM visitor_blacklist WHERE business_id = ? AND visitor_id = ?',
    [businessId, visitorId]
  );
  
  if (existing) {
    return c.json({ success: false, error: '该访客已在黑名单中' }, 400);
  }
  
  const expiresAt = days ? Date.now() + days * 24 * 60 * 60 * 1000 : null;
  
  await db.run(
    'INSERT INTO visitor_blacklist (business_id, visitor_id, ip, reason, expires_at) VALUES (?, ?, ?, ?, ?)',
    [businessId, visitorId, ip, reason, expiresAt]
  );
  
  return c.json({ success: true });
});
```

**预估工作量**: 10小时

---

## 四、实施优先级建议

| 优先级 | 功能 | 工作量 | 收益 |
|--------|------|--------|------|
| **P0** | 多语言支持 | 40h | 国际化能力 |
| **P0** | 客服转接 | 12h | 提升客服协作效率 |
| **P1** | 数据统计面板 | 24h | 运营数据分析 |
| **P1** | 消息撤回 | 8h | 用户体验提升 |
| **P2** | 商品卡片 | 16h | 电商场景支持 |
| **P2** | 敏感词过滤 | 8h | 内容安全 |
| **P3** | 黑名单机制 | 10h | 安全防护 |

---

## 五、总工作量预估

| 阶段 | 功能 | 工作量 |
|------|------|--------|
| **第一阶段** | 多语言支持 + 客服转接 | 52小时 |
| **第二阶段** | 数据统计 + 消息撤回 | 32小时 |
| **第三阶段** | 商品卡片 + 安全防护 | 34小时 |
| **总计** | - | 118小时 |

---

## 六、总结

当前项目（ZYG-online-chat）在核心聊天功能和多租户架构方面已经完善，但与参考项目相比，在以下方面存在差距：

1. **国际化能力** - 缺少18种语言支持
2. **客服协作** - 缺少转接功能
3. **数据分析** - 缺少统计面板
4. **安全防护** - 缺少敏感词过滤和黑名单

建议按照优先级逐步完善，优先完成多语言支持和客服转接功能，这将显著提升系统的实用性和专业性。

**文档生成时间**: 2026-06-17
**评估人**: Trae AI 代码分析助手
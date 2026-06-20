/**
 * Database abstraction layer
 * Supports both Node.js sqlite and Cloudflare D1
 */

import { createRequire } from 'node:module'
import type { D1Database } from '@cloudflare/workers-types'
import { hashPassword } from './crypto'

// Lazy-loaded require - only created when needed in Node.js environment
let _nodeRequire: typeof require | null = null

function getNodeRequire(): typeof require {
  if (!_nodeRequire) {
    // Check if we're in a Node.js environment with valid import.meta.url
    if (typeof import.meta.url === 'string' && import.meta.url.startsWith('file://')) {
      _nodeRequire = createRequire(import.meta.url)
    } else {
      throw new Error('Node.js require not available in this environment')
    }
  }
  return _nodeRequire
}

// Database interface for abstraction
export interface Database {
  exec(sql: string): Promise<void>
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>
  get<T>(sql: string, params?: unknown[]): Promise<T | null>
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
}

// D1 Database implementation
class D1DatabaseAdapter implements Database {
  constructor(private db: D1Database) {}

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql)
  }

  async run(
    sql: string,
    params?: unknown[]
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    const result = await this.db
      .prepare(sql)
      .bind(...(params || []))
      .run()
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id,
    }
  }

  async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.db
      .prepare(sql)
      .bind(...(params || []))
      .first<T>()
    return result
  }

  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.db
      .prepare(sql)
      .bind(...(params || []))
      .all<T>()
    return result.results
  }
}

// Node SQLite implementation
class NodeSQLiteAdapter implements Database {
  private db: import('node:sqlite').DatabaseSync

  constructor() {
    // Only executed in Node.js environment
    const nodeRequire = getNodeRequire()
    const { DatabaseSync } = nodeRequire('node:sqlite')
    const { existsSync, mkdirSync } = nodeRequire('node:fs')
    const { dirname } = nodeRequire('node:path')

    const dbPath = './data/todos.db'
    const dbDir = dirname(dbPath)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    this.db = new DatabaseSync(dbPath)
    this.db.exec('PRAGMA foreign_keys = ON')
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql)
  }

  async run(
    sql: string,
    params?: unknown[]
  ): Promise<{ changes: number; lastInsertRowid: number }> {
    const stmt = this.db.prepare(sql)
    let result: { changes: number; lastInsertRowid: number | bigint }
    if (params && params.length > 0) {
      result = stmt.run(...(params as Parameters<typeof stmt.run>)) as {
        changes: number
        lastInsertRowid: number | bigint
      }
    } else {
      result = stmt.run() as { changes: number; lastInsertRowid: number | bigint }
    }
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    }
  }

  async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const stmt = this.db.prepare(sql)
    const result =
      params && params.length > 0
        ? stmt.get(...(params as Parameters<typeof stmt.get>))
        : stmt.get()
    return result as T | null
  }

  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql)
    const results =
      params && params.length > 0
        ? stmt.all(...(params as Parameters<typeof stmt.all>))
        : stmt.all()
    return results as T[]
  }
}

// Global database instance
let db: Database | null = null

/**
 * Initialize database for Node.js environment
 */
export async function initializeNodeDb(): Promise<void> {
  if (db) return
  db = new NodeSQLiteAdapter()
  await initializeSchema()
}

/**
 * Initialize database for Cloudflare Workers
 */
export async function initializeD1Db(d1Database: D1Database): Promise<void> {
  db = new D1DatabaseAdapter(d1Database)
  await initializeSchema()
}

/**
 * Get database instance
 */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeNodeDb() or initializeD1Db() first.')
  }
  return db
}

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
  const database = getDb()

  // Check if schema is already initialized by checking for admin_users table
  let schemaExists = false
  try {
    const result = await database.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_users'"
    )
    if (result) {
      console.log('[Database] Schema already initialized, skipping table creation...')
      schemaExists = true
    }
  } catch (error) {
    console.error('[Database] Error checking schema:', error)
  }

  if (!schemaExists) {
    // Create all tables...
    await createAllTables(database)
  }

  // Always run migrations to ensure columns are up to date
  await runMigrations(database)
}

// Convenience export for tests: provide a synchronous sqlite instance (better-sqlite3 / node:sqlite DatabaseSync)
// Tests in this repo expect `sqlite.prepare(...).run()` API. We create a DatabaseSync instance when running in Node.
export const sqlite: any = (() => {
  try {
    const nodeRequireLocal = getNodeRequire();
    const { DatabaseSync } = nodeRequireLocal('node:sqlite');
    const { existsSync, mkdirSync } = nodeRequireLocal('node:fs');
    const { dirname } = nodeRequireLocal('node:path');

    const dbPath = './data/todos.db';
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    const sdb = new DatabaseSync(dbPath);
    sdb.exec('PRAGMA foreign_keys = ON');
    return sdb as any;
  } catch (e) {
    // Not running in Node or node:sqlite not available
    return null as any;
  }
})();

async function createAllTables(database: Database): Promise<void> {
  // Create todos table
  await database.exec(
    'CREATE TABLE IF NOT EXISTS todos (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'title TEXT NOT NULL, ' +
      'description TEXT, ' +
      "status TEXT NOT NULL DEFAULT 'pending', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create sessions table
  await database.exec(
    'CREATE TABLE IF NOT EXISTS sessions (' +
      'id TEXT PRIMARY KEY, ' +
      'visiter_id TEXT NOT NULL, ' +
      'visitor_name TEXT NOT NULL, ' +
      'business_id INTEGER NOT NULL DEFAULT 1, ' +
      'service_id INTEGER DEFAULT 0, ' +
      'assigned_staff_id INTEGER, ' +
      'groupid INTEGER DEFAULT 0, ' +
      "status TEXT NOT NULL DEFAULT 'active', " +
      "state TEXT NOT NULL DEFAULT 'normal', " +
      'last_message_at INTEGER, ' +
      'unread_by_visitor INTEGER DEFAULT 0, ' +
      'unread_by_staff INTEGER DEFAULT 0, ' +
      'topic TEXT, ' +
      "task_status TEXT NOT NULL DEFAULT 'requirement_discussion', " +
      'task_status_updated_at INTEGER, ' +
      'queue_position INTEGER, ' +
      'estimated_wait_minutes INTEGER, ' +
      'ip TEXT, ' +
      'from_url TEXT, ' +
      'avatar TEXT, ' +
      'device TEXT, ' +
      "lang TEXT DEFAULT 'cn', " +
      'transfer_history TEXT, ' +
      'response_time INTEGER, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create messages table
  await database.exec(
    'CREATE TABLE IF NOT EXISTS messages (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'session_id TEXT NOT NULL, ' +
      'sender_type TEXT NOT NULL, ' +
      'content_type TEXT NOT NULL, ' +
      'content TEXT NOT NULL, ' +
      'translated_content TEXT, ' +
      'thumbnail_url TEXT, ' +
      'file_name TEXT, ' +
      'file_size INTEGER, ' +
      'is_read INTEGER DEFAULT 0, ' +
      'is_deleted INTEGER DEFAULT 0, ' +
      'deleted_by TEXT, ' +
      'deleted_at INTEGER, ' +
      'product_id INTEGER, ' +
      'product_name TEXT, ' +
      'product_price TEXT, ' +
      'product_image TEXT, ' +
      'product_url TEXT, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)'
  )

  // Create transfer_requests table for session transfer (会话转申请表)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS transfer_requests (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'session_id TEXT NOT NULL, ' +
      'from_staff_id INTEGER NOT NULL, ' +
      'to_staff_id INTEGER NOT NULL, ' +
      'reason TEXT, ' +
      "status TEXT NOT NULL DEFAULT 'pending', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)'
  )

  // Create staff_users table for multi-user authentication (商家/客服表)
  // business_id = 0 表示商家主账号，business_id > 0 表示归属到该商家的客服
  await database.exec(
    'CREATE TABLE IF NOT EXISTS staff_users (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER NOT NULL DEFAULT 0, ' +
      'business_slug TEXT UNIQUE, ' +
      'business_name TEXT, ' +
      'enable_auto_trans INTEGER NOT NULL DEFAULT 0, ' +
      'bd_trans_appid TEXT, ' +
      'bd_trans_secret TEXT, ' +
      'bd_trans_token TEXT, ' +
      "default_lang TEXT NOT NULL DEFAULT 'zh-CN', " +
      'username TEXT NOT NULL UNIQUE, ' +
      'password_hash TEXT NOT NULL, ' +
      'email TEXT, ' +
      'name TEXT, ' +
      "role TEXT NOT NULL DEFAULT 'staff', " +
      "status TEXT NOT NULL DEFAULT 'active', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create visitors table for visitor management (访客表)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS visitors (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER NOT NULL DEFAULT 1, ' +
      'visitor_id TEXT NOT NULL, ' +
      'visitor_name TEXT NOT NULL, ' +
      'avatar TEXT, ' +
      'ip TEXT, ' +
      'from_url TEXT, ' +
      'device TEXT, ' +
      "lang TEXT NOT NULL DEFAULT 'cn', " +
      "status TEXT NOT NULL DEFAULT 'offline', " +
      'last_visit_at INTEGER, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create robot_knowledge table for AI auto-reply
  await database.exec(
    'CREATE TABLE IF NOT EXISTS robot_knowledge (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'keyword TEXT NOT NULL, ' +
      'question TEXT NOT NULL, ' +
      'answer TEXT NOT NULL, ' +
      'sort INTEGER NOT NULL DEFAULT 0, ' +
      'status INTEGER NOT NULL DEFAULT 1, ' +
      "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create faq table for frequently asked questions
  await database.exec(
    'CREATE TABLE IF NOT EXISTS faq (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'question TEXT NOT NULL, ' +
      'answer TEXT NOT NULL, ' +
      'sort INTEGER NOT NULL DEFAULT 0, ' +
      'status INTEGER NOT NULL DEFAULT 1, ' +
      "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create evaluations table for visitor feedback
  await database.exec(
    'CREATE TABLE IF NOT EXISTS evaluations (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'session_id TEXT NOT NULL, ' +
      'visitor_name TEXT, ' +
      'score INTEGER NOT NULL DEFAULT 5, ' +
      'comment TEXT, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create banwords table for prohibited words
  await database.exec(
    'CREATE TABLE IF NOT EXISTS banwords (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'keyword TEXT NOT NULL UNIQUE, ' +
      'level INTEGER NOT NULL DEFAULT 1, ' +
      'replace_with TEXT, ' +
      'status INTEGER NOT NULL DEFAULT 1, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create visitor_blacklist table for blocked visitors
  await database.exec(
    'CREATE TABLE IF NOT EXISTS visitor_blacklist (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER NOT NULL, ' +
      'visitor_id TEXT NOT NULL, ' +
      'ip TEXT, ' +
      'reason TEXT, ' +
      'expires_at INTEGER, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create chat_stats table for statistics
  await database.exec(
    'CREATE TABLE IF NOT EXISTS chat_stats (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER NOT NULL, ' +
      'date TEXT NOT NULL, ' +
      'total_sessions INTEGER DEFAULT 0, ' +
      'active_sessions INTEGER DEFAULT 0, ' +
      'total_messages INTEGER DEFAULT 0, ' +
      'avg_response_time INTEGER DEFAULT 0, ' +
      'satisfaction_rate REAL DEFAULT 0, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create staff_groups table for staff grouping
  await database.exec(
    'CREATE TABLE IF NOT EXISTS staff_groups (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'name TEXT NOT NULL UNIQUE, ' +
      'description TEXT, ' +
      'sort INTEGER NOT NULL DEFAULT 0, ' +
      'status INTEGER NOT NULL DEFAULT 1, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create staff_group_members table for staff-group relationships
  await database.exec(
    'CREATE TABLE IF NOT EXISTS staff_group_members (' +
      'group_id INTEGER NOT NULL, ' +
      'staff_id INTEGER NOT NULL, ' +
      'PRIMARY KEY (group_id, staff_id))'
  )

  // Create sentences table for quick replies (常用语)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS sentences (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'content TEXT NOT NULL, ' +
      'staff_id INTEGER NOT NULL, ' +
      'tag TEXT, ' +
      "state TEXT NOT NULL DEFAULT 'using', " +
      "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create offline_messages table for offline visitor messages (留言)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS offline_messages (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'visiter_id TEXT, ' +
      'name TEXT NOT NULL, ' +
      'mobile TEXT, ' +
      'email TEXT, ' +
      'content TEXT NOT NULL, ' +
      'business_id INTEGER DEFAULT 0, ' +
      'ip TEXT, ' +
      'from_url TEXT, ' +
      "status TEXT NOT NULL DEFAULT 'pending', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create queue table for waiting visitors (排队表)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS queue (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'visiter_id TEXT NOT NULL, ' +
      'service_id INTEGER DEFAULT 0, ' +
      'groupid INTEGER DEFAULT 0, ' +
      'business_id INTEGER DEFAULT 0, ' +
      "state TEXT NOT NULL DEFAULT 'waiting', " +
      'position INTEGER DEFAULT 0, ' +
      'remind_sent INTEGER DEFAULT 0, ' +
      'evaluation_sent INTEGER DEFAULT 0, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create evaluation_setting table for visitor feedback settings
  await database.exec(
    'CREATE TABLE IF NOT EXISTS evaluation_setting (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER DEFAULT 0, ' +
      "title TEXT NOT NULL DEFAULT '满意度评价', " +
      "questions TEXT NOT NULL DEFAULT '[]', " +
      "word_switch TEXT NOT NULL DEFAULT 'close', " +
      "word_title TEXT NOT NULL DEFAULT '', " +
      "status TEXT NOT NULL DEFAULT 'open', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create indexes
  await database.exec('CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id)')
  await database.exec('CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at)')
  await database.exec(
    'CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username)'
  )
  await database.exec(
    'CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id)'
  )
  await database.exec(
    'CREATE INDEX IF NOT EXISTS robot_knowledge_keyword_idx ON robot_knowledge(keyword)'
  )
  await database.exec(
    'CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id)'
  )
  await database.exec('CREATE INDEX IF NOT EXISTS sessions_visiter_id_idx ON sessions(visiter_id)')
  await database.exec(
    'CREATE INDEX IF NOT EXISTS sessions_business_id_idx ON sessions(business_id)'
  )
  await database.exec('CREATE INDEX IF NOT EXISTS sentences_staff_id_idx ON sentences(staff_id)')
  await database.exec(
    'CREATE INDEX IF NOT EXISTS offline_messages_created_at_idx ON offline_messages(created_at)'
  )
  await database.exec('CREATE INDEX IF NOT EXISTS queue_visiter_id_idx ON queue(visiter_id)')
  await database.exec('CREATE INDEX IF NOT EXISTS queue_business_id_idx ON queue(business_id)')
  await database.exec(
    'CREATE INDEX IF NOT EXISTS staff_users_business_slug_idx ON staff_users(business_slug)'
  )
  await database.exec(
    'CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id)'
  )
  await database.exec(
    'CREATE INDEX IF NOT EXISTS visitors_business_id_idx ON visitors(business_id)'
  )
  await database.exec('CREATE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id)')

  // Create admin_users table for admin panel (separate from staff_users)
  await database.exec(
    'CREATE TABLE IF NOT EXISTS admin_users (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'username TEXT NOT NULL UNIQUE, ' +
      'password_hash TEXT NOT NULL, ' +
      'email TEXT, ' +
      'name TEXT, ' +
      "status TEXT NOT NULL DEFAULT 'active', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  await database.exec(
    'CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username)'
  )

  // Create admin_config table for system settings
  await database.exec(
    'CREATE TABLE IF NOT EXISTS admin_config (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'key TEXT NOT NULL UNIQUE, ' +
      'value TEXT NOT NULL, ' +
      'description TEXT, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  // Create roles table for role-based access control
  await database.exec(
    'CREATE TABLE IF NOT EXISTS roles (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'name TEXT NOT NULL UNIQUE, ' +
      'description TEXT, ' +
      "permissions TEXT NOT NULL DEFAULT '[]', " +
      'is_system INTEGER NOT NULL DEFAULT 0, ' +
      "status TEXT NOT NULL DEFAULT 'active', " +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )

  await database.exec('CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name)')

  // Create visitor_custom_fields table for custom visitor field definitions
  await database.exec(
    'CREATE TABLE IF NOT EXISTS visitor_custom_fields (' +
      'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
      'business_id INTEGER NOT NULL DEFAULT 0, ' +
      'field_key TEXT NOT NULL, ' +
      'label TEXT NOT NULL, ' +
      'type TEXT NOT NULL DEFAULT "text", ' +
      'remark TEXT, ' +
      'sort_order INTEGER NOT NULL DEFAULT 0, ' +
      'is_active INTEGER NOT NULL DEFAULT 1, ' +
      'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
      'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
  )
  await database.exec('CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id)')
  await database.exec('CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key)')

  // Initialize default admin user (username: admin, password: 123456)
  await initializeDefaultAdmin(database)

  // Initialize default roles
  await initializeDefaultRoles(database)
}

/**
 * Run database migrations to add missing columns to existing tables.
 * This runs on every startup regardless of whether the schema already exists.
 */
async function runMigrations(database: Database): Promise<void> {
  // Helper to add column if it doesn't exist
  // NOTE: Never throws - missing columns are logged but won't prevent app startup.
  // Missing columns should be fixed via D1 Console (see scripts/d1-fix-critical-columns.sql).
  async function addColumnIfMissing(
    table: string,
    column: string,
    definition: string
  ): Promise<void> {
    try {
      const columns = await database.all<{ name: string }>(`PRAGMA table_info(${table})`)
      if (!columns.some(c => c.name === column)) {
        await database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
        console.log(`[Migration] ✅ Added column ${column} to ${table}`)
      } else {
        console.log(`[Migration] Column ${column} already exists in ${table}`)
      }
    } catch (error) {
      console.error(
        `[Migration] ❌ Failed to add column ${column} to ${table}: ${error}`
      )
      console.error(
        `[Migration] ⚠️  TABLE ${table} IS MISSING COLUMN '${column}' - this may cause SQL errors!`
      )
      console.error(
        `[Migration] ⚠️  Fix via D1 Console: ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`
      )
    }
  }

  // Add business_id to sessions table (多租户隔离：每个会话归属的商家主体)
  await addColumnIfMissing('sessions', 'business_id', 'INTEGER NOT NULL DEFAULT 1')

  // Add business_id index for sessions
  try {
    const indexes = await database.all<{ name: string }>(`PRAGMA index_list(sessions)`)
    if (!indexes.some(i => i.name === 'sessions_business_id_idx')) {
      await database.exec('CREATE INDEX sessions_business_id_idx ON sessions(business_id)')
      console.log('[Migration] Created index sessions_business_id_idx')
    }
  } catch (error) {
    console.error('[Migration] Failed to create index sessions_business_id_idx:', error)
  }

  // Add business_id to sentences table
  await addColumnIfMissing('sentences', 'business_id', 'INTEGER NOT NULL DEFAULT 0')

  // Add last_active to staff_users table (if not exists)
  await addColumnIfMissing('staff_users', 'last_active', 'INTEGER')

  // Ensure staff_users has business_slug column
  await addColumnIfMissing('staff_users', 'business_slug', 'TEXT')

  // Ensure staff_users has business_name column
  await addColumnIfMissing('staff_users', 'business_name', 'TEXT')

  // Add visitor info fields to sessions table (访客信息字段)
  await addColumnIfMissing('sessions', 'email', 'TEXT')
  await addColumnIfMissing('sessions', 'phone', 'TEXT')
  await addColumnIfMissing('sessions', 'pid', 'TEXT')
  await addColumnIfMissing('sessions', 'params', 'TEXT')
  await addColumnIfMissing('sessions', 'referer', 'TEXT')
  await addColumnIfMissing('sessions', 'user_agent', 'TEXT')

  // Add reject_reason to transfer_requests table (转接拒绝原因)
  await addColumnIfMissing('transfer_requests', 'reject_reason', 'TEXT')

  // Ensure visitor_custom_fields table exists (访客自定义字段定义表)
  try {
    const vcfExists = await database.get<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='visitor_custom_fields'"
    )
    if (!vcfExists) {
      await database.exec(
        'CREATE TABLE IF NOT EXISTS visitor_custom_fields (' +
          'id INTEGER PRIMARY KEY AUTOINCREMENT, ' +
          'business_id INTEGER NOT NULL DEFAULT 0, ' +
          'field_key TEXT NOT NULL, ' +
          'label TEXT NOT NULL, ' +
          'type TEXT NOT NULL DEFAULT "text", ' +
          'remark TEXT, ' +
          'sort_order INTEGER NOT NULL DEFAULT 0, ' +
          'is_active INTEGER NOT NULL DEFAULT 1, ' +
          'created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), ' +
          'updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))'
      )
      await database.exec('CREATE INDEX IF NOT EXISTS visitor_custom_fields_business_id_idx ON visitor_custom_fields(business_id)')
      await database.exec('CREATE INDEX IF NOT EXISTS visitor_custom_fields_field_key_idx ON visitor_custom_fields(business_id, field_key)')
      console.log('[Migration] Created visitor_custom_fields table and indexes')
    }
  } catch (error) {
    console.error('[Migration] Failed to ensure visitor_custom_fields table:', error)
  }

  // Add translated_content to messages table (自动翻译功能)
  await addColumnIfMissing('messages', 'translated_content', 'TEXT')

  // Add bd_trans_secret to staff_users table (翻译密钥列 - 与旧版 bd_trans_token 对齐)
  await addColumnIfMissing('staff_users', 'bd_trans_secret', 'TEXT')

  // Add bd_trans_token to staff_users table (旧版翻译密钥列，保持兼容)
  await addColumnIfMissing('staff_users', 'bd_trans_token', 'TEXT')

  // Add missing columns that getBusinessBySlug() depends on
  await addColumnIfMissing('staff_users', 'business_id', 'INTEGER NOT NULL DEFAULT 0')
  await addColumnIfMissing('staff_users', 'enable_auto_trans', 'INTEGER NOT NULL DEFAULT 0')
  await addColumnIfMissing('staff_users', 'bd_trans_appid', 'TEXT')
  await addColumnIfMissing('staff_users', 'default_lang', "TEXT NOT NULL DEFAULT 'zh-CN'")

  // Fix existing staff_users data: ensure admin user has correct role and business_id
  await ensureDefaultStaffData(database)

  console.log('[Database] Migrations complete')
}

async function initializeDefaultAdmin(database: Database): Promise<void> {
  const passwordHash = await hashPassword('123456')

  const existingAdmin = await database.get<{ id: number }>(
    'SELECT id FROM admin_users WHERE username = ?',
    ['admin']
  )

  if (existingAdmin) {
    await database.run(
      'UPDATE admin_users SET password_hash = ?, email = ?, name = ?, status = ?, updated_at = ? WHERE username = ?',
      [passwordHash, 'admin@example.com', '系统管理员', 'active', Date.now(), 'admin']
    )
    console.log('[Database] Default admin user updated: admin/123456 (admin_users)')
  } else {
    await database.run(
      'INSERT INTO admin_users (username, password_hash, email, name, status) VALUES (?, ?, ?, ?, ?)',
      ['admin', passwordHash, 'admin@example.com', '系统管理员', 'active']
    )
    console.log('[Database] Default admin user created: admin/123456 (admin_users)')
  }

  // Initialize staff_users table with default business admin user
  // business_id = 0 表示商家主账号，business_slug 是商家标识
  const existingStaff = await database.get<{ id: number }>(
    'SELECT id FROM staff_users WHERE username = ?',
    ['admin']
  )

  if (existingStaff) {
    await database.run(
      'UPDATE staff_users SET password_hash = ?, email = ?, name = ?, role = ?, status = ?, business_id = ?, business_slug = ?, business_name = ?, updated_at = ? WHERE username = ?',
      [
        passwordHash,
        'admin@example.com',
        '系统管理员',
        'admin',
        'active',
        0,
        'default',
        '默认商家',
        Date.now(),
        'admin',
      ]
    )
    console.log(
      '[Database] Default staff user updated: admin/123456 (staff_users as business admin)'
    )
  } else {
    await database.run(
      'INSERT INTO staff_users (username, password_hash, email, name, role, status, business_id, business_slug, business_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'admin',
        passwordHash,
        'admin@example.com',
        '系统管理员',
        'admin',
        'active',
        0,
        'default',
        '默认商家',
      ]
    )
    console.log(
      '[Database] Default staff user created: admin/123456 (staff_users as business admin)'
    )
  }
}

/**
 * Ensure existing staff_users data is correct (for databases created by older schema versions).
 * Fixes: business_id, enable_auto_trans, bd_trans_appid, default_lang, role, business_slug, business_name
 */
async function ensureDefaultStaffData(database: Database): Promise<void> {
  try {
    // Check if admin user exists but has incorrect data
    const admin = await database.get<{
      id: number; role: string; business_id: number | null;
      business_slug: string | null; business_name: string | null;
      enable_auto_trans: number; default_lang: string;
    }>(
      'SELECT id, role, business_id, business_slug, business_name, enable_auto_trans, default_lang FROM staff_users WHERE username = ?',
      ['admin']
    )
    if (admin) {
      const updates: string[] = []
      const values: unknown[] = []
      
      // Fix business_id: must be 0 for the default business admin
      if (admin.business_id !== 0 && admin.business_id !== null) {
        // business_id not null, check if it needs fixing
      }
      // Always ensure business_id=0, business_slug='default', business_name='默认商家', role='admin'
      updates.push('business_id = 0')
      updates.push('business_slug = COALESCE(business_slug, \'default\')')
      updates.push('business_name = COALESCE(business_name, \'默认商家\')')
      updates.push('role = \'admin\'')
      
      // Ensure translation defaults
      updates.push('enable_auto_trans = COALESCE(enable_auto_trans, 1)')
      updates.push('default_lang = COALESCE(NULLIF(default_lang, \'\'), \'zh-CN\')')
      updates.push('updated_at = ?')
      values.push(Date.now())
      values.push(admin.id)
      
      await database.run(
        `UPDATE staff_users SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
      console.log('[Database] Fixed existing admin user data: business_id=0, role=admin, auto_trans enabled')
    }
  } catch (error) {
    console.error('[Database] Failed to ensure default staff data:', error)
  }
}

async function initializeDefaultRoles(database: Database): Promise<void> {
  // All permissions
  const allPermissions = JSON.stringify([
    'admin_view',
    'admin_edit',
    'staff_view',
    'staff_edit',
    'role_view',
    'role_edit',
    'settings',
  ])

  // Create super admin role (system role, cannot be edited or deleted)
  const existingSuperAdmin = await database.get<{ id: number }>(
    'SELECT id FROM roles WHERE name = ?',
    ['超级管理员']
  )

  if (existingSuperAdmin) {
    await database.run(
      'UPDATE roles SET description = ?, permissions = ?, is_system = ?, status = ?, updated_at = ? WHERE name = ?',
      ['系统默认超级管理员，拥有所有权限', allPermissions, 1, 'active', Date.now(), '超级管理员']
    )
    console.log('[Database] Default super admin role updated')
  } else {
    await database.run(
      'INSERT INTO roles (name, description, permissions, is_system, status) VALUES (?, ?, ?, ?, ?)',
      ['超级管理员', '系统默认超级管理员，拥有所有权限', allPermissions, 1, 'active']
    )
    console.log('[Database] Default super admin role created')
  }
}

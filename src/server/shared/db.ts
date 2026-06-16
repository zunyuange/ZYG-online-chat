/**
 * Database abstraction layer
 * Supports both Node.js sqlite and Cloudflare D1
 */

import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';
import { hashPassword } from './crypto';

// Lazy-loaded require - only created when needed in Node.js environment
let _nodeRequire: typeof require | null = null;

function getNodeRequire(): typeof require {
  if (!_nodeRequire) {
    // Check if we're in a Node.js environment with valid import.meta.url
    if (typeof import.meta.url === 'string' && import.meta.url.startsWith('file://')) {
      _nodeRequire = createRequire(import.meta.url);
    } else {
      throw new Error('Node.js require not available in this environment');
    }
  }
  return _nodeRequire;
}

// Database interface for abstraction
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
}

// D1 Database implementation
class D1DatabaseAdapter implements Database {
  constructor(private db: D1Database) {}

  async exec(sql: string): Promise<void> {
    await this.db.exec(sql);
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const result = await this.db.prepare(sql).bind(...(params || [])).run();
    return {
      changes: result.meta.changes,
      lastInsertRowid: result.meta.last_row_id,
    };
  }

  async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const result = await this.db.prepare(sql).bind(...(params || [])).first<T>();
    return result;
  }

  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.db.prepare(sql).bind(...(params || [])).all<T>();
    return result.results;
  }
}

// Node SQLite implementation
class NodeSQLiteAdapter implements Database {
  private db: import('node:sqlite').DatabaseSync;

  constructor() {
    // Only executed in Node.js environment
    const nodeRequire = getNodeRequire();
    const { DatabaseSync } = nodeRequire('node:sqlite');
    const { existsSync, mkdirSync } = nodeRequire('node:fs');
    const { dirname } = nodeRequire('node:path');

    const dbPath = './data/todos.db';
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async run(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: number }> {
    const stmt = this.db.prepare(sql);
    let result: { changes: number; lastInsertRowid: number | bigint };
    if (params && params.length > 0) {
      result = stmt.run(...params as Parameters<typeof stmt.run>) as { changes: number; lastInsertRowid: number | bigint };
    } else {
      result = stmt.run() as { changes: number; lastInsertRowid: number | bigint };
    }
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid),
    };
  }

  async get<T>(sql: string, params?: unknown[]): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    const result = params && params.length > 0
      ? stmt.get(...params as Parameters<typeof stmt.get>)
      : stmt.get();
    return result as T | null;
  }

  async all<T>(sql: string, params?: unknown[]): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const results = params && params.length > 0
      ? stmt.all(...params as Parameters<typeof stmt.all>)
      : stmt.all();
    return results as T[];
  }
}

// Global database instance
let db: Database | null = null;

/**
 * Initialize database for Node.js environment
 */
export async function initializeNodeDb(): Promise<void> {
  if (db) return;
  db = new NodeSQLiteAdapter();
  await initializeSchema();
}

/**
 * Initialize database for Cloudflare Workers
 */
export async function initializeD1Db(d1Database: D1Database): Promise<void> {
  db = new D1DatabaseAdapter(d1Database);
  await initializeSchema();
}

/**
 * Get database instance
 */
export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized. Call initializeNodeDb() or initializeD1Db() first.');
  }
  return db;
}

/**
 * Initialize database schema
 */
export async function initializeSchema(): Promise<void> {
  const database = getDb();

  // Create todos table
  await database.exec(
    "CREATE TABLE IF NOT EXISTS todos (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "title TEXT NOT NULL, " +
    "description TEXT, " +
    "status TEXT NOT NULL DEFAULT 'pending', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create sessions table
  await database.exec(
    "CREATE TABLE IF NOT EXISTS sessions (" +
    "id TEXT PRIMARY KEY, " +
    "visiter_id TEXT NOT NULL, " +
    "visitor_name TEXT NOT NULL, " +
    "service_id INTEGER DEFAULT 0, " +
    "groupid INTEGER DEFAULT 0, " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "state TEXT NOT NULL DEFAULT 'normal', " +
    "last_message_at INTEGER, " +
    "unread_by_visitor INTEGER DEFAULT 0, " +
    "unread_by_staff INTEGER DEFAULT 0, " +
    "topic TEXT, " +
    "task_status TEXT NOT NULL DEFAULT 'requirement_discussion', " +
    "task_status_updated_at INTEGER, " +
    "queue_position INTEGER, " +
    "estimated_wait_minutes INTEGER, " +
    "ip TEXT, " +
    "from_url TEXT, " +
    "avatar TEXT, " +
    "device TEXT, " +
    "lang TEXT DEFAULT 'cn', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create messages table
  await database.exec(
    "CREATE TABLE IF NOT EXISTS messages (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "session_id TEXT NOT NULL, " +
    "sender_type TEXT NOT NULL, " +
    "content_type TEXT NOT NULL, " +
    "content TEXT NOT NULL, " +
    "thumbnail_url TEXT, " +
    "file_name TEXT, " +
    "file_size INTEGER, " +
    "is_read INTEGER DEFAULT 0, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE)"
  );

  // Create businesses table for multi-tenant support (商家表)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS businesses (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "name TEXT NOT NULL, " +
    "slug TEXT NOT NULL UNIQUE, " +
    "logo TEXT, " +
    "description TEXT, " +
    "theme TEXT NOT NULL DEFAULT 'default', " +
    "state TEXT NOT NULL DEFAULT 'open', " +
    "max_staff_count INTEGER NOT NULL DEFAULT 10, " +
    "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create visitors table for visitor management (访客表)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS visitors (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "business_id INTEGER NOT NULL DEFAULT 1, " +
    "visitor_id TEXT NOT NULL, " +
    "visitor_name TEXT NOT NULL, " +
    "avatar TEXT, " +
    "ip TEXT, " +
    "from_url TEXT, " +
    "device TEXT, " +
    "lang TEXT NOT NULL DEFAULT 'cn', " +
    "status TEXT NOT NULL DEFAULT 'offline', " +
    "last_visit_at INTEGER, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "FOREIGN KEY (business_id) REFERENCES businesses(id))"
  );

  // Create staff_users table for multi-user authentication
  await database.exec(
    "CREATE TABLE IF NOT EXISTS staff_users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "business_id INTEGER NOT NULL DEFAULT 1, " +
    "username TEXT NOT NULL UNIQUE, " +
    "password_hash TEXT NOT NULL, " +
    "email TEXT, " +
    "name TEXT, " +
    "role TEXT NOT NULL DEFAULT 'staff', " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "FOREIGN KEY (business_id) REFERENCES businesses(id))"
  );

  // Create robot_knowledge table for AI auto-reply
  await database.exec(
    "CREATE TABLE IF NOT EXISTS robot_knowledge (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "keyword TEXT NOT NULL, " +
    "question TEXT NOT NULL, " +
    "answer TEXT NOT NULL, " +
    "sort INTEGER NOT NULL DEFAULT 0, " +
    "status INTEGER NOT NULL DEFAULT 1, " +
    "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create faq table for frequently asked questions
  await database.exec(
    "CREATE TABLE IF NOT EXISTS faq (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "question TEXT NOT NULL, " +
    "answer TEXT NOT NULL, " +
    "sort INTEGER NOT NULL DEFAULT 0, " +
    "status INTEGER NOT NULL DEFAULT 1, " +
    "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create evaluations table for visitor feedback
  await database.exec(
    "CREATE TABLE IF NOT EXISTS evaluations (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "session_id TEXT NOT NULL, " +
    "visitor_name TEXT, " +
    "score INTEGER NOT NULL DEFAULT 5, " +
    "comment TEXT, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create banwords table for prohibited words
  await database.exec(
    "CREATE TABLE IF NOT EXISTS banwords (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "keyword TEXT NOT NULL UNIQUE, " +
    "status INTEGER NOT NULL DEFAULT 1, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create staff_groups table for staff grouping
  await database.exec(
    "CREATE TABLE IF NOT EXISTS staff_groups (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "name TEXT NOT NULL UNIQUE, " +
    "description TEXT, " +
    "sort INTEGER NOT NULL DEFAULT 0, " +
    "status INTEGER NOT NULL DEFAULT 1, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create staff_group_members table for staff-group relationships
  await database.exec(
    "CREATE TABLE IF NOT EXISTS staff_group_members (" +
    "group_id INTEGER NOT NULL, " +
    "staff_id INTEGER NOT NULL, " +
    "PRIMARY KEY (group_id, staff_id))"
  );

  // Create sentences table for quick replies (常用语)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS sentences (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "content TEXT NOT NULL, " +
    "staff_id INTEGER NOT NULL, " +
    "tag TEXT, " +
    "state TEXT NOT NULL DEFAULT 'using', " +
    "lang TEXT NOT NULL DEFAULT 'zh-CN', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create offline_messages table for offline visitor messages (留言)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS offline_messages (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "visiter_id TEXT, " +
    "name TEXT NOT NULL, " +
    "mobile TEXT, " +
    "email TEXT, " +
    "content TEXT NOT NULL, " +
    "business_id INTEGER DEFAULT 0, " +
    "ip TEXT, " +
    "from_url TEXT, " +
    "status TEXT NOT NULL DEFAULT 'pending', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create queue table for waiting visitors (排队表)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS queue (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "visiter_id TEXT NOT NULL, " +
    "service_id INTEGER DEFAULT 0, " +
    "groupid INTEGER DEFAULT 0, " +
    "business_id INTEGER DEFAULT 0, " +
    "state TEXT NOT NULL DEFAULT 'waiting', " +
    "position INTEGER DEFAULT 0, " +
    "remind_sent INTEGER DEFAULT 0, " +
    "evaluation_sent INTEGER DEFAULT 0, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create visitor_blacklist table for blacklisted visitors
  await database.exec(
    "CREATE TABLE IF NOT EXISTS visitor_blacklist (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "visiter_id TEXT NOT NULL UNIQUE, " +
    "business_id INTEGER DEFAULT 0, " +
    "reason TEXT, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create evaluation_setting table for visitor feedback settings
  await database.exec(
    "CREATE TABLE IF NOT EXISTS evaluation_setting (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "business_id INTEGER DEFAULT 0, " +
    "title TEXT NOT NULL DEFAULT '满意度评价', " +
    "questions TEXT NOT NULL DEFAULT '[]', " +
    "word_switch TEXT NOT NULL DEFAULT 'close', " +
    "word_title TEXT NOT NULL DEFAULT '', " +
    "status TEXT NOT NULL DEFAULT 'open', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create indexes
  await database.exec("CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at)");
  await database.exec("CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username)");
  await database.exec("CREATE INDEX IF NOT EXISTS staff_users_business_id_idx ON staff_users(business_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS robot_knowledge_keyword_idx ON robot_knowledge(keyword)");
  await database.exec("CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS sessions_visiter_id_idx ON sessions(visiter_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS sentences_staff_id_idx ON sentences(staff_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS offline_messages_created_at_idx ON offline_messages(created_at)");
  await database.exec("CREATE INDEX IF NOT EXISTS queue_visiter_id_idx ON queue(visiter_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS queue_business_id_idx ON queue(business_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS businesses_slug_idx ON businesses(slug)");
  await database.exec("CREATE INDEX IF NOT EXISTS visitors_business_id_idx ON visitors(business_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS visitors_visitor_id_idx ON visitors(visitor_id)");

  // Create admin_users table for admin panel (separate from staff_users)
  await database.exec(
    "CREATE TABLE IF NOT EXISTS admin_users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "username TEXT NOT NULL UNIQUE, " +
    "password_hash TEXT NOT NULL, " +
    "email TEXT, " +
    "name TEXT, " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  await database.exec("CREATE INDEX IF NOT EXISTS admin_users_username_idx ON admin_users(username)");

  // Create admin_config table for system settings
  await database.exec(
    "CREATE TABLE IF NOT EXISTS admin_config (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "key TEXT NOT NULL UNIQUE, " +
    "value TEXT NOT NULL, " +
    "description TEXT, " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  // Create roles table for role-based access control
  await database.exec(
    "CREATE TABLE IF NOT EXISTS roles (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "name TEXT NOT NULL UNIQUE, " +
    "description TEXT, " +
    "permissions TEXT NOT NULL DEFAULT '[]', " +
    "is_system INTEGER NOT NULL DEFAULT 0, " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
  );

  await database.exec("CREATE INDEX IF NOT EXISTS roles_name_idx ON roles(name)");

  // Initialize default admin user (username: admin, password: 123456)
  await initializeDefaultAdmin(database);
  
  // Initialize default roles
  await initializeDefaultRoles(database);
}

async function initializeDefaultAdmin(database: Database): Promise<void> {
  // Create or update default admin user with password 123456
  const passwordHash = await hashPassword('123456');

  // Initialize default business first
  const existingBusiness = await database.get<{ id: number }>('SELECT id FROM businesses WHERE slug = ?', ['default']);

  let businessId = 1;
  if (existingBusiness) {
    console.log('[Database] Default business already exists (id: 1)');
    businessId = existingBusiness.id;
  } else {
    await database.run(
      'INSERT INTO businesses (name, slug, logo, description, theme, state, max_staff_count, lang) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      ['默认商家', 'default', '', '系统默认商家', 'default', 'open', 10, 'zh-CN']
    );
    console.log('[Database] Default business created: 默认商家');
    const newBusiness = await database.get<{ id: number }>('SELECT id FROM businesses WHERE slug = ?', ['default']);
    if (newBusiness) {
      businessId = newBusiness.id;
    }
  }

  // Initialize admin_users table with default admin user
  const existingAdmin = await database.get<{ id: number }>('SELECT id FROM admin_users WHERE username = ?', ['admin']);
  
  if (existingAdmin) {
    // Update existing admin user with correct password
    await database.run(
      'UPDATE admin_users SET password_hash = ?, email = ?, name = ?, status = ?, updated_at = ? WHERE username = ?',
      [passwordHash, 'admin@example.com', '系统管理员', 'active', Date.now(), 'admin']
    );
    console.log('[Database] Default admin user updated: admin/123456 (admin_users)');
  } else {
    // Create new admin user
    await database.run(
      'INSERT INTO admin_users (username, password_hash, email, name, status) VALUES (?, ?, ?, ?, ?)',
      ['admin', passwordHash, 'admin@example.com', '系统管理员', 'active']
    );
    console.log('[Database] Default admin user created: admin/123456 (admin_users)');
  }
  
  // Also initialize staff_users table with default admin user (for staff login)
  // Link to default business
  const existingStaff = await database.get<{ id: number }>('SELECT id FROM staff_users WHERE username = ?', ['admin']);
  
  if (existingStaff) {
    // Update existing staff user with correct password and business_id
    await database.run(
      'UPDATE staff_users SET password_hash = ?, email = ?, name = ?, role = ?, status = ?, business_id = ?, updated_at = ? WHERE username = ?',
      [passwordHash, 'admin@example.com', '系统管理员', 'staff', 'active', businessId, Date.now(), 'admin']
    );
    console.log('[Database] Default admin user updated: admin/123456 (staff_users)');
  } else {
    // Create new staff user with business_id
    await database.run(
      'INSERT INTO staff_users (username, password_hash, email, name, role, status, business_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      ['admin', passwordHash, 'admin@example.com', '系统管理员', 'staff', 'active', businessId]
    );
    console.log('[Database] Default admin user created: admin/123456 (staff_users)');
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
    'settings'
  ]);

  // Create super admin role (system role, cannot be edited or deleted)
  const existingSuperAdmin = await database.get<{ id: number }>('SELECT id FROM roles WHERE name = ?', ['超级管理员']);
  
  if (existingSuperAdmin) {
    await database.run(
      'UPDATE roles SET description = ?, permissions = ?, is_system = ?, status = ?, updated_at = ? WHERE name = ?',
      ['系统默认超级管理员，拥有所有权限', allPermissions, 1, 'active', Date.now(), '超级管理员']
    );
    console.log('[Database] Default super admin role updated');
  } else {
    await database.run(
      'INSERT INTO roles (name, description, permissions, is_system, status) VALUES (?, ?, ?, ?, ?)',
      ['超级管理员', '系统默认超级管理员，拥有所有权限', allPermissions, 1, 'active']
    );
    console.log('[Database] Default super admin role created');
  }
}

/**
 * Database abstraction layer
 * Supports both Node.js sqlite and Cloudflare D1
 */

import { createRequire } from 'node:module';
import type { D1Database } from '@cloudflare/workers-types';

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
    "visitor_name TEXT NOT NULL, " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "last_message_at INTEGER, " +
    "unread_by_visitor INTEGER DEFAULT 0, " +
    "unread_by_staff INTEGER DEFAULT 0, " +
    "topic TEXT, " +
    "task_status TEXT NOT NULL DEFAULT 'requirement_discussion', " +
    "task_status_updated_at INTEGER, " +
    "queue_position INTEGER, " +
    "estimated_wait_minutes INTEGER, " +
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

  // Create staff_users table for multi-user authentication
  await database.exec(
    "CREATE TABLE IF NOT EXISTS staff_users (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
    "username TEXT NOT NULL UNIQUE, " +
    "password_hash TEXT NOT NULL, " +
    "email TEXT, " +
    "name TEXT, " +
    "role TEXT NOT NULL DEFAULT 'staff', " +
    "status TEXT NOT NULL DEFAULT 'active', " +
    "created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000), " +
    "updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000))"
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

  // Create indexes
  await database.exec("CREATE INDEX IF NOT EXISTS messages_session_id_idx ON messages(session_id)");
  await database.exec("CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages(created_at)");
  await database.exec("CREATE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users(username)");
  await database.exec("CREATE INDEX IF NOT EXISTS robot_knowledge_keyword_idx ON robot_knowledge(keyword)");
  await database.exec("CREATE INDEX IF NOT EXISTS evaluations_session_id_idx ON evaluations(session_id)");

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

  // Initialize default admin user (username: admin, password: 123456)
  await initializeDefaultAdmin(database);
}

async function hashPasswordForInit(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function initializeDefaultAdmin(database: Database): Promise<void> {
  // Create or update default admin user with password 123456
  const passwordHash = await hashPasswordForInit('123456');
  
  // Try to update existing admin user
  const existingAdmin = await database.get<{ id: number }>('SELECT id FROM admin_users WHERE username = ?', ['admin']);
  
  if (existingAdmin) {
    // Update existing admin user with correct password
    await database.run(
      'UPDATE admin_users SET password_hash = ?, email = ?, name = ?, status = ?, updated_at = ? WHERE username = ?',
      [passwordHash, 'admin@example.com', '系统管理员', 'active', Date.now(), 'admin']
    );
    console.log('[Database] Default admin user updated: admin/123456');
  } else {
    // Create new admin user
    await database.run(
      'INSERT INTO admin_users (username, password_hash, email, name, status) VALUES (?, ?, ?, ?, ?)',
      ['admin', passwordHash, 'admin@example.com', '系统管理员', 'active']
    );
    console.log('[Database] Default admin user created: admin/123456');
  }
}

/**
 * Storage abstraction layer
 * Supports both Node.js filesystem and Cloudflare R2
 */

import { createRequire } from 'node:module';
import type { R2Bucket } from '@cloudflare/workers-types';

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

// Storage interface for abstraction
export interface Storage {
  put(key: string, data: Uint8Array | ArrayBuffer): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
}

// R2 Storage implementation
class R2StorageAdapter implements Storage {
  constructor(private bucket: R2Bucket) {}

  async put(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
    console.log('[R2Storage] Putting file:', key, 'size:', data.byteLength);
    try {
      // Convert Uint8Array to ArrayBuffer if needed
      const arrayBuffer = data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data;
      await this.bucket.put(key, arrayBuffer);
      console.log('[R2Storage] Successfully put file:', key);
    } catch (error) {
      console.error('[R2Storage] Failed to put file:', key, error);
      throw error;
    }
  }

  async get(key: string): Promise<Uint8Array | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    const arrayBuffer = await object.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  async delete(key: string): Promise<boolean> {
    await this.bucket.delete(key);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    const object = await this.bucket.head(key);
    return object !== null;
  }
}

// Node.js Filesystem implementation
class NodeFileSystemAdapter implements Storage {
  private uploadDir: string;

  constructor(uploadDir: string = './data/uploads') {
    this.uploadDir = uploadDir;
    this.ensureDir();
  }

  private ensureDir(): void {
    // Only executed in Node.js environment
    const nodeRequire = getNodeRequire();
    const { existsSync, mkdirSync } = nodeRequire('node:fs');
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    const nodeRequire = getNodeRequire();
    const { join } = nodeRequire('node:path');
    return join(this.uploadDir, key);
  }

  async put(key: string, data: Uint8Array | ArrayBuffer): Promise<void> {
    const nodeRequire = getNodeRequire();
    const { writeFileSync } = nodeRequire('node:fs');
    const filepath = this.getFilePath(key);

    // Convert to Buffer for Node.js fs
    const buffer = data instanceof Uint8Array
      ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
      : Buffer.from(data);
    writeFileSync(filepath, buffer);
  }

  async get(key: string): Promise<Uint8Array | null> {
    const nodeRequire = getNodeRequire();
    const { existsSync, readFileSync } = nodeRequire('node:fs');
    const filepath = this.getFilePath(key);
    if (!existsSync(filepath)) return null;
    const buffer = readFileSync(filepath);
    return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  }

  async delete(key: string): Promise<boolean> {
    const nodeRequire = getNodeRequire();
    const { existsSync, unlinkSync } = nodeRequire('node:fs');
    const filepath = this.getFilePath(key);
    if (existsSync(filepath)) {
      unlinkSync(filepath);
      return true;
    }
    return false;
  }

  async exists(key: string): Promise<boolean> {
    const nodeRequire = getNodeRequire();
    const { existsSync } = nodeRequire('node:fs');
    const filepath = this.getFilePath(key);
    return existsSync(filepath);
  }
}

// Global storage instance
let storage: Storage | null = null;

/**
 * Initialize storage for Node.js environment
 */
export function initializeNodeStorage(uploadDir?: string): void {
  if (storage) return;
  storage = new NodeFileSystemAdapter(uploadDir);
}

/**
 * Initialize storage for Cloudflare Workers (R2)
 */
export function initializeR2Storage(bucket: R2Bucket): void {
  storage = new R2StorageAdapter(bucket);
}

/**
 * Get storage instance
 */
export function getStorage(): Storage {
  if (!storage) {
    throw new Error('Storage not initialized. Call initializeNodeStorage() or initializeR2Storage() first.');
  }
  return storage;
}

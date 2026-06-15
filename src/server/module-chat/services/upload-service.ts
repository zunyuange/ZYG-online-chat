/**
 * File upload service - handles image and video uploads
 */

import { extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  ALLOWED_FILE_TYPES,
} from '@shared/schemas';
import { getStorage } from '@server/shared/storage';
import type { UploadResponse, ContentType } from '@shared/types';

/**
 * Generate unique filename
 */
function generateFilename(originalName: string): string {
  const ext = extname(originalName) || '.bin';
  return `${randomUUID()}${ext}`;
}

/**
 * Check if file extension is allowed for general files
 */
function isAllowedFileExtension(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  const allowedExtensions = [
    '.txt', '.csv', '.zip', '.ipa', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.apk', '.dmg'
  ];
  return allowedExtensions.includes(ext);
}

/**
 * Detect content type from mime type and filename
 */
function detectContentType(mimeType: string, filename?: string): ContentType | null {
  if (ALLOWED_IMAGE_TYPES.includes(mimeType)) {
    return 'image';
  }
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return 'video';
  }
  // Check for general file types
  if (ALLOWED_FILE_TYPES.includes(mimeType) || mimeType === 'application/octet-stream') {
    // Additional check for IPA files which often have application/octet-stream
    if (filename && isAllowedFileExtension(filename)) {
      return 'file';
    }
    // Allow known MIME types even without extension check
    if (ALLOWED_FILE_TYPES.includes(mimeType)) {
      return 'file';
    }
  }
  return null;
}

/**
 * Validate file type and size
 */
export function validateFile(
  file: { type: string; size: number; name: string },
  _contentType?: 'image' | 'video' | 'file'
): { valid: boolean; error?: string; detectedType?: ContentType } {
  // Auto-detect content type if not specified
  const detectedType = detectContentType(file.type, file.name);

  if (!detectedType) {
    return { valid: false, error: 'Unsupported file type. Allowed: images, videos, CSV, ZIP, IPA, PDF, DOC, XLS' };
  }

  // Validate based on detected type
  if (detectedType === 'image') {
    if (file.size > MAX_IMAGE_SIZE) {
      return { valid: false, error: `Image too large. Max size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, detectedType: 'image' };
  }

  if (detectedType === 'video') {
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: `Video too large. Max size: ${MAX_VIDEO_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, detectedType: 'video' };
  }

  if (detectedType === 'file') {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB` };
    }
    return { valid: true, detectedType: 'file' };
  }

  return { valid: true, detectedType };
}

/**
 * Save file using storage abstraction
 */
export async function saveFileBuffer(
  buffer: Uint8Array | ArrayBuffer,
  originalName: string,
  mimeType: string
): Promise<UploadResponse> {
  try {
    const storage = getStorage();
    const filename = generateFilename(originalName);

    const size = buffer.byteLength;
    console.log('[UploadService] Saving file:', filename, 'size:', size);
    await storage.put(filename, buffer);
    console.log('[UploadService] File saved successfully:', filename);

    // Note: contentType could be used for thumbnail generation in the future
    void detectContentType(mimeType, originalName);

    return {
      url: `/uploads/${filename}`,
      fileName: originalName,
      fileSize: size,
      thumbnailUrl: undefined,
    };
  } catch (error) {
    console.error('[UploadService] Error saving file:', error);
    throw error;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filename: string): Promise<boolean> {
  const storage = getStorage();
  return storage.delete(filename);
}

/**
 * Check if file exists
 */
export async function fileExists(filename: string): Promise<boolean> {
  const storage = getStorage();
  return storage.exists(filename);
}

/**
 * Get file data
 */
export async function getFileData(filename: string): Promise<Uint8Array | null> {
  const storage = getStorage();
  return storage.get(filename);
}

/**
 * Get file URL
 */
export function getFileUrl(filename: string): string {
  return `/uploads/${filename}`;
}

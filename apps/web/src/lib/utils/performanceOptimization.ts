/**
 * Performance Optimization Utilities
 * Phase 3 - Task 3.5: Performance Optimization
 * 
 * Tools for:
 * - Image compression
 * - Query optimization
 * - Caching
 * - Lazy loading
 */

// Image Compression
export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Debounce function for search inputs
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

// Throttle function for scroll events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Simple in-memory cache
class SimpleCache {
  private cache: Map<string, { data: any; timestamp: number }>;
  private ttl: number; // Time to live in milliseconds

  constructor(ttl: number = 5 * 60 * 1000) {
    // Default 5 minutes
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}

export const leadCache = new SimpleCache(5 * 60 * 1000); // 5 minutes
export const reportCache = new SimpleCache(10 * 60 * 1000); // 10 minutes

// Lazy load images
export function lazyLoadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = reject;
    img.src = src;
  });
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Pagination helper
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
}

export function calculatePagination(params: PaginationParams) {
  const { page, limit, total } = params;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    currentPage: page,
    totalPages,
    limit,
    offset,
    hasNext,
    hasPrev,
    startIndex: offset + 1,
    endIndex: Math.min(offset + limit, total),
    total,
  };
}

// Optimize Supabase queries
export function optimizeQuery(query: any, options: {
  select?: string;
  limit?: number;
  offset?: number;
  order?: { column: string; ascending?: boolean };
}) {
  let optimizedQuery = query;

  if (options.select) {
    optimizedQuery = optimizedQuery.select(options.select);
  }

  if (options.order) {
    optimizedQuery = optimizedQuery.order(
      options.order.column,
      { ascending: options.order.ascending ?? true }
    );
  }

  if (options.limit) {
    optimizedQuery = optimizedQuery.limit(options.limit);
  }

  if (options.offset) {
    optimizedQuery = optimizedQuery.range(
      options.offset,
      options.offset + (options.limit || 10) - 1
    );
  }

  return optimizedQuery;
}

// Local storage with expiry
export class LocalStorageWithExpiry {
  static set(key: string, value: any, ttl: number = 3600000): void {
    // Default 1 hour
    const item = {
      value,
      expiry: Date.now() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(item));
  }

  static get(key: string): any | null {
    const itemStr = localStorage.getItem(key);
    
    if (!itemStr) return null;

    try {
      const item = JSON.parse(itemStr);
      
      if (Date.now() > item.expiry) {
        localStorage.removeItem(key);
        return null;
      }

      return item.value;
    } catch {
      return null;
    }
  }

  static remove(key: string): void {
    localStorage.removeItem(key);
  }

  static clear(): void {
    localStorage.clear();
  }
}

// Batch API requests
export async function batchRequests<T>(
  requests: (() => Promise<T>)[],
  batchSize: number = 5
): Promise<T[]> {
  const results: T[] = [];

  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn => fn()));
    results.push(...batchResults);
  }

  return results;
}

// Retry failed requests
export async function retryRequest<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError!;
}


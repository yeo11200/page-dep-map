import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert pageName to URL-safe file slug.
 * Mirrors the analyzer's sanitizeFileName — replaces /\:*?"<>| with _
 */
export function toFileSlug(pageName: string): string {
  return pageName
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

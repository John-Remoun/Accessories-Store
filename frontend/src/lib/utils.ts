import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse date strings for Safari WebKit (Safari fails on "YYYY-MM-DD HH:mm:ss")
 */
export function safeDate(dateInput: string | number | Date | null | undefined): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) return dateInput;
  if (typeof dateInput === 'number') return new Date(dateInput);

  // Convert space between date and time to 'T' for ISO 8601 compliance on Safari
  const str = String(dateInput).trim().replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/, '$1T$2');
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Safely get item from localStorage without throwing DOMExceptions on Safari Private Mode
 */
export function safeGetStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`localStorage getItem failed for key "${key}":`, e);
    return null;
  }
}

/**
 * Safely set item in localStorage without throwing DOMExceptions on Safari Private Mode
 */
export function safeSetStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`localStorage setItem failed for key "${key}":`, e);
  }
}

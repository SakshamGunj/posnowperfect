import { type ClassValue, clsx } from 'clsx';
import { BusinessType, ThemeConfig } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// Generate URL-friendly slug from restaurant name
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Check if slug is valid (URL-friendly)
export function isValidSlug(slug: string): boolean {
  const slugRegex = /^[a-z0-9-]+$/;
  return slugRegex.test(slug) && slug.length >= 3 && slug.length <= 50;
}

// Get theme configuration based on business type
export function getThemeConfig(businessType: BusinessType): ThemeConfig {
  const themes: Record<BusinessType, ThemeConfig> = {
    restaurant: {
      businessType: 'restaurant',
      colors: {
        primary: '#16a34a',
        secondary: '#22c55e',
        accent: '#4ade80',
        background: '#f0fdf4',
        surface: '#ffffff',
        text: '#14532d',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #16a34a 0%, #22c55e 100%)',
        secondary: 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
      },
    },
    cafe: {
      businessType: 'cafe',
      colors: {
        primary: '#ca8a04',
        secondary: '#eab308',
        accent: '#fde047',
        background: '#fefdf8',
        surface: '#ffffff',
        text: '#713f12',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #ca8a04 0%, #eab308 100%)',
        secondary: 'linear-gradient(135deg, #eab308 0%, #fde047 100%)',
      },
    },
    bar: {
      businessType: 'bar',
      colors: {
        primary: '#9333ea',
        secondary: '#a855f7',
        accent: '#c084fc',
        background: '#faf5ff',
        surface: '#ffffff',
        text: '#581c87',
      },
      gradients: {
        primary: 'linear-gradient(135deg, #9333ea 0%, #a855f7 100%)',
        secondary: 'linear-gradient(135deg, #a855f7 0%, #c084fc 100%)',
      },
    },
  };

  return themes[businessType];
}

// Format currency based on restaurant settings (Indian Rupees)
export function formatCurrency(amount: number, currency: string = 'INR'): string {
  // Handle NaN, undefined, null values
  const validAmount = Number(amount) || 0;
  
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
  }).format(validAmount);
}

// Format date based on timezone
export function formatDate(date: Date, timezone: string = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

// Format time separately for better control
export function formatTime(date: Date, timezone: string = 'Asia/Kolkata'): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

// Generate random 4-digit PIN
export function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format (basic)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)\.]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

// Generate order number
export function generateOrderNumber(restaurantId: string): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${restaurantId.slice(0, 3).toUpperCase()}-${timestamp}-${random}`;
}

// Calculate tax amount
export function calculateTax(amount: number, taxRate: number): number {
  return Math.round(amount * (taxRate / 100) * 100) / 100;
}

// Calculate total with tax and discount
export function calculateTotal(
  subtotal: number,
  taxRate: number,
  discount: number = 0
): { tax: number; total: number } {
  const discountedAmount = subtotal - discount;
  const tax = calculateTax(discountedAmount, taxRate);
  const total = discountedAmount + tax;
  
  return {
    tax: Math.max(0, tax),
    total: Math.max(0, total),
  };
}

// Debounce function for search and other operations
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle function for frequent operations
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

// Deep clone object (for state management)
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as unknown as T;
  if (typeof obj === 'object') {
    const clonedObj = {} as { [key: string]: any };
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj as T;
  }
  return obj;
}

// Check if user has permission
export function hasPermission(
  userPermissions: string[],
  requiredPermission: string
): boolean {
  return userPermissions.includes(requiredPermission) || userPermissions.includes('admin');
}

// Generate a unique ID (alternative to uuid)
export function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Sanitize input for security
export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}

// Validate business hours format
export function isValidBusinessHours(hours: string): boolean {
  const hoursRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]\s*-\s*([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return hoursRegex.test(hours);
}

// Format business hours for display
export function formatBusinessHours(hours: string): string {
  if (!isValidBusinessHours(hours)) return hours;
  
  const [start, end] = hours.split('-').map(time => time.trim());
  const formatTime = (time: string) => {
    const [hour, minute] = time.split(':');
    const hourNum = parseInt(hour);
    const ampm = hourNum >= 12 ? 'PM' : 'AM';
    const displayHour = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    return `${displayHour}:${minute} ${ampm}`;
  };
  
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// Get business type display name
export function getBusinessTypeDisplayName(type: BusinessType): string {
  const displayNames: Record<BusinessType, string> = {
    restaurant: 'Restaurant',
    cafe: 'Café',
    bar: 'Bar & Lounge',
  };
  return displayNames[type] || type;
}

// Error handler for async operations
export function handleAsyncError(error: any): string {
  if (error?.message) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred';
}

// Local storage utilities with error handling
export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  },
  
  set: <T>(key: string, value: T): void => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },
  
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },
  
  clear: (): void => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  },
}; 
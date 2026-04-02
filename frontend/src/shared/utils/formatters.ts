/**
 * Formatting Utilities
 * Functions for formatting dates, currency, numbers, etc.
 */

/**
 * Format a date string to a localized date format
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  }
): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString ===
   'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-IN', options);
  } catch {
    return '-';
  }
}

/**
 * Format a date string to ISO date format (YYYY-MM-DD)
 */
export function formatDateISO(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  
  try {
    const date = typeof dateString ===
   'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format a date string to a relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return '-';
  
  try {
    const date = typeof dateString ===
   'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)} weeks ago`;
    
    return formatDate(date);
  } catch {
    return '-';
  }
}

/**
 * Format currency in INR
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  options: { showSymbol?: boolean; decimals?: number } = {}
): string {
  const { showSymbol = true, decimals = 0 } = options;
  
  if (amount ===
   null || amount ===
   undefined || amount ===
   '') return showSymbol ? '₹0' : '0';
  
  const numAmount = typeof amount ===
   'string' ? parseFloat(amount) : amount;
  if (isNaN(numAmount)) return showSymbol ? '₹0' : '0';
  
  const formatted = numAmount.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  
  return showSymbol ? `₹${formatted}` : formatted;
}

/**
 * Format a number with commas
 */
export function formatNumber(
  value: number | string | null | undefined,
  decimals: number = 0
): string {
  if (value ===
   null || value ===
   undefined || value ===
   '') return '0';
  
  const numValue = typeof value ===
   'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  
  return numValue.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes ===
   0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format percentage
 */
export function formatPercentage(
  value: number | string | null | undefined,
  decimals: number = 1
): string {
  if (value ===
   null || value ===
   undefined || value ===
   '') return '0%';
  
  const numValue = typeof value ===
   'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0%';
  
  return `${numValue.toFixed(decimals)}%`;
}

/**
 * Format user's full name
 */
export function formatFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null
): string {
  return [firstName, middleName, lastName]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Unknown';
}

/**
 * Format a string to title case
 */
export function toTitleCase(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Format status for display (converts snake_case to Title Case)
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return '-';
  return toTitleCase(status);
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}...`;
}

/**
 * Format phone number (Indian format)
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '-';
  
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as Indian phone number
  if (cleaned.length ===
   10) {
    return `+91 ${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
  }
  if (cleaned.length ===
   12 && cleaned.startsWith('91')) {
    return `+91 ${cleaned.substring(2, 7)} ${cleaned.substring(7)}`;
  }
  
  return phone;
}

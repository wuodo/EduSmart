/**
 * Utility functions for multi-tenant support
 */

export interface Tenant {
  id: number;
  name: string;
  subdomain?: string;
  domain?: string;
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  isActive: boolean;
}

/**
 * Detect tenant from current URL
 * Supports both subdomain (business.edusmart.com) and path (/business/...) approaches
 */
export function detectTenantFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const hostname = window.location.hostname;
  const pathname = window.location.pathname;

  // Method 1: Check subdomain
  const subdomain = hostname.split('.')[0];
  if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && subdomain !== '127') {
    return subdomain;
  }

  // Method 2: Check path
  const pathParts = pathname.split('/').filter(Boolean);
  if (pathParts.length > 0) {
    return pathParts[0];
  }

  return null;
}

/**
 * Get tenant-aware API base URL
 */
export function getApiBaseUrl(): string {
  const tenant = detectTenantFromUrl();
  
  if (tenant) {
    // For development, use header-based tenant resolution
    return '/api/proxy';
  }
  
  return '/api/proxy';
}

/**
 * Add tenant headers to fetch requests
 */
export function addTenantHeaders(headers: HeadersInit = {}): HeadersInit {
  const tenant = detectTenantFromUrl();
  
  if (tenant) {
    return {
      ...headers,
      'x-tenant': tenant
    };
  }
  
  return headers;
}

/**
 * Create tenant-aware fetch function
 */
export async function tenantFetch(
  endpoint: string, 
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${endpoint}`;
  
  const headers = addTenantHeaders(options.headers);
  
  return fetch(url, {
    ...options,
    headers
  });
}

/**
 * Get tenant-specific branding colors
 */
export function getTenantColors(): {
  primary: string;
  secondary: string;
  accent: string;
} {
  const tenant = detectTenantFromUrl();
  
  // Default Business School colors
  const defaultColors = {
    primary: '#0d9488',
    secondary: '#afd657',
    accent: '#39b1ed'
  };
  
  // Health School colors
  if (tenant === 'health') {
    return {
      primary: '#2e7d32',
      secondary: '#4caf50',
      accent: '#2196f3'
    };
  }
  
  return defaultColors;
}

/**
 * Get tenant name for display
 */
export function getTenantName(): string {
  const tenant = detectTenantFromUrl();
  
  switch (tenant) {
    case 'business':
      return 'Business School';
    case 'health':
      return 'Health School';
    default:
      return 'Business School';
  }
}

/**
 * Check if current tenant is active
 */
export function isTenantActive(): boolean {
  const tenant = detectTenantFromUrl();
  return !!tenant; // For now, assume any detected tenant is active
}












export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'; 

// Frontend-safe base that always goes through Next.js proxy
export const WEB_API = '/api/proxy'; 
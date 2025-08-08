export const getBaseUrl = () => {
  if (typeof window !== 'undefined') return window.location.origin
  if (process.env.NODE_ENV === 'production') return process.env.NEXT_PUBLIC_APP_URL || 'https://example.com'
  
  // In development, use webhook URL if available (for QStash compatibility)
  if (process.env.NEXT_PUBLIC_WEBHOOK_URL) {
    return process.env.NEXT_PUBLIC_WEBHOOK_URL
  }
  
  return 'http://localhost:3000'
} 
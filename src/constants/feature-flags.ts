export const FEATURE_FLAGS = Object.freeze({
	// Enables fetching real Twitter analytics. When false, the app uses dummy analytics.
	// Server: set ENABLE_TWITTER_ANALYTICS=true
	// Client: set NEXT_PUBLIC_ENABLE_TWITTER_ANALYTICS=true
	ENABLE_TWITTER_ANALYTICS: (() => {
		const raw = typeof window === 'undefined'
			? process.env.ENABLE_TWITTER_ANALYTICS
			: process.env.NEXT_PUBLIC_ENABLE_TWITTER_ANALYTICS
		const value = String(raw ?? '').toLowerCase().trim()
		return value === '1' || value === 'true' || value === 'yes'
	})(),
})

export const ENABLE_TWITTER_ANALYTICS = FEATURE_FLAGS.ENABLE_TWITTER_ANALYTICS 
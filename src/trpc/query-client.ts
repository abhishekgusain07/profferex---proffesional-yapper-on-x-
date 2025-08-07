import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from '@tanstack/react-query'
import superjson from 'superjson'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: 30 * 1000, // 30 seconds
        retry: (failureCount, error: any) => {
          // Don't retry on 4xx errors (client errors)
          if (error?.status >= 400 && error?.status < 500) {
            return false
          }
          // Retry up to 3 times for other errors
          return failureCount < 3
        },
      },
      mutations: {
        retry: (failureCount, error: any) => {
          // Don't retry mutations by default
          if (error?.status >= 400 && error?.status < 500) {
            return false
          }
          return failureCount < 1 // Only retry once for server errors
        },
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === 'pending',
        // Use superjson for serialization
        serializeData: superjson.serialize,
      },
      hydrate: {
        // Use superjson for deserialization
        deserializeData: superjson.deserialize,
      },
    },
  })
}
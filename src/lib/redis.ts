import { Redis } from "@upstash/redis"

// Minimal in-memory Redis fallback for local development when Upstash env vars are missing.
// Supports only the methods used in this codebase: get, set, lrange, lpush, llen, del, lrem.
class InMemoryRedis {
  private kvStore: Map<string, string> = new Map()
  private listStore: Map<string, string[]> = new Map()
  private jsonStore: Map<string, any> = new Map()

  async get(key: string): Promise<string | null> {
    return this.kvStore.has(key) ? (this.kvStore.get(key) as string) : null
  }

  async set(key: string, value: string, _opts?: { ex?: number }): Promise<"OK"> {
    this.kvStore.set(key, value)
    return "OK"
  }

  async exists(key: string): Promise<number> {
    return this.jsonStore.has(key) || this.kvStore.has(key) || this.listStore.has(key) ? 1 : 0
  }

  // JSON operations for style data
  json = {
    get: async <T = any>(key: string, path?: string): Promise<T | null> => {
      const data = this.jsonStore.get(key)
      if (!data) return null
      
      if (!path || path === '$') {
        return data as T
      }
      
      // Simple path resolution for nested properties
      const pathParts = path.replace(/^\$\./, '').split('.')
      let result = data
      for (const part of pathParts) {
        if (result && typeof result === 'object' && part in result) {
          result = result[part]
        } else {
          return null
        }
      }
      return result as T
    },

    set: async (key: string, path: string, value: any): Promise<"OK"> => {
      if (!path || path === '$') {
        this.jsonStore.set(key, value)
        return "OK"
      }

      let data = this.jsonStore.get(key) || {}
      
      if (path.startsWith('$.')) {
        const pathParts = path.substring(2).split('.')
        let current = data
        
        for (let i = 0; i < pathParts.length - 1; i++) {
          const part = pathParts[i]
          if (!current[part] || typeof current[part] !== 'object') {
            current[part] = {}
          }
          current = current[part]
        }
        
        const finalKey = pathParts[pathParts.length - 1]
        current[finalKey] = value
      } else {
        data = value
      }
      
      this.jsonStore.set(key, data)
      return "OK"
    },

    merge: async (key: string, path: string, value: any): Promise<"OK"> => {
      const existing = await this.json.get(key, path) || {}
      const merged = { ...existing, ...value }
      return await this.json.set(key, path, merged)
    },

    del: async (key: string, path?: string): Promise<number> => {
      if (!path || path === '$') {
        return this.jsonStore.delete(key) ? 1 : 0
      }
      
      const data = this.jsonStore.get(key)
      if (!data) return 0
      
      const pathParts = path.replace(/^\$\./, '').split('.')
      let current = data
      
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i]
        if (!current[part]) return 0
        current = current[part]
      }
      
      const finalKey = pathParts[pathParts.length - 1]
      if (finalKey in current) {
        delete current[finalKey]
        this.jsonStore.set(key, data)
        return 1
      }
      
      return 0
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    const list = this.listStore.get(key) ?? []
    list.unshift(value)
    this.listStore.set(key, list)
    return list.length
  }

  async lrange(key: string, start: number, end: number): Promise<string[]> {
    const list = this.listStore.get(key) ?? []
    // Upstash/Redis lrange end is inclusive; -1 means end of list
    const normalizedEnd = end === -1 ? list.length - 1 : end
    return list.slice(start, normalizedEnd + 1)
  }

  async llen(key: string): Promise<number> {
    const list = this.listStore.get(key) ?? []
    return list.length
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    for (const key of keys) {
      if (this.kvStore.delete(key)) deleted++
      if (this.listStore.delete(key)) deleted++
      if (this.jsonStore.delete(key)) deleted++
    }
    return deleted
  }

  async lrem(key: string, count: number, value: string): Promise<number> {
    const list = this.listStore.get(key) ?? []
    if (list.length === 0) return 0

    let removed = 0
    if (count === 0) {
      // Remove all occurrences
      const filtered = list.filter((v) => v !== value)
      removed = list.length - filtered.length
      this.listStore.set(key, filtered)
      return removed
    }

    const isReverse = count < 0
    const target = Math.abs(count)
    const iter = isReverse ? [...list].reverse() : [...list]
    const indicesToRemove: number[] = []

    for (let i = 0, found = 0; i < iter.length && found < target; i++) {
      if (iter[i] === value) {
        const originalIndex = isReverse ? list.length - 1 - i : i
        indicesToRemove.push(originalIndex)
        found++
      }
    }

    if (indicesToRemove.length > 0) {
      // Remove from highest index to lowest to keep indices valid
      indicesToRemove.sort((a, b) => b - a)
      for (const idx of indicesToRemove) {
        list.splice(idx, 1)
      }
      removed = indicesToRemove.length
      this.listStore.set(key, list)
    }

    return removed
  }
}

const hasUpstashEnv = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
)

export const redis: any = hasUpstashEnv
  ? Redis.fromEnv()
  : new InMemoryRedis()

if (!hasUpstashEnv && process.env.NODE_ENV !== "production") {
  console.warn(
    "[thetwittertool] UPSTASH_REDIS_REST_URL/TOKEN not found. Using in-memory Redis fallback for development."
  )
} 
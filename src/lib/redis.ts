import { Redis } from "@upstash/redis"

// Minimal in-memory Redis fallback for local development when Upstash env vars are missing.
// Supports only the methods used in this codebase: get, set, lrange, lpush, llen, del, lrem.
class InMemoryRedis {
  private kvStore: Map<string, string> = new Map()
  private listStore: Map<string, string[]> = new Map()

  async get(key: string): Promise<string | null> {
    return this.kvStore.has(key) ? (this.kvStore.get(key) as string) : null
  }

  async set(key: string, value: string, _opts?: { ex?: number }): Promise<"OK"> {
    this.kvStore.set(key, value)
    return "OK"
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
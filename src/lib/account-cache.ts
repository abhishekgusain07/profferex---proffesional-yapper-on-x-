import { redis } from './redis'

export interface CachedAccountData {
  id: string
  accountId: string
  username: string
  displayName: string
  profileImage: string
  verified: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class AccountCache {
  private static getUserAccountKey(userId: string, accountId: string): string {
    return `account:${userId}:${accountId}`
  }

  private static getUserAccountsListKey(userId: string): string {
    return `accounts:${userId}`
  }

  private static getActiveAccountKey(userId: string): string {
    return `active-account:${userId}`
  }

  private static getUserAccountByUsernameKey(userId: string, username: string): string {
    return `account-username:${userId}:${username}`
  }

  // Cache account data
  static async cacheAccount(userId: string, accountData: CachedAccountData): Promise<void> {
    const accountKey = this.getUserAccountKey(userId, accountData.accountId)
    const accountsListKey = this.getUserAccountsListKey(userId)
    const usernameKey = this.getUserAccountByUsernameKey(userId, accountData.username)

    await Promise.all([
      // Cache individual account
      redis.setex(accountKey, 3600, JSON.stringify(accountData)), // 1 hour TTL
      // Add to user's account list
      redis.sadd(accountsListKey, accountData.accountId),
      redis.expire(accountsListKey, 3600),
      // Cache username lookup for deduplication
      redis.setex(usernameKey, 3600, accountData.accountId),
    ])
  }

  // Get cached account data
  static async getAccount(userId: string, accountId: string): Promise<CachedAccountData | null> {
    const accountKey = this.getUserAccountKey(userId, accountId)
    const cached = await redis.get<string>(accountKey)
    
    if (!cached) return null
    
    try {
      const data = JSON.parse(cached)
      return {
        ...data,
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      }
    } catch {
      return null
    }
  }

  // Get all cached accounts for user
  static async getUserAccounts(userId: string): Promise<CachedAccountData[]> {
    const accountsListKey = this.getUserAccountsListKey(userId)
    const accountIds = await redis.smembers(accountsListKey)
    
    if (!accountIds.length) return []

    const accounts = await Promise.all(
      accountIds.map(accountId => this.getAccount(userId, accountId))
    )

    return accounts.filter((account): account is CachedAccountData => account !== null)
  }

  // Check if username already exists for user (for deduplication)
  static async isUsernameConnected(userId: string, username: string): Promise<string | null> {
    const usernameKey = this.getUserAccountByUsernameKey(userId, username)
    return await redis.get<string>(usernameKey)
  }

  // Set active account
  static async setActiveAccount(userId: string, accountId: string): Promise<void> {
    const activeAccountKey = this.getActiveAccountKey(userId)
    await redis.setex(activeAccountKey, 3600, accountId)
  }

  // Get active account ID
  static async getActiveAccountId(userId: string): Promise<string | null> {
    const activeAccountKey = this.getActiveAccountKey(userId)
    return await redis.get<string>(activeAccountKey)
  }

  // Remove account from cache
  static async removeAccount(userId: string, accountId: string, username: string): Promise<void> {
    const accountKey = this.getUserAccountKey(userId, accountId)
    const accountsListKey = this.getUserAccountsListKey(userId)
    const usernameKey = this.getUserAccountByUsernameKey(userId, username)
    const activeAccountKey = this.getActiveAccountKey(userId)

    // Check if this is the active account
    const activeAccountId = await redis.get<string>(activeAccountKey)
    
    await Promise.all([
      redis.del(accountKey),
      redis.del(usernameKey),
      redis.srem(accountsListKey, accountId),
      // Clear active account if this was the active one
      activeAccountId === accountId ? redis.del(activeAccountKey) : Promise.resolve(),
    ])
  }

  // Clear all cached data for user
  static async clearUserCache(userId: string): Promise<void> {
    const accountsListKey = this.getUserAccountsListKey(userId)
    const activeAccountKey = this.getActiveAccountKey(userId)
    
    // Get all account IDs first
    const accountIds = await redis.smembers(accountsListKey)
    
    // Build all keys to delete
    const keysToDelete = [
      accountsListKey,
      activeAccountKey,
      ...accountIds.map(accountId => this.getUserAccountKey(userId, accountId)),
    ]

    if (keysToDelete.length > 0) {
      await redis.del(...keysToDelete)
    }
  }
}
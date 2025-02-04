import { Cache, CacheConfiguration, Loader } from '../DataSources'
import type { Redis } from 'ioredis'

export interface RedisCacheConfiguration extends CacheConfiguration {
  prefix: string
  json: boolean
}

const DefaultConfiguration: RedisCacheConfiguration = {
  json: false,
  prefix: 'layered-cache:',
  ttlInMsecs: 1000 * 60 * 10,
}

export class RedisCache<T> implements Cache<T>, Loader<T> {
  private readonly redis: Redis
  private readonly config: RedisCacheConfiguration
  name = 'Redis cache'
  isCache = true

  constructor(redis: Redis, config: RedisCacheConfiguration = DefaultConfiguration) {
    this.redis = redis
    this.config = config
  }

  async clear(): Promise<void> {
    await this.redis.flushdb()
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(this.resolveKey(key))
  }

  async get(key: string): Promise<T | undefined> {
    const redisResult = await this.redis.get(this.resolveKey(key))
    if (redisResult && this.config.json) {
      return JSON.parse(redisResult)
    }

    // Redis returns "null" for unknown values
    // ToDo We should create some fictional value for explicitly null values for redis
    if (redisResult === null) {
      return undefined
    }

    return redisResult as unknown as T
  }

  async set(key: string, value: T | null): Promise<void> {
    const resolvedValue: string = value && this.config.json ? JSON.stringify(value) : (value as unknown as string)

    if (this.config.ttlInMsecs) {
      await this.redis.set(this.resolveKey(key), resolvedValue, 'PX', this.config.ttlInMsecs)
      return
    }
    await this.redis.set(this.resolveKey(key), resolvedValue)
  }

  resolveKey(key: string) {
    return `${this.config.prefix}${key}`
  }
}

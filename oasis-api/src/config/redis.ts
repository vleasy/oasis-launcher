type CacheEntry = { value: string; expiry: number };

const memoryStore = new Map<string, CacheEntry>();

function memoryCache() {
  return {
    get: async (key: string): Promise<string | null> => {
      const entry = memoryStore.get(key);
      if (!entry) return null;
      if (entry.expiry && Date.now() > entry.expiry) {
        memoryStore.delete(key);
        return null;
      }
      return entry.value;
    },
    setex: async (key: string, seconds: number, value: string): Promise<void> => {
      memoryStore.set(key, { value, expiry: Date.now() + seconds * 1000 });
    },
    del: async (key: string): Promise<void> => {
      memoryStore.delete(key);
    },
    quit: async (): Promise<void> => {
      memoryStore.clear();
    },
  };
}

let cache: ReturnType<typeof memoryCache>;

const redisUrl = process.env.REDIS_URL;
if (redisUrl) {
  try {
    const Redis = require("ioredis");
    const redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy() {
        return null;
      },
      lazyConnect: true,
    });
    redis.connect().catch(() => {});
    cache = redis;
  } catch {
    cache = memoryCache();
  }
} else {
  cache = memoryCache();
}

export function getRedis() {
  return cache;
}

export async function closeRedis(): Promise<void> {
  await cache.quit();
}

import Redis from 'ioredis';

export function redis() {
  if (globalThis.scopeCheckRedis) return globalThis.scopeCheckRedis;
  const url = new URL(process.env.REDIS_URL);
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('Use a Redis connection URL.');
  const client = new Redis(url.href, {
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 0,
    autoResendUnfulfilledCommands: false,
    retryStrategy: attempt => Math.min(attempt * 250, 3000),
  });
  client.on('error', error => {
    if (client.status !== 'reconnecting') console.error('Redis connection failed', error.code ?? error.name);
  });
  globalThis.scopeCheckRedis = client;
  return client;
}

export function incrementWindow(key, seconds) {
  return redis().eval(`
    local count = redis.call('INCR', KEYS[1])
    if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
    return count
  `, 1, `scopecheck:limit:${key}`, seconds);
}

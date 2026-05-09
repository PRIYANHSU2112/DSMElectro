import IORedis from 'ioredis';
import logger from "../utils/logger.js";

const redisClient = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    maxRetriesPerRequest: null,
    keepAlive: 10000,
    password: process.env.REDIS_PASSWORD || undefined,
});

// node-redis uses camelCase (setEx), ioredis uses lowercase (setex)
// alias for backward compatibility with existing service code
redisClient.setEx = redisClient.setex.bind(redisClient);

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') {
        logger.warn('⚠️  Redis connection failed: Redis server not valid (Is it running?). Caching will be skipped.');
    } else {
        logger.error(`Redis error: ${err.message}`);
    }
});

// ioredis auto-connects, so connectRedis just waits for the ready state
export const connectRedis = () => {
    return new Promise((resolve, reject) => {
        if (redisClient.status === 'ready') {
            resolve();
            return;
        }
        redisClient.once('ready', resolve);
        redisClient.once('error', reject);
    });
};

export default redisClient;

const redis = require("./redisClient");

async function clearTenantCache(tenantId) {
  try {
    const keys = await redis.keys(`tenant:${tenantId}:*`);
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`Cleared cache for tenant ${tenantId}`);
    } else {
      console.log(`No cache found for tenant ${tenantId}`);
    }
  } catch (err) {
    console.error("Error clearing cache:", err.message);
  }
}

module.exports = { clearTenantCache };

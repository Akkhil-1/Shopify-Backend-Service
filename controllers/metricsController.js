const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const redis = require("../utils/redisClient");

const getOverview = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });

    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const cacheKey = `tenant:${tenant.id}:overview`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.warn("Corrupt cache, clearing...");
        await redis.del(cacheKey);
      }
    }

    const totalCustomers = await prisma.customer.count({
      where: { tenantId: tenant.id },
    });
    const totalOrders = await prisma.order.count({
      where: { tenantId: tenant.id },
    });
    const totalRevenue = await prisma.order.aggregate({
      _sum: { totalPrice: true },
      where: { tenantId: tenant.id },
    });

    const data = {
      customers: totalCustomers,
      orders: totalOrders,
      revenue: totalRevenue._sum.totalPrice || 0,
    };

    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    return res.json(data);
  } catch (err) {
    console.error("Error in getOverview:", err);
    return res.status(500).json({ msg: "Failed to fetch overview" });
  }
};

const getTopCustomers = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const cacheKey = `tenant:${tenant.id}:topcustomers`;
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.warn("Corrupt cache, clearing...");
        await redis.del(cacheKey);
      }
    }

    const limit = parseInt(req.query.limit) || 5;

    const topCustomers = await prisma.order.groupBy({
      by: ["customerId"],
      where: { tenantId: tenant.id },
      _sum: { totalPrice: true },
      _count: { id: true },
      orderBy: { _sum: { totalPrice: "desc" } },
      take: limit,
    });

    const customers = await Promise.all(
      topCustomers.map(async (c) => {
        const customer = await prisma.customer.findUnique({
          where: { id_tenantId: { id: c.customerId, tenantId: tenant.id } },
        });

        return {
          name:
            `${customer?.firstName || ""} ${customer?.lastName || ""}`.trim() ||
            customer?.email ||
            "Unknown",
          spent: c._sum.totalPrice || 0,
        };
      })
    );

    await redis.set(cacheKey, JSON.stringify(customers), { ex: 300 });

    return res.json(customers);
  } catch (err) {
    console.error("Error in getTopCustomers:", err.message);
    return res.status(500).json({ msg: "Failed to fetch top customers" });
  }
};
const getRecentOrders = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.warn("Corrupt cache, clearing...");
        await redis.del(cacheKey);
      }
    }

    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
      select: {
        id: true,
        totalPrice: true,
        financialStatus: true,
        createdAt: true,
        customer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    await redis.set(cacheKey, JSON.stringify(orders), { ex: 300 });

    res.json(
      orders.map((o) => ({
        customer:
          `${o.customer?.firstName || ""} ${o.customer?.lastName || ""}`.trim() ||
          o.customer?.email ||
          "Unknown",
        amount: o.totalPrice,
        status: o.financialStatus || "N/A",
        date: o.createdAt,
      }))
    );
  } catch (err) {
    console.error("Error in getRecentOrders:", err);
    return res.status(500).json({ msg: "Failed to fetch recent orders" });
  }
};

const financialStatus = async(req,res)=>{
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.warn("Corrupt cache, clearing...");
        await redis.del(cacheKey);
      }
    }
    const statusCounts = await prisma.order.groupBy({
      by: ["financialStatus"],
      where: { tenantId: tenant.id },
      _count: { financialStatus: true },
    });
    const result = statusCounts.map((s) => ({
      status: s.financialStatus || "UNKNOWN",
      count: s._count.financialStatus,
    }));

    await redis.set(cacheKey, JSON.stringify(result), { ex: 300 });

    res.json(result);

  } catch (error) {
    console.error("Error in getting financialStatus:", err);
    return res.status(500).json({ msg: "Failed to fetch financialStatus" });
  }
}
module.exports = {
  getOverview,
  getTopCustomers,
  getRecentOrders,
  financialStatus
};

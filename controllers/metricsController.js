const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const redis = require('../utils/redisClient')

const getOverview = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });

    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const cacheKey = `tenant:${tenant.id}:overview`;
    const cached = await redis.get(cacheKey)

    if (cached) {
      return res.json({ msg: "Overview (cached)", ...cached });
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
      totalCustomers,
      totalOrders,
      totalRevenue: totalRevenue._sum.totalPrice || 0,
    };

    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    return res.json({ msg: "Dats is : ", ...data });

  } catch (err) {
    console.error("Error in getOverview:", err.message);
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
      console.log("Cache HIT: top customers");
      return res.json({ msg: "Top customers by spend (cached)", data: cached });
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
          id: customer?.id || c.customerId,
          email: customer?.email || null,
          firstName: customer?.firstName || null,
          lastName: customer?.lastName || null,
          totalSpent: c._sum.totalPrice || 0,
          ordersCount: c._count.id,
        };
      })
    );

    await redis.set(cacheKey, JSON.stringify(customers), { ex: 300 });

    return res.json({ msg: "Top customers by spend (fresh)", data: customers });
  } catch (err) {
    console.error("Error in getTopCustomers:", err.message);
    return res.status(500).json({ msg: "Failed to fetch top customers" });
  }
};

const getOrdersByDate = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const { from, to } = req.query;

    const orders = await prisma.order.groupBy({
      by: ["createdAt"],
      _sum: { totalPrice: true },
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: from ? new Date(from) : undefined,
          lte: to ? new Date(to) : undefined,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return res.json({
      msg: "Orders grouped by date",
    });
  } catch (err) {
    console.error("Error in getOrdersByDate:", err.message);
    return res.status(500).json({ msg: "Failed to fetch orders by date" });
  }
};
module.exports = { 
    getOverview,
    getTopCustomers,
    getOrdersByDate
};

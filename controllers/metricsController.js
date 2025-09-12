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
        console.log("clearing cache");
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
      revenue: Math.round(totalRevenue._sum.totalPrice || 0),
    };

    await redis.set(cacheKey, JSON.stringify(data), { ex: 300 });

    return res.json(data);
  } catch (error) {
    console.error("Error in getOverview:", error);
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
        console.log("clearing cache");
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
  } catch (error) {
    console.error("Error in getTopCustomers:", error.message);
    return res.status(500).json({ msg: "Failed to fetch top customers" });
  }
};
const getRecentOrders = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });
    const cacheKey = `tenant:${tenant.id}:getRecentOrders`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.log("clearing cache");
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
          `${o.customer?.firstName || ""} ${
            o.customer?.lastName || ""
          }`.trim() ||
          o.customer?.email ||
          "Unknown",
        amount: o.totalPrice,
        status: o.financialStatus || "N/A",
        date: o.createdAt,
      }))
    );
  } catch (error) {
    console.error("Error in getRecentOrders:", error);
    return res.status(500).json({ msg: "Failed to fetch recent orders" });
  }
};

const financialStatus = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) return res.status(404).json({ msg: "No tenant found" });
    const cacheKey = `tenant:${tenant.id}:financialStatus`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (e) {
        console.log("clearing cache");
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
    console.error("Error in getting financialStatus:", error);
    return res.status(500).json({ msg: "Failed to fetch financialStatus" });
  }
};
const getDailyIncome  = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) {
      return res.status(404).json({ msg: "No tenant found" });
    }

    const cacheKey = `tenant:${tenant.id}:monthlyincome`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch (error) {
        await redis.del(cacheKey);
      }
    }

    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: { totalPrice: true, createdAt: true },
    });

    const incomeMap = {};
    orders.forEach((o) => {
      const day = o.createdAt.getDate(); // 1..31
      incomeMap[day] = (incomeMap[day] || 0) + o.totalPrice;
    });

    const daysInMonth = endOfMonth.getDate();
    const dailyIncome = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      income: incomeMap[i + 1] || 0,
    }));

    await redis.set(cacheKey, JSON.stringify(dailyIncome), { ex: 300 });
    return res.json(dailyIncome);
  } catch (error) {
    console.log("Error in getting monthly income", error);
    return res.status(500).json({ msg: "Failed to fetch monthly income" });
  }
};

const monthlySale = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });
    if (!tenant) {
      return res.status(404).json({ msg: "No tenant found" });
    }

    const cacheKey = `tenant:${tenant.id}:monthlySale`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      try {
        return res.json(JSON.parse(cached));
      } catch {
        await redis.del(cacheKey);
      }
    }
    const orders = await prisma.order.findMany({
      where: { tenantId: tenant.id },
      select: { totalPrice: true, createdAt: true },
    });

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthlyData = months.map((m) => ({ month: m, sales: 0 }));

    for (let i = 0; i < orders.length; i++) {
      const monthIndex = new Date(orders[i].createdAt).getMonth();
      monthlyData[monthIndex].sales += orders[i].totalPrice;
    }
    await redis.set(cacheKey, JSON.stringify(monthlyData), { ex: 300 });
    return res.json(monthlyData);
  } catch (error) {
    console.error("Error in monthlySale:", error.message);
    return res.status(500).json({ msg: "Failed to fetch monthly sales" });
  }
};
module.exports = {
  getOverview,
  getTopCustomers,
  getRecentOrders,
  financialStatus,
  getDailyIncome,
  monthlySale,
};

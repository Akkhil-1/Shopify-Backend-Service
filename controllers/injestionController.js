const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");
const redis = require('../utils/redisClient')
const { clearTenantCache } = require("../utils/cacheUtil");

const syncProducts = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });

    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const response = await axios.get(
      `https://${tenant.shopDomain}/admin/api/2025-01/products.json`,
      {
        headers: {
          "X-Shopify-Access-Token": tenant.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const products = response.data.products;

    for (const product of products) {
      await prisma.product.upsert({
        where: { id_tenantId: { id: product.id.toString(), tenantId: tenant.id } },
        update: { title: product.title },
        create: {
          id: product.id.toString(),
          tenantId: tenant.id,
          title: product.title,
        },
      });
    }
    await redis.del(`overview:${tenant.id}`);
    
    return res.json({ msg: "Products synced successfully", count: products.length });
  } catch (err) {
    console.error("Error syncing products:", err.message);
    return res.status(500).json({ msg: "Failed to sync products" });
  }
};
const syncOrders = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });

    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const response = await axios.get(
      `https://${tenant.shopDomain}/admin/api/2025-01/orders.json?status=any`,
      {
        headers: {
          "X-Shopify-Access-Token": tenant.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const orders = response.data.orders;

    for (const order of orders) {
      await prisma.order.upsert({
      where: { id_tenantId: { id: order.id.toString(), tenantId: tenant.id } },
      update: {
        totalPrice: parseFloat(order.total_price),
        financialStatus: order.financial_status,
        createdAt: new Date(order.created_at),
        customerId: order.customer?.id?.toString() || null,
      },
      create: {
        id: order.id.toString(),
        tenantId: tenant.id,
        totalPrice: parseFloat(order.total_price),
        financialStatus: order.financial_status,
        createdAt: new Date(order.created_at),
        customerId: order.customer?.id?.toString() || null,
      },
    });
    }
    await clearTenantCache(tenant.id);
    console.log("Shopify Orders API response:", JSON.stringify(response.data, null, 2));
    return res.json({
      msg: "Orders synced successfully",
      count: orders.length,
    });
  } catch (err) {
    console.error("Error syncing orders:", err.message);
    return res.status(500).json({ msg: "Failed to sync orders" });
  }
};
const syncCustomers = async (req, res) => {
  try {
    const adminId = req.userId;
    const tenant = await prisma.tenant.findFirst({ where: { adminId } });

    if (!tenant) return res.status(404).json({ msg: "No tenant found" });

    const response = await axios.get(
      `https://${tenant.shopDomain}/admin/api/2025-01/customers.json`,
      {
        headers: {
          "X-Shopify-Access-Token": tenant.accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const customers = response.data.customers;

    for (const customer of customers) {
      await prisma.customer.upsert({
        where: { id_tenantId: { id: customer.id.toString(), tenantId: tenant.id } },
        update: {
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          ordersCount: customer.orders_count,
          totalSpent: customer.total_spent,
        },
        create: {
          id: customer.id.toString(),
          tenantId: tenant.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          ordersCount: customer.orders_count,
          totalSpent: customer.total_spent,
        },
      });
    }
    await clearTenantCache(tenant.id);
    return res.json({
      msg: "Customers synced successfully",
      count: customers.length,
    });
  } catch (err) {
    console.error("Error syncing customers:", err.message);
    return res.status(500).json({ msg: "Failed to sync customers" });
  }
};

module.exports =
{
    syncProducts,
    syncOrders,
    syncCustomers
}

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const axios = require("axios");
const { clearTenantCache } = require("../utils/cacheUtil");

function safeField(value) {
  return value !== undefined ? value : undefined;
}

async function refreshCustomerFromShopify(customerId, tenant) {
  const url = `https://${tenant.shopDomain}/admin/api/2023-10/customers/${customerId}.json`;
  const resp = await axios.get(url, {
    headers: {
      "X-Shopify-Access-Token": tenant.accessToken,
    },
  });
  const customer = resp.data.customer;
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


const handleOrderWebhook = async (req, res) => {
  try {
    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).end();

    const order = req.body;

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

    await clearTenantCache(tenant.id);

    if (order.customer) {
      refreshCustomerFromShopify(order.customer.id, tenant).catch((err) =>
        console.error("Error refreshing customer:", err.message)
      );
    }

    res.status(200).send("Order processed");
  } catch (err) {
    console.error("Error in handleOrderWebhook:", err.message);
    res.status(500).send("Error handling order webhook");
  }
};


const handleCustomerWebhook = async (req, res) => {
  try {
    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).end();

    const customer = req.body;

    await prisma.customer.upsert({
      where: {
        id_tenantId: { id: customer.id.toString(), tenantId: tenant.id },
      },
      update: {
        email: safeField(customer.email),
        firstName: safeField(customer.first_name),
        lastName: safeField(customer.last_name),
        ordersCount: safeField(customer.orders_count),
        totalSpent: safeField(customer.total_spent),
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

    await clearTenantCache(tenant.id);
    res.status(200).send("Customer processed");
  } catch (err) {
    console.error("Error in handleCustomerWebhook:", err.message);
    res.status(500).send("Error handling customer webhook");
  }
};

const handleProductWebhook = async (req, res) => {
  try {
    const shopDomain = req.get("X-Shopify-Shop-Domain");
    const tenant = await prisma.tenant.findUnique({ where: { shopDomain } });
    if (!tenant) return res.status(404).end();

    const product = req.body;

    await prisma.product.upsert({
      where: {
        id_tenantId: { id: product.id.toString(), tenantId: tenant.id },
      },
      update: {
        title: safeField(product.title),
        price: safeField(parseFloat(product.variants?.[0]?.price || "0")),
      },
      create: {
        id: product.id.toString(),
        tenantId: tenant.id,
        title: product.title,
        price: parseFloat(product.variants?.[0]?.price || "0"),
      },
    });

    await clearTenantCache(tenant.id);
    res.status(200).send("Product processed");
  } catch (err) {
    console.error("Error in handleProductWebhook:", err.message);
    res.status(500).send("Error handling product webhook");
  }
};

module.exports = {
  handleOrderWebhook,
  handleCustomerWebhook,
  handleProductWebhook
};

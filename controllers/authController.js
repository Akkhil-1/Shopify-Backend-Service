const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const axios = require("axios");
const redis = require('../utils/redisClient')

const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingAdmin = await prisma.admin.findUnique({ where: { email } });
    if (existingAdmin) {
      return res.status(400).json({ msg: "Admin already exists with this email" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: { name, email, password: hashedPassword },
    });

    return res.status(201).json({
      msg: "Admin registered successfully. Now connect your Shopify store.",
      adminId: admin.id,
    });
  } catch (err) {
    console.error("Error in register:", err.message);
    return res.status(500).json({ msg: "Something went wrong" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: { tenants: true },
    });

    if (!admin) {
      return res.status(400).json({ msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Incorrect credentials" });
    }

    const token = jwt.sign({ userId: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    });

    return res.json({
      msg: "Login successful",
      // token : token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
      },
      tenants: admin.tenants,
    });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({ msg: "An error occurred during login" });
  }
};

const connectStore = async (req, res) => {
  try {
    const { shopDomain, accessToken } = req.body;
    const adminId = req.userId;

    const response = await axios.get(
      `https://${shopDomain}/admin/api/2025-01/shop.json`,
      {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
      }
    );

    const shopData = response.data;
    if (!shopData.shop) {
      return res.status(400).json({ msg: "Invalid shopDomain or accessToken" });
    }

    const tenant = await prisma.tenant.create({
      data: {
        shopDomain: shopData.shop.myshopify_domain,
        name: shopData.shop.name,
        accessToken,
        adminId,
      },
    });

    await redis.del(`overview:${tenant.id}`);
    await redis.del(`topCustomers:${tenant.id}`);

    return res.status(201).json({
      msg: "Shopify store connected successfully",
      tenant,
    });
  } catch (err) {
    console.error("Error in connectStore:", err.message);
    return res.status(500).json({ msg: "Failed to connect Shopify store" });
  }
};

module.exports = {
  register,
  login,
  connectStore,
};

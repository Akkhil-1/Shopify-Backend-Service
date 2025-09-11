const express = require("express");
const router = express.Router();
const webhookController = require("../controllers/webhookController");

router.post("/orders/create", webhookController.handleOrderWebhook);
router.post("/orders/updated", webhookController.handleOrderWebhook);

router.post("/customers/create", webhookController.handleCustomerWebhook);
router.post("/customers/updated", webhookController.handleCustomerWebhook);

router.post("/products/create", webhookController.handleProductWebhook);
router.post("/products/updated", webhookController.handleProductWebhook);

router.post("/checkouts/create", webhookController.handleCheckoutCreate);
router.post("/checkouts/update", webhookController.handleCheckoutCreate);

module.exports = router;

const express = require('express')
const router = express.Router()
const ingestController = require('../controllers/injestionController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/products' , authMiddleware , ingestController.syncProducts)
router.post('/orders' , authMiddleware , ingestController.syncOrders)
router.post('/customers' , authMiddleware , ingestController.syncCustomers)

module.exports = router
const express = require('express')
const router = express.Router()
const metricsController = require('../controllers/metricsController');
const authMiddleware = require('../middlewares/authMiddleware')

router.get('/getOverview' , authMiddleware , metricsController.getOverview)
router.get('/getOrdersByDate' , authMiddleware , metricsController.getOrdersByDate)
router.get('/getTopCustomers' , authMiddleware , metricsController.getTopCustomers)

module.exports = router
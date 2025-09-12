const express = require('express')
const router = express.Router()
const metricsController = require('../controllers/metricsController');
const authMiddleware = require('../middlewares/authMiddleware')

router.get('/getOverview' , authMiddleware , metricsController.getOverview)
router.get('/getRecentOrders' , authMiddleware , metricsController.getRecentOrders)
router.get('/getTopCustomers' , authMiddleware , metricsController.getTopCustomers)
router.get('/getFinancialStaus' , authMiddleware , metricsController.financialStatus)
router.get('/getDailyIncome' , authMiddleware , metricsController.getDailyIncome)
router.get('/monthlySale' , authMiddleware , metricsController.monthlySale)

module.exports = router
const express = require('express');
const userController = require('../controllers/user/authUController');
const router = express.Router();

router.post('/reg', userController.regU);
router.post('/login', userController.logU);

module.exports = router;

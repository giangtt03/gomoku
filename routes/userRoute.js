const express = require('express');
const userController = require('../controllers/user/authUController');
const router = express.Router();

router.post('/reg', userController.regU);
router.post('/login', userController.logU);
router.get('/:userId', userController.getUserById); 
router.put('/:userId', userController.updateUser); 

module.exports = router;

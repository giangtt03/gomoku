const express = require('express');
const guestController = require('../controllers/guestController');;
const path = require('path'); 

const router = express.Router();

const createRoutes = (io) => {
    router.post('/guest', guestController(io).createGuest); // Gọi hàm để nhận io
    router.get('/guest/:guestId', guestController(io).getGuestById);
    router.put('/guest/:guestId', guestController(io).updateGuest);
    router.delete('/guest/:guestId', guestController(io).deleteGuest);

    router.get('/play', (req, res) => {
        res.sendFile(path.join(__dirname, '../views/index.html'));
    });
    
    return router; 
};

// router.post('/guest', guestController.createGuest);
// router.get('/guest/:guestId', guestController.getGuestById);
// router.put('/guest/:guestId', guestController.updateGuest);
// router.patch('/guest/:guestId/status', guestController.updateStatus);
// router.delete('/guest/:guestId', guestController.deleteGuest);

// router.get('/play', (req, res) => {
//     res.sendFile(path.join(__dirname, '../views/index.html'));
// });


module.exports = createRoutes;

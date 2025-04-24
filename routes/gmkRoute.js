const express = require('express');
const { setupGame, rooms } = require('../controllers/gmkController');
const path = require('path'); 

const router = express.Router();

router.get('/', (req, res) => {
    // console.log('Request for index.html received');
    // res.sendFile(path.join(__dirname, '../views/index.html'));
    res.sendFile(path.join(__dirname, '../views/createGuest.html'));
});

router.get('/rooms', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/listRooms.html'));
});

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        setupGame(socket, io);
    });
    return router;
};
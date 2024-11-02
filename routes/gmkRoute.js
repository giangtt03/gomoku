const express = require('express');
const { setupGame } = require('../controllers/gmkController');
const path = require('path'); 

const router = express.Router();

router.get('/', (req, res) => {
    // console.log('Request for index.html received');
    res.sendFile(path.join(__dirname, '../views/index.html'));
});

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        setupGame(socket, io);
    });

    return router;
};

const express = require('express');
const { setupGame, rooms } = require('../controllers/gmkController');
const path = require('path'); 

const router = express.Router();


module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        setupGame(socket, io);
    });

    return router;
};

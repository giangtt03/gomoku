const express = require('express');
const { setupGame, rooms } = require('../controllers/gmkController');
const path = require('path'); 

const router = express.Router();

router.get('/', (req, res) => {
    // console.log('Request for index.html received');
    // res.sendFile(path.join(__dirname, '../views/index.html'));
    res.sendFile(path.join(__dirname, '../views/createGuest.html'));

});

router.get('/r-page', (req, res) => {
    res.sendFile(path.join(__dirname, '../views/rooms.html'));
});

router.get('/rooms', (req, res) => {
    const roomList = Object.keys(rooms).map(roomName => ({
        name: roomName,
        players: rooms[roomName].players.map(player => ({
            id: player.id,
            name: player.name,
            type: player.type 
        }))
    }));

    res.json({ success: true, rooms: roomList });
});

router.post('/c-room', (req, res) => {
    const { roomName, userId, guestId } = req.body;
    if (!roomName) {
        return res.status(400).json({ success: false, message: 'Tên phòng không hợp lệ!' });
    }

    if (rooms[roomName]) {
        return res.status(400).json({ success: false, message: 'Tên phòng đã tồn tại!' });
    }

    rooms[roomName] = {
        players: [
            {
                id: userId || guestId,
                type: userId ? 'user' : 'guest',
                name: userId ? `User-${userId}` : `Guest-${guestId}`
            }
        ],
        board: Array(19).fill().map(() => Array(19).fill(0)),
        turn: null,
        readyPlayers: 0,
        resetVotes: {},
        swapTurn: false
    };

    res.json({
        success: true,
        message: 'Phòng đã được tạo thành công!',
        roomUrl: `/go/play?room=${roomName}&id=${userId || guestId}`
    });
});


module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('A user connected:', socket.id);
        setupGame(socket, io);
    });

    return router;
};

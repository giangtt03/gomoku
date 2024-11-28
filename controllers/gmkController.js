const Guest = require('../models/Guest');
let rooms = {};
let roomCounter = 0;
let socketRoomMap = {}; // Map socket IDs to room names

const findAvailableRoom = () => {
    for (const room in rooms) {
        if (rooms[room].players.length < 2) {
            return room;
        }
    }
    return null;
};

const setupGame = (socket, io) => {
    let room = findAvailableRoom();
    if (!room) {
        room = `room-${roomCounter++}`;
        rooms[room] = {
            players: [],
            board: Array(19).fill().map(() => Array(19).fill(0)),
            turn: null,
            readyPlayers: 0,
        };
    }

    socketRoomMap[socket.id] = room; // Map the socket to the room
    socket.join(room);

    socket.on('player-info', async ({ guestId }) => {
        const guest = await Guest.findOne({ guestId });
        if (guest) {
            rooms[room].players.push({
                id: socket.id,
                guestId,
                name: guest.guestName,
                avatar: guest.avatar,
                isReady: false,
            });
            io.to(room).emit('player-info', rooms[room].players);
        }
    });

    socket.on('player-ready', () => {
        const player = rooms[room].players.find(p => p.id === socket.id);
        if (player) {
            player.isReady = true;
            rooms[room].readyPlayers++;
    
            io.to(room).emit('player-ready', {
                guestId: player.guestId,
                players: rooms[room].players,
            });
    
            if (rooms[room].readyPlayers === 2) {
                rooms[room].turn = rooms[room].players[0].guestId;
                io.to(room).emit('game-start', { turn: rooms[room].turn });
            }
        }
    });

    socket.on('move', ({ row, col, guestId }) => {
        const room = socketRoomMap[socket.id]; // Retrieve room from mapping
        if (!room || !rooms[room]) {
            console.log(`Invalid move: Room not found for socket ${socket.id}`);
            return;
        }
    
        const roomData = rooms[room];
        const board = roomData.board;
    
        // Validate turn
        if (guestId !== roomData.turn) {
            console.log(`Invalid move: Not ${guestId}'s turn`);
            io.to(socket.id).emit('invalid-move', { message: "Not your turn." });
            return;
        }
    
        // Check if the cell is already taken
        if (board[row][col] !== 0) {
            console.log(`Invalid move: Cell (${row}, ${col}) is already taken`);
            io.to(socket.id).emit('invalid-move', { message: "Cell already taken." });
            return;
        }
    
        // Update the board with the move
        const player = roomData.players.find(p => p.guestId === guestId);
        const playerIndex = roomData.players.indexOf(player);
        board[row][col] = playerIndex + 1;
    
        // Emit the move to all players
        io.to(room).emit('move', { row, col, guestId });
    
        // Check for a win
        if (checkWin(board, row, col, playerIndex + 1)) {
            io.to(room).emit('win', guestId);
            console.log(`Player ${guestId} wins!`);
            return;
        }
    
        // Alternate the turn
        const nextPlayerIndex = (playerIndex + 1) % roomData.players.length;
        roomData.turn = roomData.players[nextPlayerIndex].guestId;
    
        // Notify players of the turn change
        io.to(room).emit('turn-changed', roomData.turn);
    });
    

    socket.on('chat-message', ({ guestId, message }) => {
        const player = rooms[room].players.find(p => p.guestId === guestId);
        if (player) {
            io.to(room).emit('chat-message', { player: player.name, message });
        }
    });

    socket.on('disconnect', () => {
        const room = socketRoomMap[socket.id];
        if (room && rooms[room]) {
            console.log(`Player ${socket.id} disconnected from room ${room}`);
            rooms[room].players = rooms[room].players.filter(p => p.id !== socket.id);

            if (rooms[room].players.length === 0) {
                delete rooms[room];
            } else {
                io.to(room).emit('player-disconnected', { message: 'Đối thủ đã ngắt kết nối.' });
            }

            delete socketRoomMap[socket.id];
        } else {
            console.log(`Socket ${socket.id} was not in any room.`);
        }
    });
};

module.exports = { setupGame };

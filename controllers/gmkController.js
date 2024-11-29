const Guest = require('../models/Guest');
let rooms = {};
let roomCounter = 0;
let socketRoomMap = {}; 

const findAvailableRoom = () => {
    for (const room in rooms) {
        if (rooms[room].players.length < 2) {
            return room;
        }
    }
    return null;
};

const checkWin = (board, row, col, player) => {
    const directions = [
        { dr: 0, dc: 1 },  // Horizontal
        { dr: 1, dc: 0 },  // Vertical
        { dr: 1, dc: 1 },  // Diagonal 
        { dr: 1, dc: -1 }  // Diagonal 
    ];

    for (const { dr, dc } of directions) {
        let count = 1;

        for (let i = 1; i < 5; i++) {
            const r = row + dr * i;
            const c = col + dc * i;
            if (r >= 0 && r < 19 && c >= 0 && c < 19 && board[r][c] === player) {
                count++;
            } else {
                break;
            }
        }

        for (let i = 1; i < 5; i++) {
            const r = row - dr * i;
            const c = col - dc * i;
            if (r >= 0 && r < 19 && c >= 0 && c < 19 && board[r][c] === player) {
                count++;
            } else {
                break;
            }
        }
        if (count >= 5) {
            return true;
        }
    }
    return false; 
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
            resetVotes: {},
            swapTurn: false 
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
    
        const playerSymbol = playerIndex + 1; 
        io.to(room).emit('move', { row, col, guestId, symbol: playerSymbol });
    
        // Check for a win
        if (checkWin(board, row, col, playerIndex + 1)) {
            io.to(room).emit('win', guestId);
            console.log(`Player ${guestId} wins!`);
            return;
        }
    
        // Alternate the turn
        const nextPlayerIndex = (playerIndex + 1) % roomData.players.length;
        roomData.turn = roomData.players[nextPlayerIndex].guestId;
        console.log(`Player ${guestId} moved. Next turn: ${roomData.turn}`);
    
        io.to(room).emit('turn-changed', roomData.turn);
    });

    socket.on('reset-request', () => {
        const room = socketRoomMap[socket.id];
        if (!room || !rooms[room]) return;
    
        const playerId = socket.id;
        if (!rooms[room].resetVotes) {
            rooms[room].resetVotes = {};
        }
    
        if (!rooms[room].resetVotes[playerId]) {
            rooms[room].resetVotes[playerId] = true;
        }
    
        const playerIds = rooms[room].players.map(player => player.id);
        if (playerIds.every(id => rooms[room].resetVotes[id])) {
            handleReset(room, io);
            rooms[room].resetVotes = {};
        } else {
            const otherPlayer = playerIds.find(id => id !== playerId);
            if (otherPlayer) {
                io.to(otherPlayer).emit('reset-confirmation', { from: playerId });
            }
        }
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

const handleReset = (room, io) => {
    if (!rooms[room]) return;

    console.log(`Resetting the game for room: ${room}`);
    rooms[room].board = Array(19).fill().map(() => Array(19).fill(0));

    // sưap turn
    rooms[room].swapTurn = !rooms[room].swapTurn; 
    const firstPlayerIndex = rooms[room].swapTurn ? 1 : 0;
    rooms[room].turn = rooms[room].players[firstPlayerIndex].guestId;

    rooms[room].resetVotes = {}; 
    io.to(room).emit('reset', {
        turn: rooms[room].turn,
        swapTurn: rooms[room].swapTurn,
    }); 
};



module.exports = { setupGame };

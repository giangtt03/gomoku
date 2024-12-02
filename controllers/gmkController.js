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
        if (!rooms[room]) {
            console.error(`Phòng ${room} không tồn tại!`);
            return;
        }
        if (guest) {
            rooms[room].players.push({
                id: socket.id,
                guestId,
                name: guest.guestName,
                avatar: guest.avatar,
                isReady: false,
            });
    
            io.to(room).emit('player-info', rooms[room].players);
    
            if (rooms[room].players.length > 1) {
                io.to(room).emit('update-kick-button', { showKick: true });
            }
        }
    });
    
    socket.on('kick-player', ({ guestId }) => {
        const room = socketRoomMap[socket.id];
        if (!room || !rooms[room]) return;

        const roomData = rooms[room];
        const kicker = roomData.players.find(p => p.id === socket.id);
        const target = roomData.players.find(p => p.guestId === guestId);

        if (kicker && roomData.players[0].id === socket.id && target) {
            console.log(`Kicker: ${kicker.name} đang đuổi target: ${target.name}`);
            roomData.players = roomData.players.filter(p => p.guestId !== guestId);

            io.to(target.id).emit('kicked', { message: 'Bạn đã bị đuổi khỏi phòng😭!' });
            io.sockets.sockets.get(target.id)?.leave(room);

            io.to(room).emit('player-kicked', { guestId });
        }
    });

    const updatePlayerReadyStatus = (room, guestId, isReady, io) => {
        if (!rooms[room]) return;

        const player = rooms[room].players.find(p => p.guestId === guestId);
        if (player) {
            player.isReady = isReady;
            io.to(room).emit('update-ready-status', { guestId, isReady });
            // console.log(`Player ${guestId} is now ${isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}`);
        }
    };

    const resetPlayerReadyStatus = (room, io) => {
        if (!rooms[room]) return;

        rooms[room].players.forEach(player => (player.isReady = false));
        io.to(room).emit('reset-ready-status');
        // console.log(`Reset ready status for room: ${room}`);
    };

    socket.on('player-ready', ({ guestId }) => {
        const room = socketRoomMap[socket.id];
        if (room) {
            updatePlayerReadyStatus(room, guestId, true, io);
    
            if (rooms[room].players.every(player => player.isReady)) {
                rooms[room].board = Array(19).fill().map(() => Array(19).fill(0));
    
                rooms[room].turn = rooms[room].players[0].guestId;
                io.to(room).emit('game-start', { turn: rooms[room].turn });
            }
        }
    });
    
    socket.on('reset-request', (data) => {
        if (!data || typeof data.choice !== 'string') {
            console.error(`Invalid reset-request data from socket ${socket.id}`);
            return;
        }

        const { choice } = data;
        const room = socketRoomMap[socket.id];
        if (!room || !rooms[room]) return;

        rooms[room].resetVotes[socket.id] = choice;

        const allPlayers = rooms[room].players.map(player => player.id);
        const allAgreed = allPlayers.every(playerId => rooms[room].resetVotes[playerId] === 'yes');

        if (choice === 'no') {
            io.to(room).emit('reset-declined', { playerId: socket.id });
        }

        if (allAgreed) {
            handleReset(room, io);
            rooms[room].resetVotes = {};
        } else {
            io.to(room).emit('reset-waiting', { playerId: socket.id });
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

        if (guestId !== roomData.turn) {
            // console.log(`Invalid move: Not ${guestId}'s turn`);
            io.to(socket.id).emit('invalid-move', { message: "Not your turn." });
            return;
        }

        if (board[row][col] !== 0) {
            // console.log(`Invalid move: Cell (${row}, ${col}) is already taken`);
            io.to(socket.id).emit('invalid-move', { message: "Cell already taken." });
            return;
        }

        // Update the board with the move
        const player = roomData.players.find(p => p.guestId === guestId);
        const playerIndex = roomData.players.indexOf(player);
        board[row][col] = playerIndex + 1;

        const playerSymbol = playerIndex + 1;
        io.to(room).emit('move', { row, col, guestId, symbol: playerSymbol });

        if (checkWin(board, row, col, playerIndex + 1)) {
            io.to(room).emit('win', guestId);
            // console.log(`Player ${guestId} wins!`);
            return;
        }

        // Alternate the turn
        const nextPlayerIndex = (playerIndex + 1) % roomData.players.length;
        roomData.turn = roomData.players[nextPlayerIndex].guestId;
        // console.log(`Player ${guestId} moved. Next turn: ${roomData.turn}`);

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
            const roomData = rooms[room];
            const disconnectedPlayer = roomData.players.find(p => p.id === socket.id);
    
            roomData.players = roomData.players.filter(p => p.id !== socket.id);
    
            if (roomData.players.length === 0) {
                delete rooms[room];
            } else {
                resetPlayerReadyStatus(room, io);
    
                io.to(room).emit('update-kick-button', { showKick: false });
                io.to(room).emit('player-disconnected', {
                    message: `${disconnectedPlayer?.name || 'Người chơi'} đã thoát.`,
                    players: roomData.players,
                });
            }
            delete socketRoomMap[socket.id];
        }
    });
    
};

const handleReset = (room, io) => {
    if (!rooms[room]) return;

    // console.log(`Resetting the game for room: ${room}`);
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

module.exports = { setupGame, rooms };

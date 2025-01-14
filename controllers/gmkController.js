const Guest = require('../models/Guest');
const User = require('../models/User')
let rooms = {};
let roomCounter = 0;
let socketRoomMap = {};

const findAvailableRoom = () => {
    for (const room in rooms) {
        console.log(`Checking room ${room}: ${rooms[room].players.length} players`);
        if (rooms[room].players.length < 2) {
            console.log(`Room ${room} found with available space for players.`);
            return room;
        }
    }
    console.log("No available room found. Creating a new room.");
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
    socket.on('join-room', () => {
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
            console.log(`Created a new room: ${room}`);
        } else {
            console.log(`Joining existing room: ${room}`);
        }

        socketRoomMap[socket.id] = room;
        socket.join(room);
        console.log(`Player ${socket.id} joined room ${room}`);

        socket.on('player-info', async ({ guestId, userId }) => {
            const playerId = guestId || userId;
            const playerType = guestId ? 'guest' : 'user';

            console.log(`Received player info: ${playerType} with ID ${playerId}`);

            let playerInfo;
            if (playerType === 'guest') {
                playerInfo = await Guest.findOne({ guestId });
            } else {
                playerInfo = await User.findById(userId);
            }

            if (!playerInfo || !rooms[room]) {
                console.error(`not found rooms or plr ${room} `);
                return;
            }

            const existingPlayer = rooms[room].players.find(p => p.id === socket.id);
            if (existingPlayer) return;

            rooms[room].players.push({
                id: socket.id,
                playerId,
                type: playerType,
                name: playerInfo.guestName || playerInfo.username,
                avatar: playerInfo.avatar,
                isReady: false,
            });

            io.to(room).emit('player-info', rooms[room].players);
            console.log(`Broadcasting player-info to room: ${room}`, rooms[room].players);
            console.log(`Player ${socket.id} joined room ${room}`);
        });
    });

    socket.on('kick-player', ({ playerId }) => {
        const room = socketRoomMap[socket.id];
        if (!room || !rooms[room]) {
            console.error(`Room ${room} not found!`);
            return;
        }

        const roomData = rooms[room];
        const kicker = roomData.players.find(p => p.id === socket.id);
        const target = roomData.players.find(p => p.playerId === playerId);

        if (!kicker) {
            console.error(`Kicker not found in room ${room}`);
            return;
        }

        if (!target) {
            console.error(`Target player ${playerId} not found in room ${room}`);
            return;
        }

        if (roomData.players[0].id !== socket.id) {
            console.error(`Player ${socket.id} is not the room owner and cannot kick.`);
            return;
        }

        roomData.players = roomData.players.filter(p => p.playerId !== playerId);

        io.to(target.id).emit('kicked', { message: 'Bạn đã bị đuổi khỏi phòng😭!' });
        io.sockets.sockets.get(target.id)?.leave(room);

        console.log(`Player ${target.id} kicked by ${socket.id} from room ${room}`);

        io.to(room).emit('player-kicked', { playerId });
    });


    const updatePlayerReadyStatus = (room, playerId, isReady, io) => {
        if (!rooms[room]) return;

        const player = rooms[room].players.find(p => p.playerId === playerId);
        if (player) {
            player.isReady = isReady;
            console.log(`Player ${player.name} isReady set to: ${player.isReady}`);
            io.to(room).emit('update-ready-status', { playerId, isReady });
            // console.log(`Player ${guestId} is now ${isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}`);
            console.log(`Player ${player.name} is now ${isReady ? 'ready' : 'not ready'}`);

            // Kiểm tra nếu tất cả người chơi đều sẵn sàng
            if (rooms[room].players.every(p => p.isReady)) {
                rooms[room].turn = rooms[room].players[0].playerId;
                rooms[room].board = Array(19).fill().map(() => Array(19).fill(0));
                io.to(room).emit('game-start', {
                    turn: rooms[room].turn,
                    players: rooms[room].players
                });
                console.log(`Game started in room ${room}. Player ${rooms[room].players[0].name} starts the game.`);
            }
        }
    };

    const resetPlayerReadyStatus = (room, io) => {
        if (!rooms[room]) return;

        rooms[room].players.forEach(player => (player.isReady = false));
        io.to(room).emit('reset-ready-status');
        console.log(`Reset ready status for room: ${room}`);
    };

    socket.on('player-ready', ({ playerId }) => {
        const room = socketRoomMap[socket.id];
        console.log(`Received player-ready for room: ${room}`);
        // if (!room || !rooms[room]) return;
        if (!room || !rooms[room]) {
            console.error('Room not found or invalid:', room);
            return;
        }

        const player = rooms[room].players.find(p => p.playerId === playerId);
        if (player) {
            player.isReady = true;
            console.log(`Player ${player.name} is ready in room: ${room}`);
            io.to(room).emit('update-ready-status', { playerId, isReady: true });

            const allReady = rooms[room].players.every(p => p.isReady);
            console.log(`All players ready: ${allReady}`);

            if (allReady) {
                rooms[room].turn = rooms[room].players[0].playerId;
                rooms[room].board = Array(19).fill().map(() => Array(19).fill(0));
                io.to(room).emit('game-start', {
                    turn: rooms[room].turn,
                    players: rooms[room].players
                });

                console.log(`Game started in room ${room}. Player ${rooms[room].players[0].name} starts the game.`);
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
            // hiẻn thị thông báo khi reject--dialog
            const player = rooms[room].players.find(p => p.id === socket.id);
            if (player) {
                io.to(room).emit('player-not-ready', { playerId: socket.id, playerName: player.name });
            }
        }

        if (allAgreed) {
            handleReset(room, io);
            rooms[room].resetVotes = {};
        } else {
            io.to(room).emit('reset-waiting', { playerId: socket.id });
        }
    });

    socket.on('move', ({ row, col, playerId }) => {
        const room = socketRoomMap[socket.id];
        if (!room || !rooms[room]) return;

        const roomData = rooms[room];
        const board = roomData.board;
        const player = roomData.players.find(p => p.playerId === playerId);

        if (!player || playerId !== roomData.turn) {
            io.to(socket.id).emit('invalid-move', { message: "Not your turn." });
            return;
        }

        const playerIndex = roomData.players.indexOf(player);
        board[row][col] = playerIndex + 1;

        io.to(room).emit('move', { row, col, playerId, symbol: playerIndex + 1 });

        if (checkWin(board, row, col, playerIndex + 1)) {
            io.to(room).emit('win', playerId);
            return;
        }

        roomData.turn = roomData.players[(playerIndex + 1) % roomData.players.length].playerId;
        io.to(room).emit('turn-changed', roomData.turn);
    });


    socket.on('chat-message', ({ playerId, message }) => {
        const room = socketRoomMap[socket.id];

        if (!room || !rooms[room]) {
            console.error('Room not found or invalid');
            return;
        }

        const player = rooms[room].players.find(p => p.playerId === playerId);
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
                console.log(`Room ${room} is empty, deleting the room.`);
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
            console.log(`Player ${socket.id} disconnected from room ${room}`);

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
    rooms[room].turn = rooms[room].players[firstPlayerIndex].playerId;

    rooms[room].resetVotes = {};
    io.to(room).emit('reset', {
        turn: rooms[room].turn,
        swapTurn: rooms[room].swapTurn,
    });
};

module.exports = { setupGame, rooms };

let rooms = {};  // Quản lý các phòng
let roomCounter = 0;  // Đếm số phòng

const findAvailableRoom = () => {
    for (const room in rooms) {
        if (rooms[room].players.length < 2) {
            return room;
        }
    }
    return null;
};

const checkWin = (board, row, col, player) => {
    return (
        countConsecutive(board, row, col, player, 1, 0) >= 5 || // Kiểm tra ngang
        countConsecutive(board, row, col, player, 0, 1) >= 5 || // Kiểm tra dọc
        countConsecutive(board, row, col, player, 1, 1) >= 5 || // Kiểm tra chéo /
        countConsecutive(board, row, col, player, 1, -1) >= 5   // Kiểm tra chéo \
    );
};

const countConsecutive = (board, row, col, player, deltaRow, deltaCol) => {
    let count = 1;
    for (let i = 1; i < 5; i++) {
        const newRow = row + i * deltaRow;
        const newCol = col + i * deltaCol;
        if (board[newRow]?.[newCol] === player) {
            count++;
        } else break;
    }
    for (let i = 1; i < 5; i++) {
        const newRow = row - i * deltaRow;
        const newCol = col - i * deltaCol;
        if (board[newRow]?.[newCol] === player) {
            count++;
        } else break;
    }
    return count;
};

const setupGame = (socket, io) => {
    let room = findAvailableRoom();
    let playerNumber;

    if (!room) {
        room = `room-${roomCounter++}`;
        rooms[room] = {
            players: [],
            board: Array(15).fill().map(() => Array(15).fill(0)),
            turn: 1,
            resetVotes: {}  // Thêm biến để lưu trữ vote cho reset
        };
    }

    socket.join(room);
    rooms[room].players.push(socket);
    playerNumber = rooms[room].players.length;

    socket.emit('player-assigned', playerNumber);

    if (rooms[room].players.length === 2) {
        io.to(room).emit('game-start');
    }

    socket.on('move', (data) => handleMove(data, socket, room, io));
    socket.on('reset', () => handleReset(room, io));
    socket.on('disconnect', () => handleDisconnect(socket, room));

    socket.on('reset-request', () => {
        const room = Object.keys(rooms).find(r => rooms[r].players.includes(socket));
        
        if (!room) return;
    
        const otherPlayerSocket = rooms[room].players.find(s => s !== socket);
    
        if (otherPlayerSocket) {
            console.log(`Sending reset confirmation to ${otherPlayerSocket.id}`);
            otherPlayerSocket.emit('reset-confirmation', socket.id);
        }
    });
    
    // socket.on('reset-accepted', () => {
    //     const room = Object.keys(rooms).find(r => rooms[r].players.includes(socket));
    
    //     if (!room) return; // Đảm bảo room hợp lệ
    
    //     // Chỉ ghi lại vote nếu nó chưa tồn tại cho người chơi này
    //     if (!rooms[room].resetVotes[socket.id]) {
    //         rooms[room].resetVotes[socket.id] = true;
    //         console.log(`Player ${socket.id} agreed to reset.`);
    //     }
    //     console.log('Current reset votes:', rooms[room].resetVotes);
    
    //     // Lấy ID của hai người chơi
    //     const [player1, player2] = rooms[room].players.map(playerSocket => playerSocket.id);
    
    //     // Kiểm tra xem cả hai người chơi đã đồng ý hay chưa
    //     if (rooms[room].resetVotes[player1] && rooms[room].resetVotes[player2]) {
    //         console.log('Both players agreed to reset.');
    //         handleReset(room, io);
    //         // Reset lại votes cho lần chơi lại tiếp theo
    //         rooms[room].resetVotes = {};
    //     } else {
    //         // Nếu chỉ có một người chơi đồng ý, yêu cầu xác nhận lại cho người còn lại
    //         const otherPlayerSocket = rooms[room].players.find(s => s.id !== socket.id);
    //         if (otherPlayerSocket && !rooms[room].resetVotes[otherPlayerSocket.id]) {
    //             otherPlayerSocket.emit('reset-confirmation', socket.id);
    //         }
    //     }
    // });

    socket.on('reset-accepted', () => {
        const room = Object.keys(rooms).find(r => rooms[r].players.includes(socket));
    
        if (!room) return; // Đảm bảo room hợp lệ
    
        // Chỉ ghi lại vote nếu nó chưa tồn tại cho người chơi này
        if (!rooms[room].resetVotes[socket.id]) {
            rooms[room].resetVotes[socket.id] = true;
            console.log(`Player ${socket.id} agreed to reset.`);
        }
        console.log('Current reset votes:', rooms[room].resetVotes);
    
        // Lấy ID của hai người chơi
        const [player1, player2] = rooms[room].players.map(playerSocket => playerSocket.id);
    
        // Kiểm tra xem cả hai người chơi đã đồng ý hay chưa
        if (rooms[room].resetVotes[player1] && rooms[room].resetVotes[player2]) {
            console.log('Both players agreed to reset.');
            handleReset(room, io);
            // Reset lại votes cho lần chơi lại tiếp theo
            rooms[room].resetVotes = {};
        } else {
            // Nếu chỉ có một người chơi đồng ý, yêu cầu xác nhận lại cho người còn lại
            const otherPlayerSocket = rooms[room].players.find(s => s.id !== socket.id);
            if (otherPlayerSocket) {
                otherPlayerSocket.emit('reset-confirmation', socket.id);
            }
        }
    });
    

};

const handleReset = (room, io) => {
    console.log('Resetting the board for room:', room);
    rooms[room].board = Array(15).fill().map(() => Array(15).fill(0));
    rooms[room].turn = 1;
    io.to(room).emit('reset');
    rooms[room].resetVotes = {}; // Reset vote cho lần chơi lại tiếp theo
};



const handleMove = (data, socket, room, io) => {
    const { row, col, player } = data;
    const board = rooms[room].board;
    const turn = rooms[room].turn;

    // console.log(`Received move from player ${player}: (${row}, ${col})`);
    // console.log(`Current turn: ${turn}`);

    if (player !== turn) {
        console.log(`It's not player ${player}'s turn. Ignoring move.`);
        return;
    }

    if (board[row][col] !== 0) {
        console.log(`Cell (${row}, ${col}) is already taken. Ignoring move.`);
        return;
    }

    board[row][col] = player;
    io.to(room).emit('move', { row, col, player });

    if (checkWin(board, row, col, player)) {
        io.to(room).emit('win', player);
        console.log(`Player ${player} wins!`);
        return;
    }

    rooms[room].turn = turn === 1 ? 2 : 1;
    console.log(`Turn changed to player ${rooms[room].turn}`);
    io.to(room).emit('turn-changed', rooms[room].turn);
};

const handleDisconnect = (socket, room) => {
    console.log('A user disconnected:', socket.id);
    rooms[room].players = rooms[room].players.filter((s) => s !== socket);
    if (rooms[room].players.length === 0) {
        delete rooms[room];
    }
};

module.exports = { setupGame, findAvailableRoom, checkWin };
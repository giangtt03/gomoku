const Guest = require("../models/Guest")
const User = require("../models/User")
const rooms = {}
const roomCounter = 0
const socketRoomMap = {}

const findAvailableRoom = () => {
  for (const room in rooms) {
    if (
      rooms[room].players.length < 2 &&
      !rooms[room].isPrivate &&
      !rooms[room].isProcessing // Tránh phòng đang xử lý
    ) {
      return room
    }
  }
  return null
}

const checkWin = (board, row, col, player) => {
  const directions = [
    { dr: 0, dc: 1 }, // Horizontal
    { dr: 1, dc: 0 }, // Vertical
    { dr: 1, dc: 1 }, // Diagonal
    { dr: 1, dc: -1 }, // Diagonal
  ]

  for (const { dr, dc } of directions) {
    let count = 1

    for (let i = 1; i < 5; i++) {
      const r = row + dr * i
      const c = col + dc * i
      if (r >= 0 && r < 19 && c >= 0 && c < 19 && board[r][c] === player) {
        count++
      } else {
        break
      }
    }

    for (let i = 1; i < 5; i++) {
      const r = row - dr * i
      const c = col - dc * i
      if (r >= 0 && r < 19 && c >= 0 && c < 19 && board[r][c] === player) {
        count++
      } else {
        break
      }
    }
    if (count >= 5) {
      return true
    }
  }
  return false
}

const setupGame = (socket, io) => {
  // list roomroom
  socket.on("list-rooms", () => {
    // Clean up empty or invalid rooms first
    Object.keys(rooms).forEach((roomId) => {
      const room = rooms[roomId]

      // Check if room is valid
      if (!room || !Array.isArray(room.players)) {
        console.log(`Deleting invalid room: ${roomId}`)
        delete rooms[roomId]
        return
      }

      // Nếu không có người chơi và phòng không được xử lý
      if (room.players.length === 0 && !room.isProcessing) {
        // Kiểm tra thêm khoảng thời gian trước khi xóa
        if (!room.lastActivity || Date.now() - room.lastActivity > 30000) {
          console.log(`Deleting empty room due to inactivity: ${roomId}`)
          delete rooms[roomId]
        }
      }
    })

    // Create room list with proper data
    const roomList = Object.keys(rooms).map((roomId) => {
      const room = rooms[roomId]

      // Log room data for debugging
      console.log(`Room ${roomId} data:`, {
        hasRoom: !!room,
        hasPlayers: room ? !!room.players : false,
        playersIsArray: room && room.players ? Array.isArray(room.players) : false,
        playersLength: room && room.players && Array.isArray(room.players) ? room.players.length : "N/A",
      })

      return {
        roomId,
        players: room && room.players && Array.isArray(room.players) ? room.players.length : 0,
        maxPlayers: 2,
      }
    })

    console.log(`Sending room list to socket ${socket.id}:`, roomList)
    socket.emit("room-list", roomList)
  })

  // COMPLETELY NEW create-room handler
  socket.on("create-room", async ({ guestId, userId }) => {
    console.log("CREATE-ROOM EVENT RECEIVED - CREATING NEW ROOM")

    // Generate a guaranteed unique room ID
    const uniqueRoomId = `room-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    console.log(`Creating brand new room with ID: ${uniqueRoomId}`)

    // Create the new room with properly initialized properties
    rooms[uniqueRoomId] = {
      players: [], // Initialize as empty array
      board: Array(19)
        .fill()
        .map(() => Array(19).fill(0)),
      turn: null,
      readyPlayers: 0,
      resetVotes: {},
      swapTurn: false,
      isPrivate: false,
      isProcessing: true,
      lastActivity: Date.now(),
    }

    // Associate socket with this room
    socketRoomMap[socket.id] = uniqueRoomId
    socket.join(uniqueRoomId)

    console.log(`Player ${socket.id} joined new room ${uniqueRoomId}`)

    try {
      const playerId = guestId || userId
      const playerType = guestId ? "guest" : "user"

      let playerInfo = null
      if (playerType === "guest") {
        playerInfo = await Guest.findOne({ guestId })
      } else {
        playerInfo = await User.findById(userId)
      }

      if (!playerInfo) {
        throw new Error("Player information not found")
      }

      // Add player to room
      rooms[uniqueRoomId].players.push({
        id: socket.id,
        playerId,
        type: playerType,
        name: playerInfo.guestName || playerInfo.username,
        avatar: playerInfo.avatar,
        isReady: false,
      })

      rooms[uniqueRoomId].lastActivity = Date.now()

      // Emit player info to room
      io.to(uniqueRoomId).emit("player-info", rooms[uniqueRoomId].players)

      console.log(`Added player to new room ${uniqueRoomId}:`, rooms[uniqueRoomId].players)

      // Emit room created event
      socket.emit("room-created", { roomId: uniqueRoomId })
      console.log(`Emitted room-created event for room ${uniqueRoomId}`)
    } catch (error) {
      console.error("Error creating room:", error.message)
    } finally {
      if (rooms[uniqueRoomId]) {
        rooms[uniqueRoomId].isProcessing = false
      }
    }
  })

  socket.on("join-room", ({ roomId }) => {
    console.log("JOIN-ROOM EVENT RECEIVED")

    let room

    if (roomId) {
      room = roomId
      console.log(`Joining specific room: ${room}`)
    } else {
      room = findAvailableRoom()

      if (!room) {
        const newRoomId = `room-${Date.now()}-${Math.floor(Math.random() * 10000)}`
        room = newRoomId

        rooms[room] = {
          players: [],
          board: Array(19)
            .fill()
            .map(() => Array(19).fill(0)),
          turn: null,
          readyPlayers: 0,
          resetVotes: {},
          swapTurn: false,
          isPrivate: false,
          isProcessing: true,
          lastActivity: Date.now(),
        }

        console.log(`No available room found, created new room: ${room}`)
      } else {
        console.log(`Found available room to join: ${room}`)
      }
    }

    socketRoomMap[socket.id] = room
    socket.join(room)
    console.log(`Player ${socket.id} joined room ${room}`)

    try {
      handlePlayerInfo(socket, room)
    } finally {
      if (rooms[room]) {
        rooms[room].isProcessing = false
      }
    }
  })

  function handlePlayerInfo(socket, room) {
    socket.on("player-info", async ({ guestId, userId }) => {
      const playerId = guestId || userId
      const playerType = guestId ? "guest" : "user"

      console.log(`Received player info: ${playerType} with ID ${playerId}`)

      let playerInfo
      if (playerType === "guest") {
        playerInfo = await Guest.findOne({ guestId })
      } else {
        playerInfo = await User.findById(userId)
      }

      if (!playerInfo || !rooms[room]) {
        console.error(`Player information or room not found for ${room}`)
        return
      }

      const existingPlayer = rooms[room].players.find((p) => p.id === socket.id)
      if (existingPlayer) return

      rooms[room].players.push({
        id: socket.id,
        playerId,
        type: playerType,
        name: playerInfo.guestName || playerInfo.username,
        avatar: playerInfo.avatar,
        isReady: false,
      })

      io.to(room).emit("player-info", rooms[room].players)
      console.log(`Broadcasting player-info to room: ${room}`, rooms[room].players)
    })
  }

  socket.on("kick-player", ({ playerId }) => {
    const room = socketRoomMap[socket.id]
    if (!room || !rooms[room]) {
      console.error(`Room ${room} not found!`)
      return
    }

    const roomData = rooms[room]
    const kicker = roomData.players.find((p) => p.id === socket.id)
    const target = roomData.players.find((p) => p.playerId === playerId)

    if (!kicker || !target) {
      console.error(`Kicker or target not found in room ${room}`)
      return
    }

    if (roomData.players[0].id !== socket.id) {
      console.error(`Player ${socket.id} is not the room owner and cannot kick.`)
      return
    }

    roomData.players = roomData.players.filter((p) => p.playerId !== playerId)
    delete socketRoomMap[target.id]

    io.to(target.id).emit("kicked", { message: "Bạn đã bị đuổi khỏi phòng😭!" })
    io.sockets.sockets.get(target.id)?.leave(room)

    console.log(`Player ${target.id} kicked by ${socket.id} from room ${room}`)

    io.to(room).emit("player-kicked", { playerId })
  })

  const updatePlayerReadyStatus = (room, playerId, isReady, io) => {
    if (!rooms[room]) return

    const player = rooms[room].players.find((p) => p.playerId === playerId)
    if (player) {
      player.isReady = isReady
      console.log(`Player ${player.name} isReady set to: ${player.isReady}`)
      io.to(room).emit("update-ready-status", { playerId, isReady })
      // console.log(`Player ${guestId} is now ${isReady ? 'Sẵn sàng' : 'Chưa sẵn sàng'}`);
      console.log(`Player ${player.name} is now ${isReady ? "ready" : "not ready"}`)

      // Kiểm tra nếu tất cả người chơi đều sẵn sàng
      if (rooms[room].players.every((p) => p.isReady)) {
        rooms[room].turn = rooms[room].players[0].playerId
        rooms[room].board = Array(19)
          .fill()
          .map(() => Array(19).fill(0))
        io.to(room).emit("game-start", {
          turn: rooms[room].turn,
          players: rooms[room].players,
        })
        console.log(`Game started in room ${room}. Player ${rooms[room].players[0].name} starts the game.`)
      }
    }
  }

  const resetPlayerReadyStatus = (room, io) => {
    if (!rooms[room]) return

    rooms[room].players.forEach((player) => (player.isReady = false))
    io.to(room).emit("reset-ready-status")
    console.log(`Reset ready status for room: ${room}`)
  }

  socket.on("player-ready", ({ playerId }) => {
    const room = socketRoomMap[socket.id]
    console.log(`Received player-ready for room: ${room}`)
    // if (!room || !rooms[room]) return;
    if (!room || !rooms[room]) {
      console.error("Room not found or invalid:", room)
      return
    }

    const player = rooms[room].players.find((p) => p.playerId === playerId)
    if (player) {
      player.isReady = true
      console.log(`Player ${player.name} is ready in room: ${room}`)
      io.to(room).emit("update-ready-status", { playerId, isReady: true })

      const allReady = rooms[room].players.every((p) => p.isReady)
      console.log(`All players ready: ${allReady}`)

      if (allReady) {
        rooms[room].turn = rooms[room].players[0].playerId
        rooms[room].board = Array(19)
          .fill()
          .map(() => Array(19).fill(0))
        io.to(room).emit("game-start", {
          turn: rooms[room].turn,
          players: rooms[room].players,
        })

        console.log(`Game started in room ${room}. Player ${rooms[room].players[0].name} starts the game.`)
      }
    }
  })

  socket.on("reset-request", (data) => {
    if (!data || typeof data.choice !== "string") {
      console.error(`Invalid reset-request data from socket ${socket.id}`)
      return
    }

    const { choice } = data
    const room = socketRoomMap[socket.id]
    if (!room || !rooms[room]) return

    rooms[room].resetVotes[socket.id] = choice

    const allPlayers = rooms[room].players.map((player) => player.id)
    const allAgreed = allPlayers.every((playerId) => rooms[room].resetVotes[playerId] === "yes")

    if (choice === "no") {
      io.to(room).emit("reset-declined", { playerId: socket.id })
      // hiẻn thị thông báo khi reject--dialog
      const player = rooms[room].players.find((p) => p.id === socket.id)
      if (player) {
        io.to(room).emit("player-not-ready", { playerId: socket.id, playerName: player.name })
      }
    }

    if (allAgreed) {
      handleReset(room, io)
      rooms[room].resetVotes = {}
    } else {
      io.to(room).emit("reset-waiting", { playerId: socket.id })
    }
  })

  socket.on("move", ({ row, col, playerId }) => {
    const room = socketRoomMap[socket.id]
    if (!room || !rooms[room]) return

    const roomData = rooms[room]
    const board = roomData.board
    const player = roomData.players.find((p) => p.playerId === playerId)

    if (!player || playerId !== roomData.turn) {
      io.to(socket.id).emit("invalid-move", { message: "Not your turn." })
      return
    }

    const playerIndex = roomData.players.indexOf(player)
    board[row][col] = playerIndex + 1

    io.to(room).emit("move", { row, col, playerId, symbol: playerIndex + 1 })

    if (checkWin(board, row, col, playerIndex + 1)) {
      io.to(room).emit("win", playerId)
      return
    }

    roomData.turn = roomData.players[(playerIndex + 1) % roomData.players.length].playerId
    io.to(room).emit("turn-changed", roomData.turn)
  })

  socket.on("chat-message", ({ playerId, message }) => {
    const room = socketRoomMap[socket.id]

    if (!room || !rooms[room]) {
      console.error("Room not found or invalid")
      return
    }

    const player = rooms[room].players.find((p) => p.playerId === playerId)
    if (player) {
      io.to(room).emit("chat-message", { player: player.name, message })
    }
  })

  // re-connect socket
  io.on("connection", (socket) => {
    const oldSocketId = socket.handshake.auth.socketId

    if (oldSocketId && io.sockets.sockets.get(oldSocketId)) {
      console.log(`Reconnecting old socketId: ${oldSocketId} to new socket: ${socket.id}`)

      const oldSocket = io.sockets.sockets.get(oldSocketId)

      // Chuyển thông tin từ socket cũ sang socket mới
      if (oldSocket.room) {
        socket.join(oldSocket.room)
        socket.room = oldSocket.room
      }

      // Thay thế socket cũ bằng socket mới
      io.sockets.sockets.delete(oldSocketId)
      oldSocket.disconnect()
    }

    console.log(`New connection: ${socket.id}`)

    socket.on("disconnect", (reason) => {
      console.log(`Socket ${socket.id} disconnected due to ${reason}`)
    })
  })

  socket.on("disconnect", () => {
    const room = socketRoomMap[socket.id]
    if (room && rooms[room]) {
      const roomData = rooms[room]
      const disconnectedPlayer = roomData.players.find((p) => p.id === socket.id)

      roomData.players = roomData.players.filter((p) => p.id !== socket.id)

      if (roomData.players.length === 0) {
        console.log(`Room ${room} is empty, deleting the room.`)
        delete rooms[room]

        // Send updated room list to all clients
        const updatedRoomList = Object.keys(rooms).map((roomId) => ({
          roomId,
          players: rooms[roomId] && rooms[roomId].players ? rooms[roomId].players.length : 0,
          maxPlayers: 2,
        }))

        io.emit("room-list", updatedRoomList)
      } else {
        resetPlayerReadyStatus(room, io)

        io.to(room).emit("update-kick-button", { showKick: false })
        io.to(room).emit("player-disconnected", {
          message: `${disconnectedPlayer?.name || "Người chơi"} đã thoát.`,
          players: roomData.players,
        })
      }
      delete socketRoomMap[socket.id]
      console.log(`Player ${socket.id} disconnected from room ${room}`)
    }
  })
}

const handleReset = (room, io) => {
  if (!rooms[room]) return

  // console.log(`Resetting the game for room: ${room}`);
  rooms[room].board = Array(19)
    .fill()
    .map(() => Array(19).fill(0))

  // sưap turn
  rooms[room].swapTurn = !rooms[room].swapTurn
  const firstPlayerIndex = rooms[room].swapTurn ? 1 : 0
  rooms[room].turn = rooms[room].players[firstPlayerIndex].playerId

  rooms[room].resetVotes = {}
  io.to(room).emit("reset", {
    turn: rooms[room].turn,
    swapTurn: rooms[room].swapTurn,
  })
}

module.exports = { setupGame, rooms }

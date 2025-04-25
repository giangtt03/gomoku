# Gomoku Game

A real-time multiplayer Gomoku (Five in a Row) game implemented with Node.js and Socket.IO.

![Gomoku Game](https://sjc.microlink.io/LyoskRoxj-7ksBG_IiqRurKHbSX36ZknmEtvmwmrTZGPotn3T19Q1VfBBw2b6iEifb3E7-kQF9QgOrKRGvdCdw.jpeg)

## Demo

Watch the game demo: [YouTube Demo](https://youtu.be/fTkPsyCmxlo)

## Features

- Real-time multiplayer gameplay
- Room-based matchmaking system
- Chat functionality
- Player ready system
- Win detection algorithm
- Room management (create, join, list)
- Player kick functionality

## gmkController.js Functionality

The `gmkController.js` file is the core controller for the Gomoku game, handling all Socket.IO events and game logic:

### Room Management
- `list-rooms`: Lists all available game rooms
- `create-room`: Creates a new game room with a unique ID
- `join-room`: Joins an existing room or creates a new one
- `player-info`: Handles player information in rooms

### Game Mechanics
- `player-ready`: Handles player ready status
- `move`: Processes player moves on the game board
- `checkWin`: Detects winning conditions (5 in a row)
- `turn-changed`: Manages player turns

### Player Interaction
- `kick-player`: Allows room owners to kick other players
- `chat-message`: Enables in-game chat between players
- `reset-request`: Handles game reset requests
- `player-kicked`: Updates UI when a player is kicked

### Connection Management
- Handles player connections and disconnections
- Manages room cleanup when players leave
- Supports reconnection logic

## How to Play

1. Create a new room or join an existing one
2. Wait for another player to join
3. Click "Ready" to indicate you're ready to play
4. Take turns placing pieces on the board
5. Get 5 pieces in a row (horizontally, vertically, or diagonally) to win
6. Use the chat feature to communicate with your opponent

## Installation

```bash
# Install dependencies
npm install

# Start the server
npm start

# Access the game at http://localhost:8002
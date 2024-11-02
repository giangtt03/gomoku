const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const gameRoutes = require('./routes/gmkRoute');

app.use('/', gameRoutes(io)); 

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 20 * 1024 * 1024 
});

app.use(express.static(__dirname));

// Store history per room
let roomHistories = {};

io.on('connection', (socket) => {
    socket.on('join_room', (room) => {
        socket.join(room);
        if (!roomHistories[room]) roomHistories[room] = [];
        socket.emit('init_history', roomHistories[room]);
    });

    socket.on('send_message', (msg) => {
        const room = msg.room || 'DefaultRoom';
        if (!roomHistories[room]) roomHistories[room] = [];
        
        roomHistories[room].push(msg);
        if (roomHistories[room].length > 50) roomHistories[room].shift();
        
        io.to(room).emit('receive_message', msg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CryptoRoom running on port ${PORT}`);
});

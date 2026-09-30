const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 20 * 1024 * 1024 
});

// Serve static files from the repository root directly
app.use(express.static(__dirname));

let messageHistory = [];

io.on('connection', (socket) => {
    socket.emit('init_history', messageHistory);

    socket.on('send_message', (msg) => {
        messageHistory.push(msg);
        if (messageHistory.length > 50) messageHistory.shift();
        io.emit('receive_message', msg);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CryptoRoom running on port ${PORT}`);
});

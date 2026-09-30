const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Expanded buffer limit to 50MB for large videos & PDFs
const io = new Server(server, {
    maxHttpBufferSize: 50 * 1024 * 1024 
});

app.use(express.static(__dirname));

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
        if (roomHistories[room].length > 100) roomHistories[room].shift();
        
        io.to(room).emit('receive_message', msg);
    });

    socket.on('delete_message', (data) => {
        const room = data.room;
        if (roomHistories[room]) {
            roomHistories[room] = roomHistories[room].filter(m => m.id !== data.id);
            io.to(room).emit('remove_message', data.id);
        }
    });

    socket.on('react_message', (data) => {
        const room = data.room;
        if (roomHistories[room]) {
            let msg = roomHistories[room].find(m => m.id === data.id);
            if (msg) {
                if (!msg.reactions) msg.reactions = {};
                msg.reactions[data.user] = data.emoji;
                io.to(room).emit('update_message', msg);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CryptoRoom running on port ${PORT}`);
});

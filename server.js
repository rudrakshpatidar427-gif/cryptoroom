const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let roomHistories = {};
let roomUsers = {};

io.on('connection', (socket) => {
    socket.on('join_room', ({ room, username }) => {
        socket.join(room);
        socket.roomName = room;
        socket.userName = username;

        if (!roomHistories[room]) roomHistories[room] = [];
        if (!roomUsers[room]) roomUsers[room] = new Map();

        roomUsers[room].set(socket.id, username);
        
        socket.emit('init_history', roomHistories[room]);
        io.to(room).emit('room_users_update', roomUsers[room].size);
    });

    socket.on('send_message', (msg) => {
        const room = msg.room;
        if (!roomHistories[room]) roomHistories[room] = [];
        roomHistories[room].push(msg);
        if (roomHistories[room].length > 150) roomHistories[room].shift();
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
            const msg = roomHistories[room].find(m => m.id === data.id);
            if (msg) {
                if (!msg.reactions) msg.reactions = {};
                msg.reactions[data.user] = data.emoji;
                io.to(room).emit('update_message', msg);
            }
        }
    });

    socket.on('mark_read', (data) => {
        const room = data.room;
        if (roomHistories[room]) {
            const msg = roomHistories[room].find(m => m.id === data.id);
            if (msg && !msg.read) {
                msg.read = true;
                io.to(room).emit('update_message', msg);
            }
        }
    });

    socket.on('typing_start', (data) => {
        socket.to(data.room).emit('display_typing', data.username);
    });

    socket.on('typing_stop', (data) => {
        socket.to(data.room).emit('display_typing', null);
    });

    // WebRTC Signaling for Calls & Large Files
    socket.on('webrtc_offer', (data) => {
        socket.to(data.room).emit('webrtc_offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('webrtc_answer', (data) => {
        socket.to(data.room).emit('webrtc_answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('webrtc_ice_candidate', (data) => {
        socket.to(data.room).emit('webrtc_ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    socket.on('call_ended', (data) => {
        socket.to(data.room).emit('call_ended');
    });

    socket.on('disconnect', () => {
        const room = socket.roomName;
        if (room && roomUsers[room]) {
            roomUsers[room].delete(socket.id);
            io.to(room).emit('room_users_update', roomUsers[room].size);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`CryptoRoom running on port ${PORT}`);
});

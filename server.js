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
        
        io.to(room).emit('room_users_update', Array.from(roomUsers[room].values()));
    });

    // Chat Messaging & Reactions
    socket.on('send_message', (msg) => {
        const room = msg.room;
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

    // WebRTC Signaling for Video Calls & P2P Data Channels
    socket.on('webrtc_offer', (data) => {
        socket.to(data.room).emit('webrtc_offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('webrtc_answer', (data) => {
        socket.to(data.room).emit('webrtc_answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('webrtc_ice_candidate', (data) => {
        socket.to(data.room).emit('webrtc_ice_candidate', { candidate: data.candidate, sender: socket.id });
    });

    socket.on('disconnect', () => {
        const room = socket.roomName;
        if (room && roomUsers[room]) {
            roomUsers[room].delete(socket.id);
            io.to(room).emit('room_users_update', Array.from(roomUsers[room].values()));
            socket.to(room).emit('peer_disconnected', socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
    socket.on('join', () => socket.broadcast.emit('user-joined'));
    socket.on('join-ack', () => socket.broadcast.emit('join-ack'));

    socket.on('offer', (data) => socket.broadcast.emit('offer', data));
    socket.on('answer', (data) => socket.broadcast.emit('answer', data));
    socket.on('ice-candidate', (data) => socket.broadcast.emit('ice-candidate', data));

    // THE FIX: Dakiye ko sikhaya ki camera mode dusre user ko bhejna hai
    socket.on('camera-facing', (mode) => {
        socket.broadcast.emit('camera-facing', mode);
    });

    socket.on('disconnect', () => socket.broadcast.emit('user-left'));
});

server.listen(5000, () => console.log('Server is running on port 5000'));
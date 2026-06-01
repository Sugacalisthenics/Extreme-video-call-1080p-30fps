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

    // Camera mode sync
    socket.on('camera-facing', (mode) => {
        socket.broadcast.emit('camera-facing', mode);
    });

    socket.on('disconnect', () => socket.broadcast.emit('user-left'));
});

// FIX: Render dynamic port support
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
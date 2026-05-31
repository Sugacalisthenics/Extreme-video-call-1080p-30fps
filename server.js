const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Express se ek HTTP server banaya
const server = http.createServer(app);

// Socket.io ko apne server ke saath jod diya
const io = new Server(server, {
    cors: {
        origin: "*", // Abhi ke liye sabko allow kar rahe hain
        methods: ["GET", "POST"]
    }
});

// Jab bhi koi naya user website kholega, yeh chalega
io.on('connection', (socket) => {
    console.log(`Naya user connect hua: ${socket.id}`);

    // Jab ek user dusre ko call ki details (offer) bhejega
    socket.on('offer', (data) => {
        socket.broadcast.emit('offer', data);
    });

    // Jab dusra user call accept karke jawab (answer) dega
    socket.on('answer', (data) => {
        socket.broadcast.emit('answer', data);
    });

    // Network ka raasta (ICE Candidates) share karne ke liye
    socket.on('ice-candidate', (data) => {
        socket.broadcast.emit('ice-candidate', data);
    });

    // Jab user website band kar dega
    socket.on('disconnect', () => {
        console.log(`User disconnect ho gaya: ${socket.id}`);
    });
});

// Server ko port 5000 par start kar diya
const PORT = 5000;
server.listen(PORT, () => {
    console.log(`Signaling Server port ${PORT} par daud raha hai 🚀`);
});
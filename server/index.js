const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const admin = require('firebase-admin');

// IMPORTANT: Replace this with your actual Firebase Admin credentials JSON.
// For now, we are simulating a Firestore DB structure for the sockets.
// In actual production, you would do:
// const serviceAccount = require('./firebase-permissions.json');
// admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const app = express();
app.use(cors());

// --- REMOVED MULTER AND UPLOADS LOGIC --- //

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

let matrixState = {
  rows: 10,
  cols: 10,
  eventName: "Paradox",
  videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  users: {} // Format: { socketId: { row, col, status: 'buffering' | 'ready' } }
};



io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send current state to new client
  socket.emit('matrix_state', matrixState);

  socket.on('client_join', ({ row, col }) => {
    // Check if spot is taken
    const isTaken = Object.values(matrixState.users).some(u => u.row === row && u.col === col);
    if (!isTaken) {
      matrixState.users[socket.id] = { row, col, status: 'buffering' };
      io.emit('grid_update', matrixState.users);
      socket.emit('join_success');
    } else {
      socket.emit('join_error', 'Spot is already taken.');
    }
  });

  socket.on('client_ready', () => {
    if (matrixState.users[socket.id]) {
      matrixState.users[socket.id].status = 'ready';
      io.emit('grid_update', matrixState.users);
    }
  });

  socket.on('admin_update_matrix', ({ rows, cols, eventName }) => {
    matrixState.rows = rows;
    matrixState.cols = cols;
    if (eventName) {
      matrixState.eventName = eventName;
    }

    // Clear users
    matrixState.users = {};
    io.emit('matrix_state', matrixState);
    io.emit('admin_reset');
  });

  socket.on('admin_video_uploaded', (newVideoUrl) => {
    matrixState.videoUrl = newVideoUrl;
    io.emit('matrix_state', matrixState);
    io.emit('admin_reset'); // Force clients back to waiting/onboarding so they reload the new video
  });

  socket.on('admin_play', () => {
    io.emit('admin_play');
  });

  socket.on('admin_pause', () => {
    io.emit('admin_pause');
  });

  socket.on('admin_reset', () => {
    // Admin global reset
    matrixState.users = {};
    io.emit('matrix_state', matrixState);
    io.emit('admin_reset');
  });

  socket.on('admin_kick', (socketIdToKick) => {
    if (matrixState.users[socketIdToKick]) {
      delete matrixState.users[socketIdToKick];
      io.to(socketIdToKick).emit('admin_reset');
      io.emit('grid_update', matrixState.users);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    if (matrixState.users[socket.id]) {
      delete matrixState.users[socket.id];
      io.emit('grid_update', matrixState.users);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.io server running on port ${PORT}`);
});

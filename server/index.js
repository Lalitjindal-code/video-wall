const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Configure Multer for video uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})
const upload = multer({ storage: storage })

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
  orientation: "landscape", // "landscape" | "portrait"
  objectFit: "fill", // "cover" (crop) | "fill" (stretch) | "contain"
  videoUrl: "", // Wait for admin upload
  users: {} // Format: { socketId: { row, col, status: 'buffering' | 'ready' } }
};

// Express Route for Video Upload
app.post('/upload', upload.single('video'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  // Use a relative URL so that clients can prepend their own dynamically resolved backend domain/IP
  const newVideoUrl = `/uploads/${req.file.filename}`;

  // Update global matrix state
  matrixState.videoUrl = newVideoUrl;

  // Broadcast state update so clients reload
  io.emit('matrix_state', matrixState);
  io.emit('admin_reset'); // Force clients back to waiting so they reload the new video

  res.json({ message: 'File uploaded successfully', url: newVideoUrl });
});
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

  socket.on('admin_update_matrix', ({ rows, cols, eventName, orientation, objectFit }) => {
    matrixState.rows = rows;
    matrixState.cols = cols;
    if (eventName) {
      matrixState.eventName = eventName;
    }
    if (orientation) {
      matrixState.orientation = orientation;
    }
    if (objectFit) {
      matrixState.objectFit = objectFit;
    }

    // Clear users
    matrixState.users = {};
    io.emit('matrix_state', matrixState);
    io.emit('admin_reset');
  });

  socket.on('admin_force_download', () => {
    io.emit('force_download');
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

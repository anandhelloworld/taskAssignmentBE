require('dotenv').config();
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const createApp = require('./app');
const connectDB = require('./config/db');

async function start() {
  await connectDB();

  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: process.env.CLIENT_ORIGIN || '*' },
  });

  // Require a valid JWT to open a socket connection, mirroring the REST auth.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication token missing'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch (err) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.role === 'manager') socket.join('role:manager');
    console.log(`Socket connected: user ${socket.user.id}`);
  });

  app.set('io', io);

  const port = process.env.PORT || 5000;
  server.listen(port, () => console.log(`Server listening on port ${port}`));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

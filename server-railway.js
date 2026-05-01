/**
 * Railway-optimized Socket.io server for real-time functionality
 * Configured for production deployment on Railway
 */

const { createServer } = require('http');
const { Server } = require('socket.io');

// Railway provides PORT environment variable
const PORT = process.env.PORT || 3001;

// Get allowed origins from environment variable or use defaults
const getAllowedOrigins = () => {
  if (process.env.ALLOWED_ORIGINS) {
    return process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  }
  
  // Default origins for development and production
  const origins = [
    'http://localhost:3000',
    'https://localhost:3000',
    // Add common deployment domains
    'https://eodsa-dev.vercel.app',
    'https://eodsa-dev-git-main.vercel.app',
    // Allow all Vercel preview deployments
    /https:\/\/.*\.vercel\.app$/
  ];
  
  // Add Railway and Vercel domains if available
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    origins.push(`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }
  
  // Add custom domain if specified
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  console.log('🌐 Allowed CORS origins:', origins);
  return origins;
};

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 50000,
  connectTimeout: 60000,
  allowEIO3: true
});

// Health check endpoint for Railway
// IMPORTANT: Only handle specific paths, let Socket.IO handle everything else
server.on('request', (req, res) => {
  // Only intercept health check requests
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      connectedClients: io.engine.clientsCount 
    }));
    return;
  }
  
  // Only respond to root path for status
  if (req.url === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('EODSA WebSocket Server - Running');
    return;
  }
  
  // Let Socket.IO handle all other requests (polling, websocket upgrade, etc.)
  // DO NOT send any response here - Socket.IO will handle it
});

// Socket.io event handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (Total: ${io.engine.clientsCount})`);

  // Join event-specific rooms
  socket.on('join:event', (eventId) => {
    socket.join(`event:${eventId}`);
    console.log(`📡 Socket ${socket.id} joined event room: ${eventId}`);
  });

  socket.on('join:judge', ({ eventId, judgeId }) => {
    socket.join(`judges:${eventId}`);
    socket.data.judgeId = judgeId;
    socket.data.eventId = eventId;
    console.log(`⚖️ Judge ${judgeId} joined event ${eventId}`);
  });

  socket.on('join:sound', (eventId) => {
    socket.join(`sound:${eventId}`);
    socket.data.role = 'sound';
    socket.data.eventId = eventId;
    console.log(`🎵 Sound tech joined event ${eventId}`);
  });

  socket.on('join:backstage', (eventId) => {
    socket.join(`backstage:${eventId}`);
    socket.data.role = 'backstage';
    socket.data.eventId = eventId;
    console.log(`🎭 Backstage joined event ${eventId}`);
  });

  socket.on('join:announcer', (eventId) => {
    socket.join(`announcer:${eventId}`);
    socket.data.role = 'announcer';
    socket.data.eventId = eventId;
    console.log(`📢 Announcer joined event ${eventId}`);
  });

  socket.on('join:registration', (eventId) => {
    socket.join(`registration:${eventId}`);
    socket.data.role = 'registration';
    socket.data.eventId = eventId;
    console.log(`✅ Registration joined event ${eventId}`);
  });

  socket.on('join:media', (eventId) => {
    socket.join(`media:${eventId}`);
    socket.data.role = 'media';
    socket.data.eventId = eventId;
    console.log(`📸 Media joined event ${eventId}`);
  });

  // Handle performance reordering from backstage
  socket.on('performance:reorder', (data) => {
    console.log(`🔄 Performance reorder broadcast for event ${data.eventId}`);
    
    // Broadcast to all rooms for this event (include backstage for multi–backstage clients)
    io.to(`event:${data.eventId}`).emit('performance:reorder', data);
    io.to(`judges:${data.eventId}`).emit('performance:reorder', data);
    io.to(`sound:${data.eventId}`).emit('performance:reorder', data);
    io.to(`backstage:${data.eventId}`).emit('performance:reorder', data);
    io.to(`announcer:${data.eventId}`).emit('performance:reorder', data);
    io.to(`registration:${data.eventId}`).emit('performance:reorder', data);
    io.to(`media:${data.eventId}`).emit('performance:reorder', data);
  });

  // Handle status updates
  socket.on('performance:status', (data) => {
    console.log(`📊 Status update broadcast: ${data.performanceId} -> ${data.status}`);
    
    // Broadcast to all relevant rooms
    io.to(`event:${data.eventId}`).emit('performance:status', data);
    io.to(`judges:${data.eventId}`).emit('performance:status', data);
    io.to(`sound:${data.eventId}`).emit('performance:status', data);
    io.to(`backstage:${data.eventId}`).emit('performance:status', data);
    io.to(`announcer:${data.eventId}`).emit('performance:status', data);
    io.to(`registration:${data.eventId}`).emit('performance:status', data);
    io.to(`media:${data.eventId}`).emit('performance:status', data);
  });

  // Handle event control commands
  socket.on('event:control', (data) => {
    console.log(`🎯 Event control: ${data.action} for event ${data.eventId}`);
    
    // Broadcast to all rooms
    io.to(`event:${data.eventId}`).emit('event:control', data);
    io.to(`judges:${data.eventId}`).emit('event:control', data);
    io.to(`sound:${data.eventId}`).emit('event:control', data);
    io.to(`announcer:${data.eventId}`).emit('event:control', data);
    io.to(`registration:${data.eventId}`).emit('event:control', data);
    io.to(`media:${data.eventId}`).emit('event:control', data);
  });

  // Handle presence updates
  socket.on('presence:update', (data) => {
    console.log(`👥 Presence update: ${data.performanceId} -> ${data.present ? 'Present' : 'Absent'}`);
    
    // Broadcast presence updates to all rooms
    io.to(`event:${data.eventId}`).emit('presence:update', data);
    io.to(`backstage:${data.eventId}`).emit('presence:update', data);
    io.to(`announcer:${data.eventId}`).emit('presence:update', data);
    io.to(`registration:${data.eventId}`).emit('presence:update', data);
    io.to(`media:${data.eventId}`).emit('presence:update', data);
  });

  // Handle performance announcements
  socket.on('performance:announced', (data) => {
    console.log(`📢 Performance announced: ${data.performanceId}`);
    
    // Broadcast to all rooms except announcer (they initiated it)
    io.to(`event:${data.eventId}`).emit('performance:announced', data);
    io.to(`backstage:${data.eventId}`).emit('performance:announced', data);
    io.to(`judges:${data.eventId}`).emit('performance:announced', data);
    io.to(`sound:${data.eventId}`).emit('performance:announced', data);
    io.to(`registration:${data.eventId}`).emit('performance:announced', data);
    io.to(`media:${data.eventId}`).emit('performance:announced', data);
  });

  // Send a test notification
  socket.on('test:notification', (data) => {
    console.log('📢 Sending test notification:', data);
    io.to(`event:${data.eventId}`).emit('notification', {
      type: 'info',
      message: 'Test notification from backstage!',
      eventId: data.eventId
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`❌ Client disconnected: ${socket.id} (Reason: ${reason}) (Remaining: ${io.engine.clientsCount - 1})`);
  });

  socket.on('error', (error) => {
    console.error(`🚨 Socket error for ${socket.id}:`, error);
  });
});

// Error handling
server.on('error', (error) => {
  console.error('🚨 Server error:', error);
});

io.engine.on('connection_error', (err) => {
  // Suppress headers already sent errors (they're expected during connection issues)
  if (err.code === 'ERR_HTTP_HEADERS_SENT') {
    // This happens when clients disconnect during polling - it's normal, don't log it
    return;
  }
  console.error('🚨 Connection error:', err);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // Suppress Socket.IO polling errors (they're expected during normal operation)
  if (reason && reason.code === 'ERR_HTTP_HEADERS_SENT') {
    // This is a known Socket.IO polling race condition - safe to ignore
    return;
  }
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 EODSA WebSocket Server Started!`);
  console.log(`📡 Railway Port: ${PORT}`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎭 Ready for backstage control and live updates`);
  
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    console.log(`🔗 Public URL: https://${process.env.RAILWAY_PUBLIC_DOMAIN}`);
  }
  
  console.log(`\n✨ Health check: /health`);
  console.log(`📊 Connected clients: 0\n`);
});

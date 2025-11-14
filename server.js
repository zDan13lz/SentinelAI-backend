require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const aiRoutes = require('./routes/ai');
const optionsRoutes = require('./routes/options');
const flowRoutes = require('./routes/flow');
// const technicalRoutes = require('./routes/technical'); // ❌ COMMENTED OUT - Not created yet
const insightsRoutes = require('./routes/insights'); //  NEW: Insights routes

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Make io available globally for WebSocket broadcasting
global.io = io;

// Mount routes
app.use('/api/ai', aiRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/flow', flowRoutes);
// app.use('/api/technical', technicalRoutes); // ❌ COMMENTED OUT
app.use('/api/insights', insightsRoutes); //  NEW: Insights endpoints

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'SentinelAI Backend',
    timestamp: new Date().toISOString(),
    socketConnections: io.engine.clientsCount
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Socket.io client connected:', socket.id);
  
  socket.on('user:search', (data) => {
    console.log('🔍 User searching for ticker:', data.ticker);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Socket.io client disconnected:', socket.id);
  });
});

//  Initialize TA WebSocket Server (if exists)
try {
  const taWebSocketServer = require('./websocket/taWebSocket');
} catch (err) {
  console.log('⚠️  TA WebSocket server not found (optional)');
}

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('\n🚀 SentinelAI Backend running on port', PORT);
  console.log('📡 API endpoints:');
  console.log(`   - POST http://localhost:${PORT}/api/ai/analyze`);
  console.log(`   - GET  http://localhost:${PORT}/api/ai/health`);
  console.log(`   - GET  http://localhost:${PORT}/api/options/*`);
  console.log(`   - GET  http://localhost:${PORT}/api/flow/*`);
  console.log(`   - GET  http://localhost:${PORT}/api/insights/*`); //  NEW
  console.log(`   - GET  http://localhost:${PORT}/health`);
  console.log('🔌 WebSocket ready at ws://localhost:' + PORT);
  console.log(`👤 Connected clients: ${io.engine.clientsCount}\n`);
  
  // Initialize Massive.com WebSocket (single connection)
  if (process.env.MASSIVE_API_KEY) {
    try {
      const MassiveWebSocketClient = require('./services/massiveWebSocketClient');
      const wsClient = new MassiveWebSocketClient(process.env.MASSIVE_API_KEY, io);
      wsClient.connect();
      console.log('📡 Massive.com WebSocket client initialized\n');
    } catch (err) {
      console.log('⚠️  Massive.com WebSocket client not found (optional)\n');
    }
  } else {
    console.log('⚠️  MASSIVE_API_KEY not found in .env');
    console.log('⚠️  Running in database-only mode\n');
  }

  // ============================================================================
  // 🆕 INITIALIZE DAILY RESET CRON JOB
  // ============================================================================
  try {
    const { scheduleDailyReset } = require('./jobs/dailyReset');
    scheduleDailyReset();
    console.log('⏰ Daily flow reset scheduled for 3:00 AM ET\n');
  } catch (err) {
    console.log('⚠️  Daily reset job not found (optional)\n');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error);
});
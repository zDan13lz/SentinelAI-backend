require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai');
const optionsRoutes = require('./routes/options');
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Routes
app.use('/api/ai', aiRoutes);
app.use('/api/options', optionsRoutes);
// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    service: 'SentinelAI Backend',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 SentinelAI Backend running on port ${PORT}`);
  console.log(`📡 API endpoints:`);
  console.log(`   - POST http://localhost:${PORT}/api/ai/analyze`);
  console.log(`   - GET  http://localhost:${PORT}/api/ai/health`);
});
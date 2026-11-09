const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const healthHandler = (req, res) => {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(200).json({
    status: 'ok',
    service: 'MediKiosk API (SIH26047)',
    dbState: states[mongoose.connection.readyState] || 'unknown',
    timestamp: new Date().toISOString()
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get(['/', '/api'], (req, res) => {
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  res.status(200).json({
    status: 'ok',
    service: 'MediKiosk API (SIH26047)',
    message: 'MediKiosk Backend API is running successfully',
    frontendUrl: 'http://localhost:5173',
    dbState: states[mongoose.connection.readyState] || 'unknown',
    healthEndpoint: '/health',
    endpoints: [
      '/health',
      '/api/auth',
      '/api/patients',
      '/api/cases',
      '/api/documents',
      '/api/triage',
      '/api/analytics',
      '/api/search',
      '/api/consent-history'
    ]
  });
});

const routeMappings = [
  ['/api/auth', './routes/auth.routes.js'],
  ['/api/patients', './routes/patient.routes.js'],
  ['/api/cases', './routes/case.routes.js'],
  ['/api/documents', './routes/document.routes.js'],
  ['/api/triage', './routes/triage.routes.js'],
  ['/api/analytics', './routes/analytics.routes.js'],
  ['/api/search', './routes/search.routes.js'],
  ['/api/consent-history', './routes/consentHistory.routes.js']
];

for (const [mountPath, relFile] of routeMappings) {
  const fullPath = path.join(__dirname, relFile);
  if (fs.existsSync(fullPath)) {
    app.use(mountPath, require(relFile));
  }
}

app.use(errorHandler);

module.exports = app;

const { connectDB } = require('./config/db');
const { PORT } = require('./config/env');
const app = require('./app');

async function startServer() {
  try {
    await connectDB();
    const server = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[MediKiosk] Server running on http://127.0.0.1:${PORT}`);
    });
    return server;
  } catch (err) {
    console.error('[MediKiosk] Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };

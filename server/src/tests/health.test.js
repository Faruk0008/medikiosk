const request = require('supertest');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');

describe('Phase 1: Health & Server Boot Check', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('GET /health returns 200 OK with service status and MongoDB state', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('MediKiosk API (SIH26047)');
    expect(res.body.dbState).toBe('connected');
    expect(res.body.timestamp).toBeDefined();
  });
});

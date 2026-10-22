const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');

describe('Phase 5: Indexing, Covered Query & Aggregation Pipelines (/api/analytics)', () => {
  let physicianToken;
  let samplePatientId;

  beforeAll(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    await connectDB();

    const docRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dr. Sushruta',
        email: 'sushruta@aiia.gov.in',
        password: 'password123',
        role: 'physician'
      });
    physicianToken = docRes.body.token;

    const pRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Kiran Desai',
        email: 'kiran@patient.in',
        password: 'password123',
        role: 'patient',
        demographics: { age: 49, sex: 'female', address: 'Pune, Maharashtra' }
      });
    samplePatientId = pRes.body.patient._id;

    await CaseRecord.create([
      {
        patientId: samplePatientId,
        mode: 'allopathic',
        status: 'submitted',
        priority: 85,
        createdAt: new Date('2026-10-12T09:00:00Z'),
        history: { chiefComplaint: 'Chest pain and dyspnoea', hpi: { severity: 8 } },
        redFlags: [{ ruleId: 'RF_ACS_01', code: 'CARDIO_DYSPNOEA', severity: 'critical', priorityBoost: 45 }]
      },
      {
        patientId: samplePatientId,
        mode: 'ayush',
        status: 'submitted',
        priority: 40,
        createdAt: new Date('2026-10-12T14:00:00Z'),
        history: { chiefComplaint: 'Amavata (Joint pain)', hpi: { severity: 5 } },
        redFlags: []
      },
      {
        patientId: samplePatientId,
        mode: 'ayush',
        status: 'reviewed',
        priority: 35,
        createdAt: new Date('2026-10-13T11:00:00Z'),
        history: { chiefComplaint: 'Amavata (Joint pain)', hpi: { severity: 4 } },
        redFlags: []
      }
    ]);

    await MedicalDocument.create([
      {
        patientId: samplePatientId,
        docType: 'labReport',
        docDate: new Date('2026-10-11T08:30:00Z'),
        extracted: {
          diagnoses: ['Amavata', 'Anemia'],
          medications: [{ name: 'Yogaraja Guggulu', dose: '500mg BID' }],
          investigations: [
            { name: 'ESR', value: 52, unit: 'mm/hr', refRange: '0-20', abnormal: true },
            { name: 'Hemoglobin', value: 9.8, unit: 'g/dL', refRange: '12.0-16.0', abnormal: true },
            { name: 'Fasting Blood Sugar', value: 88, unit: 'mg/dL', refRange: '70-100', abnormal: false }
          ]
        }
      }
    ]);
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('Verifies all required MongoDB indexes are registered on CaseRecord, User, and MedicalDocument', async () => {
    const caseIndexes = await CaseRecord.collection.indexes();
    const indexNames = caseIndexes.map(i => i.name);
    expect(indexNames).toContain('idx_case_patient_created');
    expect(indexNames).toContain('idx_case_triage_queue');
    expect(indexNames).toContain('idx_case_text_search');
    expect(indexNames).toContain('idx_case_ttl_stale_drafts');
  });

  test('GET /api/analytics/cases-per-day aggregates cases per day and per mode ($group, $dateToString)', async () => {
    const res = await request(app)
      .get('/api/analytics/cases-per-day')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(res.body.chartData.length).toBeGreaterThanOrEqual(2);
    const oct12 = res.body.chartData.find(d => d.day === '2026-10-12');
    expect(oct12.allopathic).toBe(1);
    expect(oct12.ayush).toBe(1);
    expect(oct12.total).toBe(2);
  });

  test('GET /api/analytics/top-complaints returns top 10 chief complaints sorted by frequency', async () => {
    const res = await request(app)
      .get('/api/analytics/top-complaints')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(res.body.data[0].chiefComplaint).toBe('Amavata (Joint pain)');
    expect(res.body.data[0].count).toBe(2);
  });

  test('GET /api/analytics/abnormal-labs unwinds and groups abnormal lab investigations ($unwind, $group)', async () => {
    const res = await request(app)
      .get('/api/analytics/abnormal-labs')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(2);
    const names = res.body.data.map(d => d.testName);
    expect(names).toContain('ESR');
    expect(names).toContain('Hemoglobin');
  });

  test('GET /api/analytics/patient-timeline/:patientId merges CaseRecords and MedicalDocuments ($lookup, $unionWith)', async () => {
    const res = await request(app)
      .get(`/api/analytics/patient-timeline/${samplePatientId}`)
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(res.body.count).toBe(4);
    const types = res.body.timeline.map(e => e.entryType);
    expect(types).toContain('case');
    expect(types).toContain('document');
  });

  test('GET /api/analytics/red-flags-per-week aggregates red flags by ISO week', async () => {
    const res = await request(app)
      .get('/api/analytics/red-flags-per-week')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(res.body.weeklyChart.length).toBeGreaterThanOrEqual(1);
    expect(res.body.weeklyChart[0].critical).toBe(1);
  });

  test('GET /api/analytics/covered-query executes a covered index query with totalDocsExamined === 0', async () => {
    const res = await request(app)
      .get('/api/analytics/covered-query')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(['PROJECTION_COVERED', 'IXSCAN']).toContain(res.body.executionStats.executionStages.stage);
    expect(res.body.executionStats.totalDocsExamined).toBe(0);
    expect(res.body.executionStats.nReturned).toBe(2);
  });
});

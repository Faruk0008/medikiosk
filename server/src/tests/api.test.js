const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../app');
const { connectDB, disconnectDB } = require('../config/db');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');

describe('Phase 3 & 4: CRUD API, JWT Auth, RBAC & Triage Queue (Supertest)', () => {
  let patient1Token, patient1Id;
  let patient2Token, patient2Id;
  let physicianToken;
  let triageToken;
  let case1Id, draftCaseId, doc1Id;

  beforeAll(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('POST /api/auth/register & POST /api/auth/login create accounts and issue JWTs for patient, physician, and triage roles', async () => {
    const p1Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Rohan Verma',
        email: 'rohan@patient.in',
        password: 'password123',
        role: 'patient',
        language: 'hi',
        abhaId: '91-1122-3344-5566',
        demographics: { age: 58, sex: 'male', address: 'Lajpat Nagar, New Delhi' }
      })
      .expect(201);

    expect(p1Res.body.token).toBeDefined();
    expect(p1Res.body.patient).toBeDefined();
    patient1Token = p1Res.body.token;
    patient1Id = p1Res.body.patient._id;

    const p2Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Priya Nair',
        email: 'priya@patient.in',
        password: 'password123',
        role: 'patient',
        demographics: { age: 31, sex: 'female', address: 'Kochi, Kerala' }
      })
      .expect(201);
    patient2Token = p2Res.body.token;
    patient2Id = p2Res.body.patient._id;

    const docRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Dr. Charaka Vaidya',
        email: 'charaka@aiia.gov.in',
        password: 'password123',
        role: 'physician'
      })
      .expect(201);
    physicianToken = docRes.body.token;

    const triRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Sister Anjali',
        email: 'anjali@aiia.gov.in',
        password: 'password123',
        role: 'triage'
      })
      .expect(201);
    triageToken = triRes.body.token;

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'rohan@patient.in', password: 'password123' })
      .expect(200);
    expect(loginRes.body.user.email).toBe('rohan@patient.in');
  });

  test('Patient RBAC & Consent: Patients access only their own data and can toggle PATCH /api/patients/:id/consent', async () => {
    await request(app)
      .get(`/api/patients/${patient1Id}`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);

    await request(app)
      .get(`/api/patients/${patient2Id}`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(403);

    const consentRes = await request(app)
      .patch(`/api/patients/${patient1Id}/consent`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({ dataCapture: true, sharing: true })
      .expect(200);
    expect(consentRes.body.consent.sharing).toBe(true);

    // Verify GET /api/consent-history/:patientId
    const consentHistRes = await request(app)
      .get(`/api/consent-history/${patient1Id}`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);
    expect(consentHistRes.body.history.length).toBeGreaterThanOrEqual(1);

  });

  test('Documents CRUD & Abnormal Lab Flagging: POST /api/documents flags abnormal labs and builds chronological timeline', async () => {
    const createDocRes = await request(app)
      .post('/api/documents')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({
        patientId: patient1Id,
        docType: 'labReport',
        docDate: '2026-10-15T10:00:00.000Z',
        extracted: {
          diagnoses: ['Coronary Artery Disease', 'Hyperkalemia'],
          medications: [{ name: 'Aspirin', dose: '75mg OD' }],
          investigations: [
            { name: 'Troponin-I', value: 0.85, unit: 'ng/mL', refRange: '0-0.04' },
            { name: 'Hemoglobin', value: 14.2, unit: 'g/dL', refRange: '13.0-17.0' }
          ]
        },
        rawText: 'Elevated Troponin-I level noted.'
      })
      .expect(201);

    doc1Id = createDocRes.body._id;
    expect(createDocRes.body.extracted.investigations[0].abnormal).toBe(true);
    expect(createDocRes.body.extracted.investigations[1].abnormal).toBe(false);

    await request(app)
      .get(`/api/documents/${doc1Id}`)
      .set('Authorization', `Bearer ${patient2Token}`)
      .expect(403);
  });

  test('Cases CRUD, Submit & Red-Flag Engine: POST /api/cases, POST /:id/submit, PATCH /:id/review, and GET /api/triage/queue', async () => {
    const c1Res = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${patient1Token}`)
      .send({
        patientId: patient1Id,
        mode: 'allopathic',
        history: {
          chiefComplaint: 'Severe retrosternal chest pain with dyspnoea',
          hpi: {
            site: 'Central chest',
            onset: 'Sudden 1 hour ago',
            character: 'Crushing pressure',
            radiation: 'Left arm and jaw',
            associations: 'Shortness of breath and sweating',
            severity: 9
          },
          pastMedicalSurgical: ['Hypertension'],
          drugAllergy: ['Penicillin']
        }
      })
      .expect(201);

    case1Id = c1Res.body._id;
    expect(c1Res.body.status).toBe('draft');

    const draftRes = await request(app)
      .post('/api/cases')
      .set('Authorization', `Bearer ${patient2Token}`)
      .send({
        patientId: patient2Id,
        mode: 'ayush',
        history: {
          chiefComplaint: 'Mild indigestion (Ajirna)',
          hpi: { severity: 3 },
          dashavidhaPariksha: { prakriti: 'Pitta-Kapha', vikriti: 'Pitta Vriddhi' }
        }
      })
      .expect(201);
    draftCaseId = draftRes.body._id;

    await request(app)
      .get(`/api/cases/${draftCaseId}`)
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(403);

    const submitRes = await request(app)
      .post(`/api/cases/${case1Id}/submit`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);

    expect(submitRes.body.status).toBe('submitted');
    expect(submitRes.body.redFlags.length).toBeGreaterThanOrEqual(2);
    expect(submitRes.body.priority).toBeGreaterThanOrEqual(80);

    const queueRes = await request(app)
      .get('/api/triage/queue')
      .set('Authorization', `Bearer ${triageToken}`)
      .expect(200);

    expect(queueRes.body.count).toBe(1);
    expect(queueRes.body.data[0]._id).toBe(case1Id);

    // Verify PATCH /api/triage/:caseId/acknowledge
    const ackRes = await request(app)
      .patch(`/api/triage/${case1Id}/acknowledge`)
      .set('Authorization', `Bearer ${triageToken}`)
      .expect(200);
    expect(ackRes.body.triageAcknowledged).toBe(true);

    // Verify GET /api/search?q=chest
    const searchRes = await request(app)
      .get('/api/search?q=chest')
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);
    expect(searchRes.body.cases.length).toBeGreaterThanOrEqual(1);


    const reviewRes = await request(app)
      .patch(`/api/cases/${case1Id}/review`)
      .set('Authorization', `Bearer ${physicianToken}`)
      .send({
        updates: {
          'history.chiefComplaint': 'Acute ST-Elevation Myocardial Infarction (Chest pain + dyspnoea)'
        }
      })
      .expect(200);

    expect(reviewRes.body.status).toBe('reviewed');
    expect(reviewRes.body.physicianEdits).toHaveLength(1);
    expect(reviewRes.body.physicianEdits[0].field).toBe('history.chiefComplaint');

    const timelineRes = await request(app)
      .get(`/api/documents/patient/${patient1Id}/timeline`)
      .set('Authorization', `Bearer ${physicianToken}`)
      .expect(200);

    expect(timelineRes.body.timeline.length).toBe(2);
  });

  test('Cascade Delete: Deleting a patient cascades to all their CaseRecords and MedicalDocuments', async () => {
    const delRes = await request(app)
      .delete(`/api/patients/${patient1Id}`)
      .set('Authorization', `Bearer ${patient1Token}`)
      .expect(200);

    expect(delRes.body.cascaded.casesDeleted).toBe(1);
    expect(delRes.body.cascaded.documentsDeleted).toBe(1);

    const remainingCases = await CaseRecord.countDocuments({ patientId: patient1Id });
    const remainingDocs = await MedicalDocument.countDocuments({ patientId: patient1Id });
    expect(remainingCases).toBe(0);
    expect(remainingDocs).toBe(0);
  });
});

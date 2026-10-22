const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const PhysicianAssignment = require('../models/PhysicianAssignment');

describe('Phase 2: Schema Design, Indexes & $jsonSchema Validation (Unit III)', () => {
  beforeAll(async () => {
    await connectDB();
    await mongoose.connection.dropDatabase();
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  test('User model creates valid user and enforces unique email + unique sparse abhaId', async () => {
    const u1 = await User.create({
      name: 'Aarav Sharma',
      role: 'patient',
      email: 'aarav@example.com',
      passwordHash: '$2b$10$abcdef1234567890abcdef1234567890',
      language: 'hi',
      abhaId: '12-3456-7890-1234'
    });
    expect(u1._id).toBeDefined();
    expect(u1.role).toBe('patient');

    await expect(
      User.create({
        name: 'Aarav Clone',
        role: 'patient',
        email: 'aarav@example.com',
        passwordHash: '$2b$10$abcdef1234567890abcdef1234567890'
      })
    ).rejects.toThrow(/duplicate key/i);

    await expect(
      User.create({
        name: 'Another User',
        role: 'patient',
        email: 'other@example.com',
        passwordHash: '$2b$10$abcdef1234567890abcdef1234567890',
        abhaId: '12-3456-7890-1234'
      })
    ).rejects.toThrow(/duplicate key/i);

    const u2 = await User.create({
      name: 'Dr. Meera Nair',
      role: 'physician',
      email: 'meera@aiia.gov.in',
      passwordHash: '$2b$10$abcdef1234567890abcdef1234567890'
    });
    const u3 = await User.create({
      name: 'Nurse Vikram',
      role: 'triage',
      email: 'vikram@aiia.gov.in',
      passwordHash: '$2b$10$abcdef1234567890abcdef1234567890'
    });
    expect(u2.abhaId).toBeUndefined();
    expect(u3.abhaId).toBeUndefined();
  });

  test('MongoDB $jsonSchema validator rejects raw collection insert with invalid role or missing required fields', async () => {
    await expect(
      User.collection.insertOne({
        name: 'Invalid Role User',
        role: 'admin_hacker',
        email: 'bad@example.com',
        passwordHash: '$2b$10$abcdef1234567890abcdef1234567890'
      })
    ).rejects.toThrow(/Document failed validation/i);
  });

  test('Patient model enforces 1:1 userId reference, demographics bounds, and revocable consent', async () => {
    const user = await User.findOne({ email: 'aarav@example.com' });
    const patient = await Patient.create({
      userId: user._id,
      demographics: { age: 42, sex: 'male', address: 'Sector 14, Chandigarh' },
      consent: { dataCapture: true, sharing: true, updatedAt: new Date() },
      revocable: true
    });
    expect(patient._id).toBeDefined();
    expect(patient.demographics.age).toBe(42);
    expect(patient.revocable).toBe(true);

    await expect(
      Patient.collection.insertOne({
        userId: new mongoose.Types.ObjectId(),
        demographics: { age: 250, sex: 'male', address: 'Invalid' },
        consent: { dataCapture: true, sharing: false, updatedAt: new Date() },
        revocable: true
      })
    ).rejects.toThrow(/Document failed validation/i);
  });

  test('CaseRecord model supports embedded history (allopathic + ayush dashavidhaPariksha), redFlags, and physicianEdits', async () => {
    const patient = await Patient.findOne({});
    const physician = await User.findOne({ role: 'physician' });

    const ayushCase = await CaseRecord.create({
      patientId: patient._id,
      mode: 'ayush',
      status: 'submitted',
      priority: 75,
      history: {
        chiefComplaint: 'Chronic joint stiffness and morning pain (Amavata)',
        hpi: {
          site: 'Bilateral knee and wrist joints',
          onset: 'Gradual over 6 months',
          character: 'Throbbing and heavy ache',
          radiation: 'None',
          associations: 'Morning stiffness > 45 mins, low appetite',
          timeCourse: 'Worse in early morning',
          exacerbatingRelieving: 'Worse with cold damp weather, relieved by warm fomentation',
          severity: 7
        },
        pastMedicalSurgical: ['Mild Hypertension (2022)'],
        drugAllergy: ['Sulfa drugs'],
        family: ['Father had rheumatoid arthritis'],
        personal: {
          diet: 'Vegetarian, frequent heavy curd intake at night',
          sleep: 'Disturbed due to joint discomfort',
          bowelBladder: 'Constipated, irregular (Krura Koshtha)',
          addictions: 'None',
          occupation: 'Accountant'
        },
        reviewOfSystems: {
          musculoskeletal: 'Swelling and tenderness in MCP and knee joints',
          gastrointestinal: 'Mandagni (low digestive fire), coated tongue'
        },
        dashavidhaPariksha: {
          prakriti: 'Vata-Kapha',
          vikriti: 'Tridoshaja with Ama predominance',
          sara: 'Madhyama Twak Sara',
          samhanana: 'Madhyama',
          pramana: '68 kg, 172 cm',
          satmya: 'Madhura-Katu Rasa Satmya',
          sattva: 'Madhyama Sattva',
          aharaShakti: 'Avara Jarana Shakti (poor digestion)',
          vyayamaShakti: 'Avara (restricted by joint pain)',
          vaya: 'Madhyama (42 years)'
        }
      },
      redFlags: [],
      physicianEdits: [
        {
          who: physician._id,
          when: new Date(),
          field: 'history.dashavidhaPariksha.vikriti',
          old: 'Vata-Kapha',
          new: 'Tridoshaja with Ama predominance'
        }
      ]
    });

    expect(ayushCase.mode).toBe('ayush');
    expect(ayushCase.history.dashavidhaPariksha.prakriti).toBe('Vata-Kapha');
    expect(ayushCase.physicianEdits).toHaveLength(1);
  });

  test('MedicalDocument and PhysicianAssignment (M:N) validate and persist accurately', async () => {
    const patient = await Patient.findOne({});
    const physician = await User.findOne({ role: 'physician' });

    const doc = await MedicalDocument.create({
      patientId: patient._id,
      docType: 'labReport',
      docDate: new Date(),
      extracted: {
        diagnoses: ['Amavata', 'Dyslipidemia'],
        medications: [{ name: 'Simhanada Guggulu', dose: '500mg BID' }],
        investigations: [
          { name: 'ESR', value: 48, unit: 'mm/hr', refRange: '0-20', abnormal: true },
          { name: 'Hemoglobin', value: 13.8, unit: 'g/dL', refRange: '13.0-17.0', abnormal: false }
        ]
      },
      rawText: 'AIIA Clinical Pathology Report: ESR elevated at 48 mm/hr.'
    });
    expect(doc.extracted.investigations).toHaveLength(2);

    const assignment = await PhysicianAssignment.create({
      physicianId: physician._id,
      patientId: patient._id,
      department: 'Kayachikitsa',
      assignmentRole: 'primary'
    });
    expect(assignment.department).toBe('Kayachikitsa');
  });
});

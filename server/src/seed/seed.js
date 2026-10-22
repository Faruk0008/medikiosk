const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const PhysicianAssignment = require('../models/PhysicianAssignment');
const { evaluateCaseRedFlags, evaluateLabInvestigations } = require('../services/redFlag');

const FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Ananya', 'Diya', 'Aditi', 'Isha', 'Kavya', 'Meera', 'Priya', 'Riya', 'Saanvi', 'Neha',
  'Rohan', 'Vikram', 'Suresh', 'Ramesh', 'Kiran', 'Sunita', 'Rekha', 'Pooja', 'Nitin', 'Deepak'
];
const LAST_NAMES = [
  'Sharma', 'Verma', 'Nair', 'Patel', 'Reddy', 'Iyer', 'Gupta', 'Singh', 'Joshi', 'Kulkarni',
  'Desai', 'Chatterjee', 'Banerjee', 'Mehta', 'Malhotra', 'Bhatia', 'Kaur', 'Gill', 'Rao', 'Menon'
];
const CITIES = [
  'Sarita Vihar, New Delhi', 'Sector 17, Chandigarh', 'Kochi, Kerala', 'Shivajinagar, Pune',
  'Indiranagar, Bengaluru', 'Salt Lake, Kolkata', 'Banjara Hills, Hyderabad', 'Adyar, Chennai',
  'Navrangpura, Ahmedabad', 'Civil Lines, Jaipur', 'Gomti Nagar, Lucknow', 'Model Town, Ludhiana'
];
const LANGUAGES = ['en', 'hi', 'sa', 'ta', 'te', 'bn', 'mr', 'gu'];

const COMPLAINTS_TEMPLATES = [
  {
    mode: 'allopathic',
    chiefComplaint: 'Severe retrosternal chest pain with dyspnoea',
    hpi: { site: 'Central chest', onset: 'Sudden 2 hours ago', character: 'Crushing pressure', radiation: 'Left arm and jaw', associations: 'Shortness of breath and sweating', severity: 9 },
    past: ['Hypertension', 'Type 2 Diabetes Mellitus']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'Sudden onset facial droop and slurred speech',
    hpi: { site: 'Right face and upper limb', onset: 'Acute 45 mins ago', character: 'Focal neurological weakness', radiation: 'None', associations: 'Limb weakness and dysarthria', severity: 9 },
    past: ['Atrial Fibrillation', 'Hypertension']
  },
  {
    mode: 'ayush',
    chiefComplaint: 'Amavata (Chronic polyarticular joint pain and morning stiffness)',
    hpi: { site: 'Bilateral knee and wrist joints', onset: 'Gradual over 4 months', character: 'Vrischika Damsha Vat Vedana (Scorpion-sting like ache)', radiation: 'None', associations: 'Morning stiffness and Mandagni', severity: 6 },
    dashavidha: { prakriti: 'Vata-Kapha', vikriti: 'Tridoshaja with Ama', sara: 'Madhyama', samhanana: 'Madhyama', pramana: '66 kg / 168 cm', satmya: 'Sarvarasa', sattva: 'Madhyama', aharaShakti: 'Avara', vyayamaShakti: 'Avara', vaya: 'Madhyama' },
    past: ['Seasonal allergic rhinitis']
  },
  {
    mode: 'ayush',
    chiefComplaint: 'Amlapitta (Hyperacidity, epigastric burning and sour belching)',
    hpi: { site: 'Epigastrium (Urdhwaga Amlapitta)', onset: '2 weeks', character: 'Burning sensation (Daha)', radiation: 'Retrosternal', associations: 'Tikta-Amla Udgara (sour eructation)', severity: 5 },
    dashavidha: { prakriti: 'Pitta-Vata', vikriti: 'Pitta Vriddhi', sara: 'Twak Sara', samhanana: 'Madhyama', pramana: '62 kg / 165 cm', satmya: 'Madhura Satmya', sattva: 'Pravara', aharaShakti: 'Madhyama', vyayamaShakti: 'Madhyama', vaya: 'Madhyama' },
    past: ['Gastritis']
  },
  {
    mode: 'ayush',
    chiefComplaint: 'Tamaka Shwasa (Bronchial asthma with nocturnal wheezing and dyspnoea)',
    hpi: { site: 'Pranavaha Srotas (Chest/Airways)', onset: 'Acute exacerbation since last night', character: 'Wheezing and chest tightness', radiation: 'None', associations: 'Shortness of breath, relief after expectoration', severity: 8 },
    dashavidha: { prakriti: 'Kapha-Vata', vikriti: 'Kapha-Vata Prakopa', sara: 'Madhyama', samhanana: 'Madhyama', pramana: '70 kg / 170 cm', satmya: 'Ushna Satmya', sattva: 'Madhyama', aharaShakti: 'Madhyama', vyayamaShakti: 'Avara', vaya: 'Madhyama' },
    past: ['Childhood asthma']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'High fever with neck stiffness and altered sensorium',
    hpi: { site: 'Systemic / CNS', onset: '3 days', character: 'High grade continuous fever', radiation: 'Occipital headache', associations: 'Neck stiffness, photophobia and confusion', severity: 9 },
    past: ['None']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'Episodes of vomiting blood (hematemesis) and melena',
    hpi: { site: 'Upper GI tract', onset: 'Since morning', character: 'Coffee-ground emesis with severe bleeding', radiation: 'Epigastric', associations: 'Dizziness and postural lightheadedness', severity: 9 },
    past: ['Peptic Ulcer Disease', 'NSAID overuse']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'Acute tongue swelling and stridor after antibiotic dose',
    hpi: { site: 'Oropharynx and airway', onset: '15 minutes after medication', character: 'Rapidly progressive angioedema', radiation: 'Throat', associations: 'Hives with breathing difficulty and anaphylaxis signs', severity: 10 },
    past: ['Penicillin allergy']
  },
  {
    mode: 'ayush',
    chiefComplaint: 'Gridhrasi (Sciatica — lower back pain radiating to right leg)',
    hpi: { site: 'Lumbar spine (Kati Pradesha)', onset: '3 weeks', character: 'Shooting lancinating pain', radiation: 'Right posterior thigh and calf', associations: 'Stambha (stiffness) and tingling', severity: 7 },
    dashavidha: { prakriti: 'Vataja', vikriti: 'Vata Prakopa', sara: 'Asthi Sara', samhanana: 'Madhyama', pramana: '74 kg / 175 cm', satmya: 'Snigdha Satmya', sattva: 'Madhyama', aharaShakti: 'Madhyama', vyayamaShakti: 'Madhyama', vaya: 'Vriddha' },
    past: ['Lumbar spondylosis']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'Uncontrolled Type 2 Diabetes with polyuria and fatigue',
    hpi: { site: 'Endocrine / Systemic', onset: '2 months', character: 'Generalized weakness', radiation: 'None', associations: 'Polydipsia, polyuria, blurred vision', severity: 4 },
    past: ['Type 2 Diabetes Mellitus (5 years)', 'Dyslipidemia']
  },
  {
    mode: 'ayush',
    chiefComplaint: 'Prameha (Metabolic syndrome with increased turbidity of urine)',
    hpi: { site: 'Mutravaha Srotas', onset: '6 months', character: 'Prabhuta Avila Mutrata', radiation: 'None', associations: 'Kara-Pada Daha (burning palms/soles)', severity: 5 },
    dashavidha: { prakriti: 'Kapha-Pitta', vikriti: 'Bahudrava Shleshma', sara: 'Meda Sara', samhanana: 'Sthula', pramana: '84 kg / 169 cm', satmya: 'Madhura', sattva: 'Madhyama', aharaShakti: 'Pravara', vyayamaShakti: 'Avara', vaya: 'Madhyama' },
    past: ['Obesity']
  },
  {
    mode: 'allopathic',
    chiefComplaint: 'Migraine headache with visual aura and nausea',
    hpi: { site: 'Unilateral frontotemporal', onset: '12 hours', character: 'Pulsating throbbing headache', radiation: 'Retro-orbital', associations: 'Photophobia and nausea', severity: 6 },
    past: ['Episodic migraine']
  }
];

const LAB_TEMPLATES = [
  {
    docType: 'labReport',
    diagnoses: ['Type 2 Diabetes Mellitus', 'Diabetic Nephropathy'],
    medications: [{ name: 'Metformin', dose: '500mg BID' }, { name: 'Nishamalaki Churna', dose: '3g BID' }],
    investigations: [
      { name: 'Fasting Blood Sugar', value: 186, unit: 'mg/dL', refRange: '70-100', abnormal: true },
      { name: 'HbA1c', value: 8.6, unit: '%', refRange: '4.0-5.6', abnormal: true },
      { name: 'Creatinine', value: 1.5, unit: 'mg/dL', refRange: '0.6-1.2', abnormal: true }
    ],
    rawText: 'AIIA Integrative Metabolic Panel: Elevated Fasting Glucose (186 mg/dL) and HbA1c (8.6%).'
  },
  {
    docType: 'labReport',
    diagnoses: ['Amavata', 'Iron Deficiency Anemia'],
    medications: [{ name: 'Simhanada Guggulu', dose: '500mg TID' }, { name: 'Punarnavadi Mandura', dose: '250mg BID' }],
    investigations: [
      { name: 'ESR', value: 54, unit: 'mm/hr', refRange: '0-20', abnormal: true },
      { name: 'Hemoglobin', value: 9.4, unit: 'g/dL', refRange: '12.0-17.5', abnormal: true },
      { name: 'WBC', value: 7800, unit: '/mcL', refRange: '4000-11000', abnormal: false }
    ],
    rawText: 'Inflammatory markers elevated (ESR 54 mm/hr) with moderate microcytic anemia (Hb 9.4 g/dL).'
  },
  {
    docType: 'labReport',
    diagnoses: ['Suspected Acute Coronary Syndrome', 'Hyperkalemia'],
    medications: [{ name: 'Aspirin', dose: '150mg STAT' }, { name: 'Atorvastatin', dose: '40mg HS' }],
    investigations: [
      { name: 'Troponin-I', value: 0.62, unit: 'ng/mL', refRange: '0-0.04', abnormal: true },
      { name: 'Potassium', value: 5.8, unit: 'mEq/L', refRange: '3.5-5.1', abnormal: true },
      { name: 'Sodium', value: 139, unit: 'mEq/L', refRange: '135-145', abnormal: false }
    ],
    rawText: 'Emergency Cardiac Biomarker Panel: Troponin-I elevated at 0.62 ng/mL; Potassium 5.8 mEq/L.'
  },
  {
    docType: 'prescription',
    diagnoses: ['Amlapitta', 'Acid Peptic Disease'],
    medications: [{ name: 'Avipattikar Churna', dose: '5g HS with warm water' }, { name: 'Kamdudha Ras', dose: '250mg BID' }],
    investigations: [
      { name: 'Hemoglobin', value: 13.6, unit: 'g/dL', refRange: '12.0-17.5', abnormal: false }
    ],
    rawText: 'OPD Prescription - Kayachikitsa Unit II: Pathya Ahara advised, avoid spicy/fermented foods.'
  },
  {
    docType: 'dischargeSummary',
    diagnoses: ['Tamaka Shwasa', 'Acute Exacerbation of Bronchial Asthma'],
    medications: [{ name: 'Vasa Avaleha', dose: '10g BID' }, { name: 'Sitopaladi Churna', dose: '3g TID with honey' }],
    investigations: [
      { name: 'WBC', value: 13400, unit: '/mcL', refRange: '4000-11000', abnormal: true },
      { name: 'ESR', value: 32, unit: 'mm/hr', refRange: '0-20', abnormal: true },
      { name: 'Platelets', value: 260000, unit: '/mcL', refRange: '150000-450000', abnormal: false }
    ],
    rawText: 'Inpatient Ward Discharge Summary: Stabilized following Nebulization and Snehana-Swedana protocol.'
  }
];

function parseArgs() {
  const args = process.argv.slice(2);
  let patientCount = 500;
  let caseCount = 5000;
  let docCount = 3000;
  let isBulk = false;

  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    patientCount = parseInt(args[countIdx + 1], 10);
    caseCount = patientCount * 10;
    docCount = patientCount * 6;
  }

  const bulkIdx = args.indexOf('--bulk');
  if (bulkIdx !== -1) {
    isBulk = true;
    const val = parseInt(args[bulkIdx + 1] || '100000', 10);
    caseCount = Number.isNaN(val) ? 100000 : val;
  }

  return { patientCount, caseCount, docCount, isBulk };
}

async function runSeed(customOpts = null) {
  const { patientCount, caseCount, docCount, isBulk } = customOpts || parseArgs();
  const t0 = Date.now();
  console.log(`[Seed] Starting idempotent seed: ${patientCount} patients, ${caseCount} cases, ${docCount} documents...`);

  await connectDB();
  await mongoose.connection.dropDatabase();

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Demo Accounts (Patient, Physician, Triage)
  const demoUsers = await User.insertMany([
    {
      name: 'Aarav Sharma (Demo Patient)',
      email: 'patient@medikiosk.in',
      passwordHash,
      role: 'patient',
      language: 'en',
      abhaId: '14-2233-4455-6677'
    },
    {
      name: 'Dr. Charaka Vaidya (Demo Physician)',
      email: 'physician@medikiosk.in',
      passwordHash,
      role: 'physician',
      language: 'en'
    },
    {
      name: 'Sister Anjali Verma (Demo Triage)',
      email: 'triage@medikiosk.in',
      passwordHash,
      role: 'triage',
      language: 'en'
    }
  ]);

  const demoPatientUser = demoUsers[0];
  const demoPhysicianUser = demoUsers[1];

  const demoPatient = await Patient.create({
    userId: demoPatientUser._id,
    demographics: {
      age: 54,
      sex: 'male',
      address: 'Sarita Vihar, New Delhi',
      phone: '+91-9810012345',
      bloodGroup: 'B+'
    },
    consent: { dataCapture: true, sharing: true, updatedAt: new Date() },
    consentHistory: [
      { dataCapture: true, sharing: true, actorRole: 'patient', note: 'Enabled ABHA & AIIA clinical sharing', timestamp: new Date() },
      { dataCapture: true, sharing: false, actorRole: 'patient', note: 'Initial kiosk registration consent', timestamp: new Date(Date.now() - 86400000 * 30) }
    ],
    revocable: true
  });

  // 2. Create remaining (patientCount - 1) Patients and Users
  const bulkUsers = [];
  for (let i = 1; i < patientCount; i++) {
    const fn = FIRST_NAMES[i % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const p1 = String(10 + (i % 89)).padStart(2, '0');
    const p2 = String(1000 + i).padStart(4, '0');
    const p3 = String(2000 + i).padStart(4, '0');
    const p4 = String(3000 + i).padStart(4, '0');
    bulkUsers.push({
      name: `${fn} ${ln}`,
      email: `patient${i}@medikiosk.in`,
      passwordHash,
      role: 'patient',
      language: LANGUAGES[i % LANGUAGES.length],
      abhaId: `${p1}-${p2}-${p3}-${p4}`
    });
  }

  const insertedUsers = await User.insertMany(bulkUsers);

  const sexes = ['male', 'female', 'other'];
  const bulkPatients = insertedUsers.map((u, idx) => ({
    userId: u._id,
    demographics: {
      age: 18 + ((idx * 7) % 72),
      sex: sexes[idx % 2 === 0 ? 0 : (idx % 15 === 0 ? 2 : 1)],
      address: CITIES[idx % CITIES.length],
      phone: `+91-98${String(10000000 + idx).slice(0, 8)}`,
      bloodGroup: ['A+', 'B+', 'O+', 'AB+', 'O-'][idx % 5]
    },
    consent: {
      dataCapture: true,
      sharing: idx % 10 !== 0,
      updatedAt: new Date()
    },
    revocable: true
  }));

  const insertedPatients = await Patient.insertMany(bulkPatients);
  const allPatients = [demoPatient, ...insertedPatients];

  // Create M:N PhysicianAssignments for first 50 patients
  const assignments = allPatients.slice(0, Math.min(50, allPatients.length)).map((p, idx) => ({
    physicianId: demoPhysicianUser._id,
    patientId: p._id,
    department: idx % 2 === 0 ? 'Kayachikitsa' : 'General Medicine',
    assignmentRole: idx % 5 === 0 ? 'consulting' : 'primary',
    active: true,
    assignedAt: new Date()
  }));
  await PhysicianAssignment.insertMany(assignments);

  // 3. Create 3,000 MedicalDocuments
  const bulkDocs = [];
  const nowMs = Date.now();
  for (let i = 0; i < docCount; i++) {
    const pat = allPatients[i % allPatients.length];
    const tpl = LAB_TEMPLATES[i % LAB_TEMPLATES.length];
    const daysAgo = i % 180;
    bulkDocs.push({
      patientId: pat._id,
      docType: tpl.docType,
      docDate: new Date(nowMs - daysAgo * 86400000 - (i % 3600) * 1000),
      extracted: tpl.extracted || {
        diagnoses: tpl.diagnoses,
        medications: tpl.medications,
        investigations: tpl.investigations
      },
      rawText: tpl.rawText
    });
  }
  await MedicalDocument.insertMany(bulkDocs, { bypassDocumentValidation: isBulk });

  // 4. Pre-evaluate red flags for templates so bulk generation of 5,000 or 100,000 cases is fast and deterministic
  const preEvaluatedTemplates = COMPLAINTS_TEMPLATES.map(tpl => {
    const history = {
      chiefComplaint: tpl.chiefComplaint,
      hpi: tpl.hpi,
      pastMedicalSurgical: tpl.past,
      drugAllergy: ['None'],
      family: ['No significant familial disorder'],
      personal: {
        diet: tpl.mode === 'ayush' ? 'Sattvika vegetarian diet' : 'Mixed balanced diet',
        sleep: '6-7 hours/night',
        bowelBladder: 'Regular',
        addictions: 'None',
        occupation: 'Service / Professional'
      },
      reviewOfSystems: {
        cardiovascular: tpl.chiefComplaint.includes('chest') ? 'Precordial discomfort' : 'Normal',
        respiratory: tpl.chiefComplaint.includes('dyspnoea') || tpl.chiefComplaint.includes('Shwasa') ? 'Tachypnea / wheeze' : 'Normal',
        gastrointestinal: 'Normal',
        neurological: tpl.chiefComplaint.includes('facial') ? 'Right hemiparesis' : 'Normal',
        musculoskeletal: tpl.chiefComplaint.includes('Amavata') ? 'Joint tenderness' : 'Normal',
        general: 'Alert'
      },
      dashavidhaPariksha: tpl.dashavidha || {
        prakriti: '', vikriti: '', sara: '', samhanana: '', pramana: '',
        satmya: '', sattva: '', aharaShakti: '', vyayamaShakti: '', vaya: ''
      }
    };
    const evalResult = evaluateCaseRedFlags({ history });
    return {
      mode: tpl.mode,
      history,
      redFlags: evalResult.redFlags,
      priority: evalResult.priority
    };
  });

  const statuses = ['submitted', 'submitted', 'reviewed', 'draft'];
  const bulkCases = [];
  for (let i = 0; i < caseCount; i++) {
    const pat = allPatients[i % allPatients.length];
    const tpl = preEvaluatedTemplates[i % preEvaluatedTemplates.length];
    const status = statuses[i % statuses.length];
    const daysAgo = i % 180;
    const createdAt = new Date(nowMs - daysAgo * 86400000 - (i % 7200) * 1000);

    bulkCases.push({
      patientId: pat._id,
      mode: tpl.mode,
      status,
      priority: status === 'draft' ? 10 : tpl.priority,
      createdAt,
      history: tpl.history,
      redFlags: status === 'draft' ? [] : tpl.redFlags,
      physicianEdits: status === 'reviewed'
        ? [
            {
              who: demoPhysicianUser._id,
              when: new Date(createdAt.getTime() + 1800000),
              field: 'history.hpi.timeCourse',
              old: '',
              new: 'Reviewed and confirmed by attending consultant'
            }
          ]
        : []
    });
  }

  await CaseRecord.insertMany(bulkCases, { bypassDocumentValidation: isBulk, validateBeforeSave: !isBulk });

  // Save snapshot for local dev/start server persistence when not running in 100k bulk mode
  if (!isBulk && typeof mongoose.saveSnapshot === 'function') {
    mongoose.saveSnapshot();
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
  console.log(`[Seed] Completed in ${elapsed}s!`);
  console.log(`  - Users:                ${await User.countDocuments()}`);
  console.log(`  - Patients:             ${await Patient.countDocuments()}`);
  console.log(`  - CaseRecords:          ${await CaseRecord.countDocuments()}`);
  console.log(`  - MedicalDocuments:     ${await MedicalDocument.countDocuments()}`);
  console.log(`  - PhysicianAssignments: ${await PhysicianAssignment.countDocuments()}`);
  console.log('  - Demo Accounts (password: password123):');
  console.log('      Patient:   patient@medikiosk.in');
  console.log('      Physician: physician@medikiosk.in');
  console.log('      Triage:    triage@medikiosk.in');
}

if (require.main === module) {
  runSeed()
    .then(() => disconnectDB())
    .catch(err => {
      console.error('[Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = { runSeed };

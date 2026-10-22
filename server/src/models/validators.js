const userJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'role', 'email', 'passwordHash'],
    properties: {
      name: { bsonType: 'string', minLength: 1 },
      role: { bsonType: 'string', enum: ['patient', 'physician', 'triage'] },
      email: { bsonType: 'string', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
      passwordHash: { bsonType: 'string', minLength: 10 },
      language: { bsonType: 'string', enum: ['en', 'hi', 'sa', 'ta', 'te', 'bn', 'mr', 'gu'] },
      abhaId: { bsonType: 'string', pattern: '^\\d{2}-\\d{4}-\\d{4}-\\d{4}$' }
    }
  }
};

const patientJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'demographics', 'consent', 'revocable'],
    properties: {
      userId: { bsonType: 'objectId' },
      demographics: {
        bsonType: 'object',
        required: ['age', 'sex', 'address'],
        properties: {
          age: { bsonType: ['int', 'double', 'number'], minimum: 0, maximum: 130 },
          sex: { bsonType: 'string', enum: ['male', 'female', 'other'] },
          address: { bsonType: 'string', minLength: 1 }
        }
      },
      consent: {
        bsonType: 'object',
        required: ['dataCapture', 'sharing', 'updatedAt'],
        properties: {
          dataCapture: { bsonType: 'bool' },
          sharing: { bsonType: 'bool' },
          updatedAt: { bsonType: 'date' }
        }
      },
      revocable: { bsonType: 'bool' }
    }
  }
};

const caseRecordJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['patientId', 'mode', 'status', 'priority', 'createdAt', 'history'],
    properties: {
      patientId: { bsonType: 'objectId' },
      mode: { bsonType: 'string', enum: ['allopathic', 'ayush'] },
      status: { bsonType: 'string', enum: ['draft', 'submitted', 'reviewed'] },
      priority: { bsonType: ['int', 'double', 'number'], minimum: 0, maximum: 100 },
      createdAt: { bsonType: 'date' },
      history: {
        bsonType: 'object',
        required: ['chiefComplaint'],
        properties: {
          chiefComplaint: { bsonType: 'string', minLength: 2 },
          hpi: {
            bsonType: 'object',
            properties: {
              site: { bsonType: 'string' },
              onset: { bsonType: 'string' },
              character: { bsonType: 'string' },
              radiation: { bsonType: 'string' },
              associations: { bsonType: 'string' },
              timeCourse: { bsonType: 'string' },
              exacerbatingRelieving: { bsonType: 'string' },
              severity: { bsonType: ['int', 'double', 'number'], minimum: 1, maximum: 10 }
            }
          },
          pastMedicalSurgical: { bsonType: 'array', items: { bsonType: 'string' } },
          drugAllergy: { bsonType: 'array', items: { bsonType: 'string' } },
          family: { bsonType: 'array', items: { bsonType: 'string' } },
          personal: { bsonType: 'object' },
          reviewOfSystems: { bsonType: 'object' },
          dashavidhaPariksha: { bsonType: 'object' }
        }
      },
      redFlags: { bsonType: 'array' },
      physicianEdits: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['who', 'when', 'field'],
          properties: {
            who: { bsonType: 'objectId' },
            when: { bsonType: 'date' },
            field: { bsonType: 'string' }
          }
        }
      }
    }
  }
};

const medicalDocumentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['patientId', 'docType', 'docDate', 'extracted'],
    properties: {
      patientId: { bsonType: 'objectId' },
      docType: { bsonType: 'string', enum: ['prescription', 'labReport', 'dischargeSummary'] },
      docDate: { bsonType: 'date' },
      extracted: {
        bsonType: 'object',
        properties: {
          diagnoses: { bsonType: 'array', items: { bsonType: 'string' } },
          medications: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['name', 'dose'],
              properties: { name: { bsonType: 'string' }, dose: { bsonType: 'string' } }
            }
          },
          investigations: {
            bsonType: 'array',
            items: {
              bsonType: 'object',
              required: ['name', 'value', 'unit', 'refRange'],
              properties: {
                name: { bsonType: 'string' },
                value: { bsonType: ['int', 'double', 'number'] },
                unit: { bsonType: 'string' },
                refRange: { bsonType: 'string' },
                abnormal: { bsonType: 'bool' }
              }
            }
          }
        }
      },
      rawText: { bsonType: 'string' }
    }
  }
};

const physicianAssignmentJsonSchema = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['physicianId', 'patientId', 'department'],
    properties: {
      physicianId: { bsonType: 'objectId' },
      patientId: { bsonType: 'objectId' },
      department: { bsonType: 'string' },
      assignmentRole: { bsonType: 'string', enum: ['primary', 'consulting', 'triage_escalation'] },
      active: { bsonType: 'bool' }
    }
  }
};

const VALIDATOR_MAP = {
  users: userJsonSchema,
  patients: patientJsonSchema,
  caserecords: caseRecordJsonSchema,
  medicaldocuments: medicalDocumentJsonSchema,
  physicianassignments: physicianAssignmentJsonSchema
};

async function applyCollectionValidators(db) {
  if (!db) return;
  for (const [collectionName, validator] of Object.entries(VALIDATOR_MAP)) {
    const existing = await db.listCollections({ name: collectionName }).toArray();
    if (existing.length === 0) {
      await db.createCollection(collectionName, { validator, validationLevel: 'strict', validationAction: 'error' });
    } else {
      await db.command({ collMod: collectionName, validator, validationLevel: 'strict', validationAction: 'error' });
    }
  }
}

module.exports = {
  userJsonSchema,
  patientJsonSchema,
  caseRecordJsonSchema,
  medicalDocumentJsonSchema,
  physicianAssignmentJsonSchema,
  VALIDATOR_MAP,
  applyCollectionValidators
};

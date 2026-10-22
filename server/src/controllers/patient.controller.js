const { z } = require('zod');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const PhysicianAssignment = require('../models/PhysicianAssignment');

const createPatientSchema = z.object({
  userId: z.string().optional(),
  demographics: z.object({
    age: z.number().min(0).max(130),
    sex: z.enum(['male', 'female', 'other']),
    address: z.string().min(1),
    phone: z.string().optional(),
    bloodGroup: z.string().optional()
  }),
  consent: z.object({
    dataCapture: z.boolean().default(true),
    sharing: z.boolean().default(false)
  }).optional(),
  revocable: z.boolean().optional().default(true)
}).passthrough();

const updateConsentSchema = z.object({
  dataCapture: z.boolean(),
  sharing: z.boolean(),
  revocable: z.boolean().optional(),
  note: z.string().optional()
});

function canAccessPatient(reqUser, patientDoc) {
  if (!reqUser || !patientDoc) return false;
  if (reqUser.role === 'physician' || reqUser.role === 'triage') return true;
  const uid = patientDoc.userId?._id ? patientDoc.userId._id.toString() : patientDoc.userId.toString();
  return uid === reqUser.id;
}

async function createPatient(req, res, next) {
  try {
    const data = createPatientSchema.parse(req.body);
    const targetUserId = req.user.role === 'patient' ? req.user.id : (data.userId || req.user.id);

    const existing = await Patient.findOne({ userId: targetUserId });
    if (existing) {
      return res.status(409).json({ error: 'Patient profile already exists for this user', patient: existing });
    }

    const now = new Date();
    const dataCapture = data.consent ? data.consent.dataCapture : true;
    const sharing = data.consent ? data.consent.sharing : false;

    const patient = await Patient.create({
      userId: targetUserId,
      demographics: data.demographics,
      consent: { dataCapture, sharing, updatedAt: now },
      consentHistory: [
        {
          dataCapture,
          sharing,
          actorRole: req.user.role,
          note: 'Initial profile consent recorded',
          timestamp: now
        }
      ],
      revocable: data.revocable !== undefined ? data.revocable : true
    });

    return res.status(201).json(patient);
  } catch (err) {
    next(err);
  }
}

async function listPatients(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = req.user.role === 'patient' ? { userId: req.user._id } : {};
    const [data, total] = await Promise.all([
      Patient.find(filter).populate('userId', 'name email language abhaId').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Patient.countDocuments(filter)
    ]);

    return res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (err) {
    next(err);
  }
}

async function getPatientById(req, res, next) {
  try {
    const patient = await Patient.findById(req.params.id).populate('userId', 'name email language abhaId');
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!canAccessPatient(req.user, patient)) {
      return res.status(403).json({ error: 'Forbidden: Patients can only access their own profile' });
    }
    return res.status(200).json(patient);
  } catch (err) {
    next(err);
  }
}

async function updatePatient(req, res, next) {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!canAccessPatient(req.user, patient)) {
      return res.status(403).json({ error: 'Forbidden: Patients can only update their own profile' });
    }

    const updates = {};
    if (req.body.demographics) {
      updates.demographics = { ...patient.demographics, ...req.body.demographics };
    }
    if (req.body.revocable !== undefined) {
      updates.revocable = Boolean(req.body.revocable);
    }

    const updated = await Patient.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function updateConsent(req, res, next) {
  try {
    const parsed = updateConsentSchema.parse(req.body);
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!canAccessPatient(req.user, patient)) {
      return res.status(403).json({ error: 'Forbidden: Only the patient or authorized staff can update consent' });
    }

    const now = new Date();
    const rawPatient = patient.toObject();
    const existingHistory = Array.isArray(rawPatient.consentHistory) ? rawPatient.consentHistory : [];
    const newEntry = {
      dataCapture: parsed.dataCapture,
      sharing: parsed.sharing,
      actorRole: req.user.role,
      note: parsed.note || `Updated dataCapture=${parsed.dataCapture ? 'Enabled' : 'Revoked'}, sharing=${parsed.sharing ? 'Enabled' : 'Disabled'}`,
      timestamp: now
    };

    const setPayload = {
      consent: {
        dataCapture: parsed.dataCapture,
        sharing: parsed.sharing,
        updatedAt: now
      },
      consentHistory: [newEntry, ...existingHistory]
    };
    if (parsed.revocable !== undefined) {
      setPayload.revocable = parsed.revocable;
    }

    const updated = await Patient.findByIdAndUpdate(
      req.params.id,
      { $set: setPayload },
      { new: true, runValidators: true }
    );
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function getConsentHistory(req, res, next) {
  try {
    const patientId = req.params.patientId || req.params.id;
    const patient = await Patient.findById(patientId).lean();
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!canAccessPatient(req.user, patient)) {
      return res.status(403).json({ error: 'Forbidden: Cannot view another patient consent history' });
    }

    const history = Array.isArray(patient.consentHistory) && patient.consentHistory.length > 0
      ? [...patient.consentHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      : [
          {
            dataCapture: patient.consent?.dataCapture ?? true,
            sharing: patient.consent?.sharing ?? false,
            actorRole: 'patient',
            note: 'Initial consent state recorded at registration',
            timestamp: patient.consent?.updatedAt || patient.createdAt || new Date()
          }
        ];

    return res.status(200).json({
      patientId: patient._id,
      currentConsent: patient.consent,
      revocable: patient.revocable,
      history
    });
  } catch (err) {
    next(err);
  }
}

async function deletePatient(req, res, next) {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (!canAccessPatient(req.user, patient)) {
      return res.status(403).json({ error: 'Forbidden: Cannot delete another patient record' });
    }

    const [casesDeleted, docsDeleted, assignmentsDeleted] = await Promise.all([
      CaseRecord.deleteMany({ patientId: patient._id }),
      MedicalDocument.deleteMany({ patientId: patient._id }),
      PhysicianAssignment.deleteMany({ patientId: patient._id })
    ]);

    await Patient.findByIdAndDelete(patient._id);

    return res.status(200).json({
      message: 'Patient and associated clinical records deleted via cascade',
      cascaded: {
        casesDeleted: casesDeleted.deletedCount,
        documentsDeleted: docsDeleted.deletedCount,
        assignmentsDeleted: assignmentsDeleted.deletedCount
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPatient,
  listPatients,
  getPatientById,
  updatePatient,
  updateConsent,
  getConsentHistory,
  deletePatient
};

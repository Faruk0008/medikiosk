const { z } = require('zod');
const MedicalDocument = require('../models/MedicalDocument');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const { evaluateLabInvestigations } = require('../services/redFlag');

const createDocumentSchema = z.object({
  patientId: z.string().min(1),
  docType: z.enum(['prescription', 'labReport', 'dischargeSummary']),
  docDate: z.coerce.date().optional(),
  extracted: z.object({
    diagnoses: z.array(z.string()).optional().default([]),
    medications: z.array(z.object({ name: z.string().min(1), dose: z.string().min(1) })).optional().default([]),
    investigations: z.array(
      z.object({
        name: z.string().min(1),
        value: z.number(),
        unit: z.string().min(1),
        refRange: z.string().min(1),
        abnormal: z.boolean().optional()
      })
    ).optional().default([])
  }).optional().default({ diagnoses: [], medications: [], investigations: [] }),
  rawText: z.string().optional().default('')
});

async function resolvePatientForUser(reqUser) {
  if (reqUser.role !== 'patient') return null;
  return Patient.findOne({ userId: reqUser._id }).lean();
}

async function createDocument(req, res, next) {
  try {
    const data = createDocumentSchema.parse(req.body);
    const patient = await Patient.findById(data.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (req.user.role === 'patient' && patient.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Patients can only upload documents for themselves' });
    }

    const labEval = evaluateLabInvestigations(data.extracted.investigations || []);
    const cleanInvestigations = labEval.investigations.map(inv => ({
      name: inv.name,
      value: inv.value,
      unit: inv.unit,
      refRange: inv.refRange,
      abnormal: inv.abnormal
    }));

    const doc = await MedicalDocument.create({
      patientId: patient._id,
      docType: data.docType,
      docDate: data.docDate || new Date(),
      extracted: {
        diagnoses: data.extracted.diagnoses || [],
        medications: data.extracted.medications || [],
        investigations: cleanInvestigations
      },
      rawText: data.rawText || ''
    });

    return res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
}

async function listDocuments(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient) {
        return res.status(200).json({ data: [], pagination: { page, limit, total: 0, totalPages: 1 } });
      }
      filter.patientId = ownPatient._id;
    } else if (req.query.patientId) {
      filter.patientId = req.query.patientId;
    }

    if (req.query.docType) filter.docType = req.query.docType;

    const [data, total] = await Promise.all([
      MedicalDocument.find(filter).sort({ docDate: -1 }).skip(skip).limit(limit).lean(),
      MedicalDocument.countDocuments(filter)
    ]);

    return res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (err) {
    next(err);
  }
}

async function getDocumentById(req, res, next) {
  try {
    const doc = await MedicalDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'MedicalDocument not found' });
    }
    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== doc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Patients can only view their own documents' });
      }
    }
    return res.status(200).json(doc);
  } catch (err) {
    next(err);
  }
}

async function updateDocument(req, res, next) {
  try {
    const doc = await MedicalDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'MedicalDocument not found' });
    }
    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== doc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Patients can only update their own documents' });
      }
    }

    const updates = {};
    if (req.body.docType) updates.docType = req.body.docType;
    if (req.body.docDate) updates.docDate = new Date(req.body.docDate);
    if (req.body.rawText !== undefined) updates.rawText = req.body.rawText;
    if (req.body.extracted) {
      const invs = req.body.extracted.investigations || doc.extracted.investigations || [];
      const labEval = evaluateLabInvestigations(invs);
      updates.extracted = {
        diagnoses: req.body.extracted.diagnoses || doc.extracted.diagnoses,
        medications: req.body.extracted.medications || doc.extracted.medications,
        investigations: labEval.investigations.map(inv => ({
          name: inv.name,
          value: inv.value,
          unit: inv.unit,
          refRange: inv.refRange,
          abnormal: inv.abnormal
        }))
      };
    }

    const updated = await MedicalDocument.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function deleteDocument(req, res, next) {
  try {
    const doc = await MedicalDocument.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'MedicalDocument not found' });
    }
    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== doc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Patients can only delete their own documents' });
      }
    }
    await MedicalDocument.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'MedicalDocument deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function getPatientDocumentTimeline(req, res, next) {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (req.user.role === 'patient' && patient.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Patients can only view their own timeline' });
    }

    const [documents, cases] = await Promise.all([
      MedicalDocument.find({ patientId: patient._id }).sort({ docDate: -1 }).lean(),
      CaseRecord.find({
        patientId: patient._id,
        ...(req.user.role === 'physician' ? { status: { $in: ['submitted', 'reviewed'] } } : {})
      })
        .sort({ createdAt: -1 })
        .lean()
    ]);

    const events = [
      ...documents.map(d => ({
        entryType: 'document',
        _id: d._id,
        date: d.docDate,
        title: `${d.docType}: ${(d.extracted?.diagnoses || []).join(', ') || 'Clinical Record'}`,
        docType: d.docType,
        extracted: d.extracted,
        rawText: d.rawText
      })),
      ...cases.map(c => ({
        entryType: 'case',
        _id: c._id,
        date: c.createdAt,
        title: `${c.mode.toUpperCase()} Case: ${c.history?.chiefComplaint}`,
        mode: c.mode,
        status: c.status,
        priority: c.priority,
        redFlags: c.redFlags,
        history: c.history
      }))
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.status(200).json({ patientId: patient._id, documents, timeline: events });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createDocument,
  listDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getPatientDocumentTimeline
};

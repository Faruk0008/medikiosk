const { z } = require('zod');
const CaseRecord = require('../models/CaseRecord');
const Patient = require('../models/Patient');
const User = require('../models/User');
const MedicalDocument = require('../models/MedicalDocument');
const { evaluateCaseRedFlags } = require('../services/redFlag');

const caseCreateSchema = z.object({
  patientId: z.string().min(1),
  mode: z.enum(['allopathic', 'ayush']),
  status: z.enum(['draft', 'submitted', 'reviewed']).optional().default('draft'),
  history: z.object({
    chiefComplaint: z.string().min(2),
    hpi: z.object({
      site: z.string().optional(),
      onset: z.string().optional(),
      character: z.string().optional(),
      radiation: z.string().optional(),
      associations: z.string().optional(),
      timeCourse: z.string().optional(),
      exacerbatingRelieving: z.string().optional(),
      severity: z.number().min(1).max(10).optional()
    }).optional(),
    pastMedicalSurgical: z.array(z.string()).optional(),
    drugAllergy: z.array(z.string()).optional(),
    family: z.array(z.string()).optional(),
    personal: z.any().optional(),
    reviewOfSystems: z.any().optional(),
    dashavidhaPariksha: z.any().optional()
  }).passthrough()
}).passthrough();

async function resolvePatientForUser(reqUser) {
  if (reqUser.role !== 'patient') return null;
  return Patient.findOne({ userId: reqUser._id }).lean();
}

async function enrichCasesWithPatientNames(cases) {
  if (!Array.isArray(cases) || cases.length === 0) return cases;
  const userIds = [];
  for (const c of cases) {
    const p = c.patientId;
    if (p && typeof p === 'object' && p.userId) {
      userIds.push(p.userId);
    }
  }
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name email abhaId language').lean()
    : [];
  const userMap = new Map(users.map(u => [u._id.toString(), u]));

  return cases.map(c => {
    const p = c.patientId;
    const u = p && p.userId ? userMap.get(p.userId.toString()) : null;
    return {
      ...c,
      patientName: u ? u.name : 'Registered Patient',
      patientAbhaId: u?.abhaId || '',
      patientDemographics: p?.demographics || null
    };
  });
}

function getByDotPath(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function setByDotPath(obj, dotPath, val) {
  const parts = dotPath.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = val;
}

async function gatherPatientInvestigations(patientId) {
  const docs = await MedicalDocument.find({ patientId }).sort({ docDate: -1 }).limit(10).lean();
  const investigations = [];
  for (const d of docs) {
    if (d.extracted && Array.isArray(d.extracted.investigations)) {
      investigations.push(...d.extracted.investigations);
    }
  }
  return investigations;
}

async function createCase(req, res, next) {
  try {
    const data = caseCreateSchema.parse(req.body);
    const patient = await Patient.findById(data.patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (req.user.role === 'patient' && patient.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Patients can only create cases for themselves' });
    }

    if (patient.consent && patient.consent.dataCapture === false) {
      return res.status(403).json({ error: 'Patient has revoked dataCapture consent' });
    }

    let redFlags = [];
    let priority = req.body.priority || 10;

    if (data.status === 'submitted') {
      const inv = await gatherPatientInvestigations(patient._id);
      const evaluated = evaluateCaseRedFlags({ history: data.history }, inv);
      redFlags = evaluated.redFlags;
      priority = evaluated.priority;
    }

    const created = await CaseRecord.create({
      patientId: patient._id,
      mode: data.mode,
      status: data.status || 'draft',
      priority,
      history: data.history,
      redFlags,
      physicianEdits: []
    });

    return res.status(201).json(created);
  } catch (err) {
    next(err);
  }
}

async function listCases(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient) {
        return res.status(200).json({ data: [], pagination: { page, limit, total: 0, totalPages: 1 } });
      }
      filter.patientId = ownPatient._id;
      if (req.query.status) filter.status = req.query.status;
    } else if (req.user.role === 'physician') {
      if (req.query.status === 'draft') {
        return res.status(403).json({ error: 'Forbidden: Physicians can only read submitted or reviewed cases' });
      }
      filter.status = req.query.status || { $in: ['submitted', 'reviewed'] };
    } else if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.mode) filter.mode = req.query.mode;
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const [rawCases, total] = await Promise.all([
      CaseRecord.find(filter).populate('patientId').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CaseRecord.countDocuments(filter)
    ]);

    const data = await enrichCasesWithPatientNames(rawCases);

    return res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (err) {
    next(err);
  }
}

async function getCasesByPatient(req, res, next) {
  try {
    const { patientId } = req.params;
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (req.user.role === 'patient' && patient.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Patients can only access their own cases' });
    }

    const filter = { patientId: patient._id };
    if (req.user.role === 'physician') {
      filter.status = { $in: ['submitted', 'reviewed'] };
    }

    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      CaseRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CaseRecord.countDocuments(filter)
    ]);

    return res.status(200).json({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 }
    });
  } catch (err) {
    next(err);
  }
}

async function getCaseById(req, res, next) {
  try {
    const caseDoc = await CaseRecord.findById(req.params.id).populate('patientId').lean();
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }

    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      const casePid = caseDoc.patientId?._id ? caseDoc.patientId._id.toString() : caseDoc.patientId.toString();
      if (!ownPatient || ownPatient._id.toString() !== casePid) {
        return res.status(403).json({ error: 'Forbidden: Patients can only access their own cases' });
      }
    }

    if (req.user.role === 'physician' && caseDoc.status === 'draft') {
      return res.status(403).json({ error: 'Forbidden: Physicians cannot read unsubmitted draft cases' });
    }

    const [enriched] = await enrichCasesWithPatientNames([caseDoc]);
    return res.status(200).json(enriched);
  } catch (err) {
    next(err);
  }
}

async function updateCase(req, res, next) {
  try {
    const caseDoc = await CaseRecord.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }

    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== caseDoc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Cannot update another patient case' });
      }
    }

    const updateFields = {};
    if (req.body.mode) updateFields.mode = req.body.mode;
    if (req.body.history) {
      updateFields.history = { ...caseDoc.toObject().history, ...req.body.history };
    }

    const updated = await CaseRecord.findByIdAndUpdate(req.params.id, { $set: updateFields }, { new: true, runValidators: true });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function submitCase(req, res, next) {
  try {
    const caseDoc = await CaseRecord.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }

    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== caseDoc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Cannot submit another patient case' });
      }
    }

    const investigations = await gatherPatientInvestigations(caseDoc.patientId);
    const { redFlags, priority } = evaluateCaseRedFlags(caseDoc.toObject(), investigations);

    const updated = await CaseRecord.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'submitted', redFlags, priority } },
      { new: true, runValidators: true }
    );

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
}

async function reviewCase(req, res, next) {
  try {
    const caseDoc = await CaseRecord.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }
    if (caseDoc.status === 'draft') {
      return res.status(400).json({ error: 'Cannot review a case that is still in draft status' });
    }

    const raw = caseDoc.toObject();
    const newEdits = [];
    const now = new Date();

    if (Array.isArray(req.body.edits)) {
      for (const edit of req.body.edits) {
        if (!edit.field) continue;
        const oldVal = getByDotPath(raw, edit.field);
        setByDotPath(raw, edit.field, edit.new);
        newEdits.push({ who: req.user._id, when: now, field: edit.field, old: oldVal, new: edit.new });
      }
    }

    if (req.body.updates && typeof req.body.updates === 'object') {
      for (const [fieldPath, newVal] of Object.entries(req.body.updates)) {
        const oldVal = getByDotPath(raw, fieldPath);
        if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          setByDotPath(raw, fieldPath, newVal);
          newEdits.push({ who: req.user._id, when: now, field: fieldPath, old: oldVal, new: newVal });
        }
      }
    }

    if (req.body.history && typeof req.body.history === 'object') {
      for (const [k, v] of Object.entries(req.body.history)) {
        const fieldPath = `history.${k}`;
        const oldVal = raw.history ? raw.history[k] : undefined;
        if (JSON.stringify(oldVal) !== JSON.stringify(v)) {
          raw.history[k] = v;
          newEdits.push({ who: req.user._id, when: now, field: fieldPath, old: oldVal, new: v });
        }
      }
    }

    const updatedEdits = [...(raw.physicianEdits || []), ...newEdits];

    const updated = await CaseRecord.findByIdAndUpdate(
      req.params.id,
      { $set: { status: 'reviewed', history: raw.history, physicianEdits: updatedEdits } },
      { new: true, runValidators: true }
    )
      .populate('patientId')
      .lean();

    const [enriched] = await enrichCasesWithPatientNames([updated]);
    return res.status(200).json(enriched);
  } catch (err) {
    next(err);
  }
}

async function deleteCase(req, res, next) {
  try {
    const caseDoc = await CaseRecord.findById(req.params.id);
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }

    if (req.user.role === 'patient') {
      const ownPatient = await resolvePatientForUser(req.user);
      if (!ownPatient || ownPatient._id.toString() !== caseDoc.patientId.toString()) {
        return res.status(403).json({ error: 'Forbidden: Cannot delete another patient case' });
      }
    }

    await CaseRecord.findByIdAndDelete(req.params.id);
    return res.status(200).json({ message: 'CaseRecord deleted successfully' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createCase,
  listCases,
  getCasesByPatient,
  getCaseById,
  updateCase,
  submitCase,
  reviewCase,
  deleteCase,
  enrichCasesWithPatientNames
};

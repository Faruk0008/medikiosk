const User = require('../models/User');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const { enrichCasesWithPatientNames } = require('./case.controller');

async function globalSearch(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) {
      return res.status(200).json({ query: '', patients: [], cases: [], documents: [], total: 0 });
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const isPatient = req.user.role === 'patient';
    let ownPatient = null;

    if (isPatient) {
      ownPatient = await Patient.findOne({ userId: req.user._id }).lean();
    }

    let matchedPatients = [];
    if (!isPatient) {
      const matchedUsers = await User.find({
        role: 'patient',
        $or: [{ name: regex }, { email: regex }, { abhaId: regex }]
      })
        .limit(8)
        .lean();
      const userIds = matchedUsers.map(u => u._id);
      const patientsByUser = userIds.length
        ? await Patient.find({ userId: { $in: userIds } }).populate('userId', 'name email abhaId language').limit(8).lean()
        : [];
      const patientsByAddr = await Patient.find({ 'demographics.address': regex })
        .populate('userId', 'name email abhaId language')
        .limit(5)
        .lean();
      const seen = new Set();
      for (const p of [...patientsByUser, ...patientsByAddr]) {
        if (!seen.has(p._id.toString())) {
          seen.add(p._id.toString());
          matchedPatients.push(p);
        }
      }
      matchedPatients = matchedPatients.slice(0, 6);
    } else if (ownPatient) {
      matchedPatients = [ownPatient];
    }

    const caseFilter = {
      $or: [
        { 'history.chiefComplaint': regex },
        { 'history.pastMedicalSurgical': regex },
        { mode: regex }
      ]
    };
    if (isPatient) {
      caseFilter.patientId = ownPatient ? ownPatient._id : '__none__';
    } else if (req.user.role === 'physician') {
      caseFilter.status = { $in: ['submitted', 'reviewed'] };
    }

    const rawCases = await CaseRecord.find(caseFilter)
      .populate('patientId')
      .sort({ priority: -1, createdAt: -1 })
      .limit(8)
      .lean();
    const matchedCases = await enrichCasesWithPatientNames(rawCases);

    const docFilter = {
      $or: [
        { 'extracted.diagnoses': regex },
        { rawText: regex },
        { docType: regex }
      ]
    };
    if (isPatient) {
      docFilter.patientId = ownPatient ? ownPatient._id : '__none__';
    }

    const matchedDocs = await MedicalDocument.find(docFilter)
      .sort({ docDate: -1 })
      .limit(6)
      .lean();

    const total = matchedPatients.length + matchedCases.length + matchedDocs.length;

    return res.status(200).json({
      query: q,
      patients: matchedPatients,
      cases: matchedCases,
      documents: matchedDocs,
      total
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { globalSearch };

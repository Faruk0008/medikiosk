const mongoose = require('mongoose');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const Patient = require('../models/Patient');

async function getCasesPerDayAndMode(req, res, next) {
  try {
    const raw = await CaseRecord.aggregate([
      {
        $group: {
          _id: {
            day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            mode: '$mode'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.day': 1 } }
    ]);

    const byDayMap = new Map();
    for (const item of raw) {
      const day = item._id.day;
      const mode = item._id.mode;
      if (!byDayMap.has(day)) {
        byDayMap.set(day, { day, allopathic: 0, ayush: 0, total: 0 });
      }
      const entry = byDayMap.get(day);
      entry[mode] = (entry[mode] || 0) + item.count;
      entry.total += item.count;
    }

    return res.status(200).json({
      raw,
      chartData: Array.from(byDayMap.values()).sort((a, b) => a.day.localeCompare(b.day))
    });
  } catch (err) {
    next(err);
  }
}

async function getTopChiefComplaints(req, res, next) {
  try {
    const data = await CaseRecord.aggregate([
      {
        $group: {
          _id: '$history.chiefComplaint',
          count: { $sum: 1 },
          avgPriority: { $avg: '$priority' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          chiefComplaint: '$_id',
          count: 1,
          avgPriority: 1
        }
      }
    ]);

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getAbnormalLabFrequency(req, res, next) {
  try {
    const data = await MedicalDocument.aggregate([
      { $unwind: '$extracted.investigations' },
      { $match: { 'extracted.investigations.abnormal': true } },
      {
        $group: {
          _id: '$extracted.investigations.name',
          abnormalCount: { $sum: 1 },
          avgValue: { $avg: '$extracted.investigations.value' },
          unit: { $first: '$extracted.investigations.unit' }
        }
      },
      { $sort: { abnormalCount: -1 } },
      {
        $project: {
          _id: 0,
          testName: '$_id',
          abnormalCount: 1,
          avgValue: 1,
          unit: 1
        }
      }
    ]);

    return res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}

async function getMergedPatientTimeline(req, res, next) {
  try {
    const { patientId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: 'Invalid patientId' });
    }
    const pid = new mongoose.Types.ObjectId(patientId);

    const timeline = await CaseRecord.aggregate([
      { $match: { patientId: pid } },
      {
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patientProfile'
        }
      },
      {
        $project: {
          _id: 1,
          patientId: 1,
          entryType: { $literal: 'case' },
          eventDate: '$createdAt',
          title: '$history.chiefComplaint',
          mode: '$mode',
          status: '$status',
          priority: '$priority',
          redFlags: '$redFlags',
          details: '$history',
          patientProfile: '$patientProfile'
        }
      },
      {
        $unionWith: {
          coll: 'medicaldocuments',
          pipeline: [
            { $match: { patientId: pid } },
            {
              $project: {
                _id: 1,
                patientId: 1,
                entryType: { $literal: 'document' },
                eventDate: '$docDate',
                title: '$docType',
                docType: '$docType',
                details: '$extracted',
                rawText: '$rawText'
              }
            }
          ]
        }
      },
      { $sort: { eventDate: -1 } }
    ]);

    return res.status(200).json({ patientId, count: timeline.length, timeline });
  } catch (err) {
    next(err);
  }
}

async function getRedFlagCountsPerWeek(req, res, next) {
  try {
    const raw = await CaseRecord.aggregate([
      { $unwind: '$redFlags' },
      {
        $group: {
          _id: {
            week: { $dateToString: { format: '%Y-W%V', date: '$createdAt' } },
            code: '$redFlags.code',
            severity: '$redFlags.severity'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.week': 1, count: -1 } }
    ]);

    const weeklyTotalsMap = new Map();
    for (const item of raw) {
      const week = item._id.week;
      if (!weeklyTotalsMap.has(week)) {
        weeklyTotalsMap.set(week, { week, critical: 0, high: 0, moderate: 0, total: 0 });
      }
      const entry = weeklyTotalsMap.get(week);
      const sev = item._id.severity || 'high';
      entry[sev] = (entry[sev] || 0) + item.count;
      entry.total += item.count;
    }

    return res.status(200).json({
      raw,
      weeklyChart: Array.from(weeklyTotalsMap.values()).sort((a, b) => a.week.localeCompare(b.week))
    });
  } catch (err) {
    next(err);
  }
}

async function getCoveredQueryStats(req, res, next) {
  try {
    const query = CaseRecord.find({ status: 'submitted' })
      .select({ status: 1, priority: 1, createdAt: 1, _id: 0 })
      .sort({ priority: -1, createdAt: 1 })
      .limit(20);

    const [results, explain] = await Promise.all([
      query.lean(),
      query.explain('executionStats')
    ]);

    return res.status(200).json({
      indexUsed: 'idx_case_triage_queue',
      executionStats: explain.executionStats,
      sampleResults: results
    });
  } catch (err) {
    next(err);
  }
}

async function getAnalyticsOverview(req, res, next) {
  try {
    const [totalPatients, totalCases, totalDocuments, submittedCases] = await Promise.all([
      Patient.countDocuments({}),
      CaseRecord.countDocuments({}),
      MedicalDocument.countDocuments({}),
      CaseRecord.countDocuments({ status: 'submitted' })
    ]);

    return res.status(200).json({
      kpis: { totalPatients, totalCases, totalDocuments, submittedCases }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getCasesPerDayAndMode,
  getTopChiefComplaints,
  getAbnormalLabFrequency,
  getMergedPatientTimeline,
  getRedFlagCountsPerWeek,
  getCoveredQueryStats,
  getAnalyticsOverview
};

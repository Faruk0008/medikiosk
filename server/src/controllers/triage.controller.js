const CaseRecord = require('../models/CaseRecord');
const { enrichCasesWithPatientNames } = require('./case.controller');

async function getTriageQueue(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const statusFilter = req.query.status || 'submitted';
    const filter = { status: statusFilter };

    if (req.query.minPriority !== undefined) {
      filter.priority = { $gte: Number(req.query.minPriority) };
    }

    if (req.query.covered === 'true') {
      const coveredQuery = CaseRecord.find({ status: 'submitted' })
        .select({ status: 1, priority: 1, createdAt: 1, _id: 0 })
        .sort({ priority: -1, createdAt: 1 })
        .limit(limit);

      const [data, explain] = await Promise.all([
        coveredQuery.lean(),
        coveredQuery.explain('executionStats')
      ]);
      return res.status(200).json({ data, explain: explain.executionStats });
    }

    const rawQueue = await CaseRecord.find(filter)
      .populate('patientId')
      .sort({ priority: -1, createdAt: 1 })
      .limit(limit)
      .lean();

    const queue = await enrichCasesWithPatientNames(rawQueue);

    return res.status(200).json({
      count: queue.length,
      redFlaggedCount: queue.filter(c => Array.isArray(c.redFlags) && c.redFlags.length > 0).length,
      criticalCount: queue.filter(c => c.priority >= 75).length,
      unacknowledgedCount: queue.filter(c => !c.triageAcknowledged).length,
      data: queue
    });
  } catch (err) {
    next(err);
  }
}

async function acknowledgeTriageCase(req, res, next) {
  try {
    const { caseId } = req.params;
    const caseDoc = await CaseRecord.findById(caseId);
    if (!caseDoc) {
      return res.status(404).json({ error: 'CaseRecord not found' });
    }

    const updated = await CaseRecord.findByIdAndUpdate(
      caseId,
      {
        $set: {
          triageAcknowledged: true,
          triageAcknowledgedAt: new Date(),
          triageAcknowledgedBy: req.user._id
        }
      },
      { new: true }
    )
      .populate('patientId')
      .lean();

    const [enriched] = await enrichCasesWithPatientNames([updated]);
    return res.status(200).json(enriched);
  } catch (err) {
    next(err);
  }
}

module.exports = { getTriageQueue, acknowledgeTriageCase };

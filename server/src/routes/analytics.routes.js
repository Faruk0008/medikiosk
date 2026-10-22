const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getCasesPerDayAndMode,
  getTopChiefComplaints,
  getAbnormalLabFrequency,
  getMergedPatientTimeline,
  getRedFlagCountsPerWeek,
  getCoveredQueryStats,
  getAnalyticsOverview
} = require('../controllers/analytics.controller');

router.use(authenticate);

router.get('/overview', getAnalyticsOverview);
router.get('/cases-per-day', getCasesPerDayAndMode);
router.get('/top-complaints', getTopChiefComplaints);
router.get('/abnormal-labs', getAbnormalLabFrequency);
router.get('/patient-timeline/:patientId', getMergedPatientTimeline);
router.get('/red-flags-per-week', getRedFlagCountsPerWeek);
router.get('/covered-query', getCoveredQueryStats);

module.exports = router;

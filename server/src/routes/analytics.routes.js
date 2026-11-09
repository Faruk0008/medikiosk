const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
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

// Aggregate analytics are staff-only; patients must never see hospital-wide data.
const staff = authorize('physician', 'triage');

router.get('/overview', staff, getAnalyticsOverview);
router.get('/cases-per-day', staff, getCasesPerDayAndMode);
router.get('/top-complaints', staff, getTopChiefComplaints);
router.get('/abnormal-labs', staff, getAbnormalLabFrequency);
// Ownership for patients is enforced inside the controller.
router.get('/patient-timeline/:patientId', getMergedPatientTimeline);
router.get('/red-flags-per-week', staff, getRedFlagCountsPerWeek);
router.get('/covered-query', staff, getCoveredQueryStats);

module.exports = router;

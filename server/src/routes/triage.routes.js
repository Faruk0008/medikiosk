const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getTriageQueue, acknowledgeTriageCase } = require('../controllers/triage.controller');

router.use(authenticate);
router.get('/queue', authorize('triage', 'physician'), getTriageQueue);
router.patch('/:caseId/acknowledge', authorize('triage', 'physician'), acknowledgeTriageCase);

module.exports = router;

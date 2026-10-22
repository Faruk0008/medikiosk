const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getConsentHistory } = require('../controllers/patient.controller');

router.use(authenticate);
router.get('/:patientId', getConsentHistory);

module.exports = router;

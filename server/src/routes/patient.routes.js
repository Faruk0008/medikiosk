const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createPatient,
  listPatients,
  getPatientById,
  updatePatient,
  updateConsent,
  deletePatient
} = require('../controllers/patient.controller');

router.use(authenticate);

router.post('/', createPatient);
router.get('/', listPatients);
router.get('/:id', getPatientById);
router.put('/:id', updatePatient);
router.patch('/:id', updatePatient);
router.patch('/:id/consent', updateConsent);
router.delete('/:id', deletePatient);

module.exports = router;

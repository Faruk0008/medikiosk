const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  createCase,
  listCases,
  getCasesByPatient,
  getCaseById,
  updateCase,
  submitCase,
  reviewCase,
  deleteCase
} = require('../controllers/case.controller');

router.use(authenticate);

router.post('/', createCase);
router.get('/', listCases);
router.get('/patient/:patientId', getCasesByPatient);
router.get('/:id', getCaseById);
router.put('/:id', updateCase);
router.patch('/:id', updateCase);
router.post('/:id/submit', submitCase);
router.patch('/:id/review', authorize('physician'), reviewCase);
router.delete('/:id', deleteCase);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  createDocument,
  listDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
  getPatientDocumentTimeline
} = require('../controllers/document.controller');

router.use(authenticate);

router.post('/', createDocument);
router.get('/', listDocuments);
router.get('/patient/:patientId/timeline', getPatientDocumentTimeline);
router.get('/:id', getDocumentById);
router.put('/:id', updateDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);

module.exports = router;

const mongoose = require('mongoose');
const { Schema } = mongoose;

const medicalDocumentSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: [true, 'patientId is required'] },
    docType: { type: String, required: [true, 'docType is required'], enum: ['prescription', 'labReport', 'dischargeSummary'] },
    docDate: { type: Date, required: [true, 'docDate is required'], default: () => new Date() },
    extracted: {
      diagnoses: [{ type: String }],
      medications: [{ name: { type: String, required: true }, dose: { type: String, required: true } }],
      investigations: [
        {
          name: { type: String, required: true },
          value: { type: Number, required: true },
          unit: { type: String, required: true },
          refRange: { type: String, required: true },
          abnormal: { type: Boolean, default: false }
        }
      ]
    },
    rawText: { type: String, default: '' }
  },
  { timestamps: true }
);

medicalDocumentSchema.index({ patientId: 1, docDate: -1 }, { name: 'idx_doc_patient_date' });
medicalDocumentSchema.index({ 'extracted.diagnoses': 'text', rawText: 'text' }, { name: 'idx_doc_diagnoses_text' });

module.exports = mongoose.model('MedicalDocument', medicalDocumentSchema);

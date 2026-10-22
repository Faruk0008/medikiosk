const mongoose = require('mongoose');
const { Schema } = mongoose;

const CaseRecordSchema = new Schema(
  {
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: [true, 'patientId is required'] },
    mode: { type: String, required: [true, 'Clinical mode is required'], enum: ['allopathic', 'ayush'] },
    status: { type: String, required: true, enum: ['draft', 'submitted', 'reviewed'], default: 'draft' },
    priority: { type: Number, default: 0, min: [0, 'Priority >= 0'], max: [100, 'Priority <= 100'] },
    triageAcknowledged: { type: Boolean, default: false },
    triageAcknowledgedAt: { type: Date },
    triageAcknowledgedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: () => new Date() },
    history: {
      chiefComplaint: { type: String, required: [true, 'history.chiefComplaint is required'] },
      hpi: {
        site: { type: String, default: '' },
        onset: { type: String, default: '' },
        character: { type: String, default: '' },
        radiation: { type: String, default: '' },
        associations: { type: String, default: '' },
        timeCourse: { type: String, default: '' },
        exacerbatingRelieving: { type: String, default: '' },
        severity: { type: Number, default: 5, min: 1, max: 10 }
      },
      pastMedicalSurgical: [{ type: String }],
      drugAllergy: [{ type: String }],
      family: [{ type: String }],
      personal: {
        diet: { type: String, default: '' },
        sleep: { type: String, default: '' },
        bowelBladder: { type: String, default: '' },
        addictions: { type: String, default: 'None' },
        occupation: { type: String, default: '' }
      },
      reviewOfSystems: {
        cardiovascular: { type: String, default: 'Normal' },
        respiratory: { type: String, default: 'Normal' },
        gastrointestinal: { type: String, default: 'Normal' },
        neurological: { type: String, default: 'Normal' },
        musculoskeletal: { type: String, default: 'Normal' },
        general: { type: String, default: 'Normal' }
      },
      dashavidhaPariksha: {
        prakriti: { type: String, default: '' },
        vikriti: { type: String, default: '' },
        sara: { type: String, default: '' },
        samhanana: { type: String, default: '' },
        pramana: { type: String, default: '' },
        satmya: { type: String, default: '' },
        sattva: { type: String, default: '' },
        aharaShakti: { type: String, default: '' },
        vyayamaShakti: { type: String, default: '' },
        vaya: { type: String, default: '' }
      }
    },
    redFlags: [
      {
        ruleId: { type: String },
        code: { type: String },
        name: { type: String },
        category: { type: String },
        severity: { type: String, enum: ['critical', 'high', 'moderate'] },
        priorityBoost: { type: Number },
        rationale: { type: String },
        detectedAt: { type: Date, default: () => new Date() }
      }
    ],
    physicianEdits: [
      {
        who: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        when: { type: Date, default: () => new Date() },
        field: { type: String, required: true },
        old: { type: Schema.Types.Mixed },
        new: { type: Schema.Types.Mixed }
      }
    ]
  },
  { timestamps: true }
);

CaseRecordSchema.index({ patientId: 1, createdAt: -1 }, { name: 'idx_case_patient_created' });
CaseRecordSchema.index({ status: 1, priority: -1, createdAt: 1 }, { name: 'idx_case_triage_queue' });
CaseRecordSchema.index(
  { 'history.chiefComplaint': 'text', 'history.pastMedicalSurgical': 'text' },
  { name: 'idx_case_text_search' }
);
CaseRecordSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 604800, partialFilterExpression: { status: 'draft' }, name: 'idx_case_ttl_stale_drafts' }
);

module.exports = mongoose.model('CaseRecord', CaseRecordSchema);

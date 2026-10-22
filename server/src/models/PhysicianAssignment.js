const mongoose = require('mongoose');
const { Schema } = mongoose;

const physicianAssignmentSchema = new Schema(
  {
    physicianId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'physicianId is required'] },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: [true, 'patientId is required'] },
    department: {
      type: String,
      required: true,
      enum: ['General Medicine', 'Kayachikitsa', 'Panchakarma', 'Shalya Tantra', 'Cardiology', 'Emergency Triage'],
      default: 'General Medicine'
    },
    assignmentRole: { type: String, enum: ['primary', 'consulting', 'triage_escalation'], default: 'primary' },
    active: { type: Boolean, default: true },
    assignedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

physicianAssignmentSchema.index({ physicianId: 1, patientId: 1 }, { unique: true, name: 'idx_physician_patient_unique' });
physicianAssignmentSchema.index({ patientId: 1, active: 1 }, { name: 'idx_assignment_patient_active' });

module.exports = mongoose.model('PhysicianAssignment', physicianAssignmentSchema);

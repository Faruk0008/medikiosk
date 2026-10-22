const mongoose = require('mongoose');
const { Schema } = mongoose;

const patientSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId reference is required'],
      unique: true
    },
    demographics: {
      age: {
        type: Number,
        required: [true, 'Patient age is required'],
        min: [0, 'Age >= 0'],
        max: [130, 'Age <= 130']
      },
      sex: {
        type: String,
        required: [true, 'Patient sex is required'],
        enum: ['male', 'female', 'other']
      },
      address: {
        type: String,
        required: [true, 'Address is required']
      },
      phone: { type: String, default: '' },
      bloodGroup: { type: String, default: '' }
    },
    consent: {
      dataCapture: { type: Boolean, required: true, default: true },
      sharing: { type: Boolean, required: true, default: false },
      updatedAt: { type: Date, default: () => new Date() }
    },
    consentHistory: [
      {
        dataCapture: { type: Boolean, required: true },
        sharing: { type: Boolean, required: true },
        actorRole: { type: String, default: 'patient' },
        note: { type: String, default: 'Consent preferences updated' },
        timestamp: { type: Date, default: () => new Date() }
      }
    ],
    revocable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

patientSchema.index({ userId: 1 }, { unique: true, name: 'idx_patient_userid_unique' });

module.exports = mongoose.model('Patient', patientSchema);

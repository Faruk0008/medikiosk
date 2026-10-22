const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true },
    role: { type: String, required: [true, 'Role is required'], enum: ['patient', 'physician', 'triage'] },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address']
    },
    passwordHash: { type: String, required: [true, 'passwordHash is required'] },
    language: { type: String, default: 'en', enum: ['en', 'hi', 'sa', 'ta', 'te', 'bn', 'mr', 'gu'] },
    abhaId: {
      type: String,
      unique: true,
      sparse: true,
      match: [/^\d{2}-\d{4}-\d{4}-\d{4}$/, 'ABHA ID must follow XX-XXXX-XXXX-XXXX format']
    }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, name: 'idx_user_email_unique' });
userSchema.index({ abhaId: 1 }, { unique: true, sparse: true, name: 'idx_user_abha_unique_sparse' });

module.exports = mongoose.model('User', userSchema);

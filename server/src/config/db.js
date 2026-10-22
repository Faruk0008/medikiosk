const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');
const { applyCollectionValidators } = require('../models/validators');
const User = require('../models/User');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const PhysicianAssignment = require('../models/PhysicianAssignment');

async function connectDB(uri = MONGODB_URI) {
  const conn = await mongoose.connect(uri);
  await applyCollectionValidators(mongoose.connection.db);
  await Promise.all([
    User.syncIndexes(),
    Patient.syncIndexes(),
    CaseRecord.syncIndexes(),
    MedicalDocument.syncIndexes(),
    PhysicianAssignment.syncIndexes()
  ]);
  return conn;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };

const mongoose = require('mongoose');
const { MONGODB_URI } = require('./env');
const { applyCollectionValidators } = require('../models/validators');
const User = require('../models/User');
const Patient = require('../models/Patient');
const CaseRecord = require('../models/CaseRecord');
const MedicalDocument = require('../models/MedicalDocument');
const PhysicianAssignment = require('../models/PhysicianAssignment');

async function connectDB(uri = MONGODB_URI) {
  // autoIndex/autoCreate off: collections (with $jsonSchema validators) and indexes are
  // created explicitly below, in order. Otherwise Mongoose's background work races with
  // createCollection/collMod (errors 48 'already exists' and 12587 'index build running').
  const conn = await mongoose.connect(uri, { autoIndex: false, autoCreate: false });
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

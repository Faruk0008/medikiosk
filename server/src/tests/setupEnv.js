// Tests drop their database; never let them touch the dev database.
process.env.MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/medikiosk_test';
process.env.NODE_ENV = 'test';

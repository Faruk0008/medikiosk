const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const User = require('../models/User');
const Patient = require('../models/Patient');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['patient', 'physician', 'triage']).default('patient'),
  language: z.enum(['en', 'hi', 'sa', 'ta', 'te', 'bn', 'mr', 'gu']).optional().default('en'),
  abhaId: z.string().regex(/^\d{2}-\d{4}-\d{4}-\d{4}$/, 'ABHA ID must follow XX-XXXX-XXXX-XXXX').optional(),
  demographics: z.object({
    age: z.number().min(0).max(130),
    sex: z.enum(['male', 'female', 'other']),
    address: z.string().min(1)
  }).optional()
}).passthrough();

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const userPayload = {
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      language: data.language || 'en'
    };
    if (data.abhaId) userPayload.abhaId = data.abhaId;

    const user = await User.create(userPayload);

    let patient = null;
    if (user.role === 'patient' && data.demographics) {
      patient = await Patient.create({
        userId: user._id,
        demographics: data.demographics,
        consent: { dataCapture: true, sharing: true, updatedAt: new Date() },
        revocable: true
      });
    }

    const token = signToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        abhaId: user.abhaId
      },
      patient
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let patient = null;
    if (user.role === 'patient') {
      patient = await Patient.findOne({ userId: user._id }).lean();
    }

    const token = signToken(user);
    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        language: user.language,
        abhaId: user.abhaId
      },
      patient
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    let patient = null;
    if (req.user.role === 'patient') {
      patient = await Patient.findOne({ userId: req.user._id }).lean();
    }
    return res.status(200).json({ user: req.user, patient });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe, registerSchema, loginSchema };

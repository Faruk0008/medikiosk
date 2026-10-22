const { ZodError } = require('zod');

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError || err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation Error', details: err.issues || err.errors || [] });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Schema Validation Error',
      message: err.message,
      details: Object.keys(err.errors || {}).map(k => ({ field: k, message: err.errors[k].message }))
    });
  }
  if (err.code === 121) {
    return res.status(400).json({
      error: 'MongoDB $jsonSchema Validation Failed',
      message: err.message,
      details: err.errInfo?.details || []
    });
  }
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate Key Conflict', message: err.message });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({ error: err.message || 'Internal Server Error' });
}

module.exports = { errorHandler };

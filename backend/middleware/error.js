const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');

function notFound(req, res, next) {
  next(new ApiError(404, `Not Found - ${req.method} ${req.originalUrl}`));
}

function errorHandler(err, req, res, _next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (err && err.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id format' });
  }

  if (err && err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: 'Internal Server Error' });
}

module.exports = { notFound, errorHandler };

import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

export function notFound(req, _res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  let error = err;

  if (err instanceof mongoose.Error.ValidationError) {
    error = ApiError.badRequest(
      'Please correct the highlighted fields',
      Object.values(err.errors).map((e) => ({ location: 'body', field: e.path, message: e.message })),
    );
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (err?.code === 11000) {
    error = ApiError.conflict('This record already exists', 'DUPLICATE');
  } else if (err?.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Request body is not valid JSON');
  } else if (err?.type === 'entity.too.large') {
    error = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (!(error instanceof ApiError)) {
    if (!env.isTest) console.error(err);
    error = new ApiError(500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
  }

  res.status(error.status).json({
    success: false,
    error: { code: error.code, message: error.message, details: error.details ?? [] },
  });
}

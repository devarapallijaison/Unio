export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Invalid request', details = []) {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }
  static unauthenticated(message = 'Please sign in to continue') {
    return new ApiError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have permission to do that') {
    return new ApiError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }
  static conflict(message, code = 'CONFLICT') {
    return new ApiError(409, code, message);
  }
  static invalidTransition(from, to) {
    return new ApiError(409, 'INVALID_TRANSITION', `Cannot change status from "${from}" to "${to}"`);
  }
}

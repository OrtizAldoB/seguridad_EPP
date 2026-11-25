export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, code = 'APP_ERROR', details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Solicitud invalida', details?: unknown) {
    super(400, message, 'BAD_REQUEST', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Autenticacion requerida') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'No tiene permisos para esta operacion') {
    super(403, message, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, message, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe', details?: unknown) {
    super(409, message, 'CONFLICT', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos invalidos', details?: unknown) {
    super(422, message, 'VALIDATION_ERROR', details);
  }
}

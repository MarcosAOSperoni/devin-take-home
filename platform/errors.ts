export class UnauthenticatedError extends Error {
  constructor(message = "Not signed in") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(
    message = "You do not have permission to do that",
    readonly resourceId?: string,
  ) {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class AlreadyDecidedError extends ConflictError {
  constructor() {
    super("This approval has already been decided");
    this.name = "AlreadyDecidedError";
  }
}

/** Messages that are safe to show to the user (they never contain input values). */
export function userFacingMessage(error: unknown): string {
  if (
    error instanceof UnauthenticatedError ||
    error instanceof ForbiddenError ||
    error instanceof ValidationError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError
  ) {
    return error.message;
  }
  return "Something went wrong";
}

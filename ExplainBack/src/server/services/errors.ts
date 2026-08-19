export type ServiceErrorCode =
  | "NOT_FOUND"
  | "CONFLICT"
  | "INVALID_STATE"
  | "AI_CONFIGURATION"
  | "AI_UNAVAILABLE";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly resourceId?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string) {
    super("CONFLICT", message);
    this.name = "ConflictError";
  }
}

export class InvalidStateError extends ServiceError {
  constructor(message: string) {
    super("INVALID_STATE", message);
    this.name = "InvalidStateError";
  }
}

export class TutorOperationError extends ServiceError {
  constructor(message: string, resourceId?: string, cause?: unknown) {
    super("AI_UNAVAILABLE", message, resourceId, { cause });
    this.name = "TutorOperationError";
  }
}

export class AiConfigurationServiceError extends ServiceError {
  constructor(message: string, resourceId?: string, cause?: unknown) {
    super("AI_CONFIGURATION", message, resourceId, { cause });
    this.name = "AiConfigurationServiceError";
  }
}

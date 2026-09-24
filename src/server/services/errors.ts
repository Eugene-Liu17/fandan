export type ServiceErrorCode =
  | "invalid_input"
  | "not_found"
  | "invalid_transition"
  | "invalid_rating";

/**
 * An expected failure the caller should show to the user (or the model),
 * as opposed to a bug. `code` is stable; `message` is for logs.
 */
export class ServiceError extends Error {
  constructor(
    readonly code: ServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Parses `input` with a Zod-like schema, turning failures into ServiceError. */
export function parseInput<T>(
  schema: {
    safeParse: (
      value: unknown,
    ) =>
      | { success: true; data: T }
      | { success: false; error: { message: string } };
  },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ServiceError("invalid_input", result.error.message);
  }
  return result.data;
}

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function apiResponse<T>(data: T) {
  return { success: true, data };
}

export function apiError(code: string, message: string, statusCode = 400) {
  return {
    success: false,
    error: { code, message },
    statusCode,
  };
}

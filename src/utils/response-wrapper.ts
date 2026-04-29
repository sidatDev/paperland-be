
export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  success: boolean;
  message: string;
  data: T;
  // Backward compatibility
  page?: number;
  limit?: number;
  total?: number;
  // New standard
  metadata?: {
    page: number;
    limit: number;
    total: number;
    [key: string]: any;
  };
}

export function createResponse<T>(
  data: T,
  message: string = 'Success',
  meta?: { page: number; limit: number; total: number; [key: string]: any }
): ApiResponse<T> {
  return {
    status: 'success',
    success: true,
    message,
    data,
    ...(meta && {
        page: meta.page,
        limit: meta.limit,
        total: meta.total,
        metadata: {
            ...meta
        }
    })
  };
}

export function createErrorResponse(message: string): ApiResponse<null> {
  return {
    status: 'error',
    success: false,
    message,
    data: null
  };
}

import { FastifyInstance } from 'fastify';

export interface AuditLogParams {
  entityType: string;
  entityId: string;
  action: string;
  performedBy?: string;
  details?: Record<string, any>;
  metadata?: Record<string, any>;
  request?: {
    method?: string;
    url?: string;
    headers?: Record<string, any>;
  };
}

const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'secret', 'creditCard', 'apiKey', 'authorization', 'smtpPass', 'smtpUser', 'cvv', 'card', 'cookie', 'set-cookie', 'x-api-key', 'x-auth-token'];

function maskSensitiveData(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  const masked = { ...data };
  for (const key of Object.keys(masked)) {
    if (SENSITIVE_KEYS.some(k => key.toLowerCase().includes(k))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }
  return masked;
}

export async function logActivity(fastify: FastifyInstance, params: AuditLogParams & { ip?: string; userAgent?: string }) {
  const { entityType, entityId, action, performedBy, details, metadata, request, ip, userAgent } = params;
  try {
    const safeDetails = maskSensitiveData(details);
    const safeMetadata = maskSensitiveData(metadata || {});

    // Process request information if provided
    const requestInfo: Record<string, any> = {};
    if (request) {
      if (request.method) requestInfo.method = request.method;
      if (request.url) requestInfo.url = request.url;
      if (request.headers) {
        requestInfo.headers = maskSensitiveData(request.headers);
      }
    }

    // Check if auditLog model exists in prisma client
    if (!fastify.prisma.auditLog) {
        fastify.log.warn('[AuditLog] auditLog model not found in Prisma client. Skipping log.');
        return;
    }

    await fastify.prisma.auditLog.create({
      data: {
        entityType,
        entityId,
        action,
        performedBy: performedBy || null,
        details: safeDetails || {},
        metadata: {
          ...safeMetadata,
          ...(ip && { ip }),
          ...(userAgent && { userAgent }),
          ...(Object.keys(requestInfo).length > 0 && { request: requestInfo })
        }
      }
    });
  } catch (err: any) {
    fastify.log.error(`[AuditLog] Failed to log activity: ${err.message || err}`);
  }
}

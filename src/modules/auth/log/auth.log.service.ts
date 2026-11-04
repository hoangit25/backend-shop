import AuditLogModel, { AuditAction } from '../model/auth.log.model';

export interface RecordAuditParams {
  userId?: string | any;
  email?: string;
  action: AuditAction;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export class AuditLogService {
  static async record(params: RecordAuditParams) {
    try {
      await AuditLogModel.create({
        userId: params.userId || null,
        email: params.email || '',
        action: params.action,
        status: params.status,
        ipAddress: params.ipAddress || 'Unknown',
        userAgent: params.userAgent || 'Unknown',
        details: params.details || {},
      });
    } catch (error) {
      console.error('⚠️ Failed to record security audit log:', error);
      // Audit log failures should not crash the auth request
    }
  }

  static async getUserLogs(userId: string, limit = 50) {
    return AuditLogModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}

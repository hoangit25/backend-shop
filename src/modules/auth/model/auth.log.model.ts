import mongoose, { Schema, Document, Types } from 'mongoose';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'LOGOUT_ALL'
  | 'LOGOUT_FAILED'
  | 'REFRESH_TOKEN_SUCCESS'
  | 'REFRESH_TOKEN_FAILED'
  | 'SESSION_REVOKED'
  | 'ALL_OTHER_SESSIONS_REVOKED'
  | 'REGISTER_SUCCESS'
  | 'FORGOT_PASSWORD_REQUEST'
  | 'RESET_PASSWORD_SUCCESS';

export interface IAuditLog extends Document {
  userId?: Types.ObjectId;
  email?: string;
  action: AuditAction;
  status: 'SUCCESS' | 'FAILED' | 'WARNING';
  ipAddress: string;
  userAgent: string;
  details?: Record<string, any>;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    email: {
      type: String,
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'WARNING'],
      required: true,
      index: true,
    },
    ipAddress: {
      type: String,
      default: 'Unknown',
    },
    userAgent: {
      type: String,
      default: 'Unknown',
    },
    details: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', auditLogSchema, 'AuditLogs');
export default AuditLogModel;

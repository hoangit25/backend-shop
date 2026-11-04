import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISession extends Document {
  userId: Types.ObjectId;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  deviceName: string;
  isRevoked: boolean;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    refreshToken: {
      type: String,
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
    deviceName: {
      type: String,
      default: 'Unknown Device',
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ userId: 1, isRevoked: 1 });

sessionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0 }
);


const SessionModel = mongoose.model<ISession>('Session', sessionSchema, 'Sessions');
export default SessionModel;

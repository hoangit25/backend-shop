import mongoose, { Schema, Document } from 'mongoose';

export type TrafficSource = 'DIRECT' | 'GOOGLE' | 'FACEBOOK' | 'OTHER';

export interface IVisitor extends Document {
  visitorId: string;
  sessionId: string;
  source: TrafficSource;
  path: string;
  ipHash?: string;
  userAgent?: string;
  isBot?: boolean;
  visitedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const visitorSchema = new Schema<IVisitor>(
  {
    visitorId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['DIRECT', 'GOOGLE', 'FACEBOOK', 'OTHER'],
      default: 'DIRECT',
      index: true,
    },
    path: {
      type: String,
      default: '/',
    },
    ipHash: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    isBot: {
      type: Boolean,
      default: false,
      index: true,
    },
    visitedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index để tối ưu truy vấn đếm phiên và lọc ngày
visitorSchema.index({ visitedAt: 1, isBot: 1 });
visitorSchema.index({ sessionId: 1, visitedAt: -1 });

export const VisitorModel = mongoose.model<IVisitor>('Visitor', visitorSchema);
export default VisitorModel;

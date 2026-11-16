// import mongoose, { Schema, Document, Types } from 'mongoose';

// export type PaymentProviderType = 'COD' | 'VNPAY' | 'MOMO';
// export type PaymentStatusType = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

// export interface IPayment extends Document {
//   orderId: Types.ObjectId;
//   orderCode: string;
//   userId?: Types.ObjectId | null;
//   provider: PaymentProviderType;
//   amount: number;
//   currency: string;
//   status: PaymentStatusType;
//   paymentUrl?: string;
//   transactionId?: string;
//   bankCode?: string;
//   cardType?: string;
//   rawRequest?: any;
//   rawResponse?: any;
//   failureReason?: string;
//   paidAt?: Date;
//   createdAt: Date;
//   updatedAt: Date;
// }

// const paymentSchema = new Schema<IPayment>(
//   {
//     orderId: {
//       type: Schema.Types.ObjectId,
//       ref: 'Order',
//       required: true,
//       index: true,
//     },
//     orderCode: {
//       type: String,
//       required: true,
//       trim: true,
//       uppercase: true,
//       index: true,
//     },
//     userId: {
//       type: Schema.Types.ObjectId,
//       ref: 'User',
//       default: null,
//       index: true,
//     },
//     provider: {
//       type: String,
//       enum: ['COD', 'VNPAY', 'MOMO'],
//       required: true,
//     },
//     amount: {
//       type: Number,
//       required: true,
//       min: 0,
//     },
//     currency: {
//       type: String,
//       default: 'VND',
//       uppercase: true,
//     },
//     status: {
//       type: String,
//       enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
//       default: 'PENDING',
//       index: true,
//     },
//     paymentUrl: {
//       type: String,
//       default: '',
//     },
//     transactionId: {
//       type: String,
//       default: '',
//       trim: true,
//     },
//     bankCode: {
//       type: String,
//       default: '',
//       trim: true,
//     },
//     cardType: {
//       type: String,
//       default: '',
//       trim: true,
//     },
//     rawRequest: {
//       type: Schema.Types.Mixed,
//       default: null,
//     },
//     rawResponse: {
//       type: Schema.Types.Mixed,
//       default: null,
//     },
//     failureReason: {
//       type: String,
//       default: '',
//       trim: true,
//     },
//     paidAt: {
//       type: Date,
//       default: null,
//     },
//   },
//   {
//     timestamps: true,
//     versionKey: false,
//   }
// );

// paymentSchema.index({ orderId: 1, createdAt: -1 });
// paymentSchema.index({ transactionId: 1 });

// const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);

// export default PaymentModel;


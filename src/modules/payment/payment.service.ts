// import { Types } from 'mongoose';
// import { AppError } from '../../common/appError';
// import OrderModel from '../order/order.model';
// import PaymentModel, {
//   IPayment,
//   PaymentProviderType,
// } from './payment.model';
// import { IPaymentProvider } from './providers/payment-provider.interface';
// import { codProvider } from './providers/cod.provider';
// import { vnpayProvider } from './providers/vnpay.provider';
// import { momoProvider } from './providers/momo.provider';

// export interface CreatePaymentDto {
//   orderId: string;
//   provider: PaymentProviderType;
//   ipAddr?: string;
//   returnUrl?: string;
// }

// export class PaymentService {
//   private providers: Map<PaymentProviderType, IPaymentProvider> = new Map();

//   constructor() {
//     this.registerProvider(codProvider);
//     this.registerProvider(vnpayProvider);
//     this.registerProvider(momoProvider);
//   }

//   /**
//    * Đăng ký provider thanh toán vào registry
//    */
//   registerProvider(provider: IPaymentProvider) {
//     this.providers.set(provider.name.toUpperCase() as PaymentProviderType, provider);
//   }

//   /**
//    * Lấy provider tương ứng theo tên (COD, VNPAY, MOMO)
//    */
//   getProvider(providerName: PaymentProviderType): IPaymentProvider {
//     const provider = this.providers.get(providerName.toUpperCase() as PaymentProviderType);
//     if (!provider) {
//       throw AppError.BadRequest(
//         `Payment provider "${providerName}" is not supported. Supported: COD, VNPAY, MOMO`,
//         'UNSUPPORTED_PAYMENT_PROVIDER'
//       );
//     }
//     return provider;
//   }

//   /**
//    * 1. Khởi tạo thanh toán cho một đơn hàng
//    */
//   async createPayment(dto: CreatePaymentDto) {
//     const { orderId, provider: providerName, ipAddr = '127.0.0.1', returnUrl } = dto;

//     const isObjectId = Types.ObjectId.isValid(orderId);
//     const filter = isObjectId
//       ? { $or: [{ _id: new Types.ObjectId(orderId) }, { orderCode: orderId.toUpperCase() }] }
//       : { orderCode: orderId.toUpperCase() };

//     const order = await OrderModel.findOne(filter);
//     if (!order) {
//       throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
//     }

//     if (order.paymentStatus === 'PAID') {
//       throw AppError.BadRequest('Order has already been paid', 'ORDER_ALREADY_PAID');
//     }

//     if (order.orderStatus === 'CANCELLED') {
//       throw AppError.BadRequest('Cannot pay for a cancelled order', 'ORDER_CANCELLED');
//     }

//     const provider = this.getProvider(providerName);

//     // Tìm hoặc tạo mới bản ghi Payment
//     let payment = await PaymentModel.findOne({
//       orderId: order._id,
//       status: 'PENDING',
//     });

//     if (!payment) {
//       payment = new PaymentModel({
//         orderId: order._id,
//         orderCode: order.orderCode,
//         userId: order.userId || null,
//         provider: providerName,
//         amount: order.pricing.totalAmount,
//         currency: 'VND',
//         status: 'PENDING',
//       });
//     } else {
//       payment.provider = providerName;
//       payment.amount = order.pricing.totalAmount;
//     }

//     // Gọi provider để sinh link thanh toán
//     const result = await provider.createPaymentUrl({
//       orderId: order._id.toString(),
//       orderCode: order.orderCode,
//       amount: order.pricing.totalAmount,
//       orderInfo: `Thanh toán đơn hàng ${order.orderCode}`,
//       ipAddr,
//       returnUrl,
//     });

//     payment.paymentUrl = result.paymentUrl;
//     payment.rawRequest = {
//       orderCode: order.orderCode,
//       amount: order.pricing.totalAmount,
//       provider: providerName,
//       extra: result.extra,
//     };

//     await payment.save();

//     // Cập nhật phương thức thanh toán trên Order nếu có thay đổi
//     if (order.paymentMethod !== providerName) {
//       order.paymentMethod = providerName;
//       await order.save();
//     }

//     return {
//       payment,
//       paymentUrl: result.paymentUrl,
//       provider: providerName,
//       orderCode: order.orderCode,
//       amount: order.pricing.totalAmount,
//     };
//   }

//   /**
//    * 2. Xử lý khi khách hàng được chuyển hướng về trang web sau khi thanh toán (Return URL)
//    */
//   async handleReturn(providerName: PaymentProviderType, query: Record<string, any>) {
//     const provider = this.getProvider(providerName);
//     const verifyResult = await provider.verifyReturnUrl(query);

//     const orderCode = verifyResult.orderCode;
//     if (!orderCode) {
//       throw AppError.BadRequest('Missing orderCode in payment response', 'INVALID_RESPONSE');
//     }

//     const order = await OrderModel.findOne({ orderCode: orderCode.toUpperCase() });
//     if (!order) {
//       throw AppError.NotFound(`Order not found for code: ${orderCode}`, 'ORDER_NOT_FOUND');
//     }

//     const payment = await PaymentModel.findOne({ orderId: order._id }).sort({ createdAt: -1 });

//     if (verifyResult.isSuccess) {
//       // Đánh dấu thanh toán thành công
//       if (payment) {
//         payment.status = 'SUCCESS';
//         payment.transactionId = verifyResult.transactionId || payment.transactionId;
//         payment.bankCode = verifyResult.bankCode || payment.bankCode;
//         payment.cardType = verifyResult.cardType || payment.cardType;
//         payment.paidAt = new Date();
//         payment.rawResponse = query;
//         await payment.save();
//       }

//       order.paymentStatus = 'PAID';
//       order.paidAt = new Date();

//       // Nếu đơn đang PENDING, xác nhận chuyển sang CONFIRMED
//       if (order.orderStatus === 'PENDING') {
//         order.orderStatus = 'CONFIRMED';
//         order.statusHistory.push({
//           status: 'CONFIRMED',
//           changedAt: new Date(),
//           changedBy: 'PAYMENT_GATEWAY',
//           note: `Payment completed via ${providerName}. Order confirmed.`,
//         });
//       }

//       await order.save();
//     } else {
//       // Đánh dấu thanh toán thất bại
//       if (payment) {
//         payment.status = 'FAILED';
//         payment.failureReason = verifyResult.message;
//         payment.rawResponse = query;
//         await payment.save();
//       }

//       order.paymentStatus = 'FAILED';
//       await order.save();
//     }

//     return {
//       isSuccess: verifyResult.isSuccess,
//       message: verifyResult.message,
//       orderCode: order.orderCode,
//       orderId: order._id,
//       amount: order.pricing.totalAmount,
//       paymentMethod: providerName,
//     };
//   }

//   /**
//    * 3. Xử lý IPN Webhook gửi trực tiếp từ máy chủ cổng thanh toán (Server-to-Server)
//    */
//   async handleWebhook(providerName: PaymentProviderType, payload: Record<string, any>) {
//     const provider = this.getProvider(providerName);
//     const verifyResult = await provider.verifyWebhook(payload);

//     const orderCode = verifyResult.orderCode;
//     if (!orderCode) {
//       return providerName === 'VNPAY'
//         ? { RspCode: '01', Message: 'Order not found' }
//         : { resultCode: 1, message: 'Order not found' };
//     }

//     const order = await OrderModel.findOne({ orderCode: orderCode.toUpperCase() });
//     if (!order) {
//       return providerName === 'VNPAY'
//         ? { RspCode: '01', Message: 'Order not found' }
//         : { resultCode: 1, message: 'Order not found' };
//     }

//     // Kiểm tra tính Idempotent: Nếu đã PAID rồi thì xác nhận thành công ngay
//     if (order.paymentStatus === 'PAID') {
//       return providerName === 'VNPAY'
//         ? { RspCode: '00', Message: 'Order already confirmed' }
//         : { resultCode: 0, message: 'Order already confirmed' };
//     }

//     const payment = await PaymentModel.findOne({ orderId: order._id }).sort({ createdAt: -1 });

//     if (verifyResult.isSuccess) {
//       if (payment) {
//         payment.status = 'SUCCESS';
//         payment.transactionId = verifyResult.transactionId || payment.transactionId;
//         payment.bankCode = verifyResult.bankCode || payment.bankCode;
//         payment.cardType = verifyResult.cardType || payment.cardType;
//         payment.paidAt = new Date();
//         payment.rawResponse = payload;
//         await payment.save();
//       }

//       order.paymentStatus = 'PAID';
//       order.paidAt = new Date();

//       if (order.orderStatus === 'PENDING') {
//         order.orderStatus = 'CONFIRMED';
//         order.statusHistory.push({
//           status: 'CONFIRMED',
//           changedAt: new Date(),
//           changedBy: 'WEBHOOK',
//           note: `Webhook verified: Payment completed via ${providerName}`,
//         });
//       }

//       await order.save();

//       return providerName === 'VNPAY'
//         ? { RspCode: '00', Message: 'Confirm Success' }
//         : { resultCode: 0, message: 'Success' };
//     } else {
//       if (payment) {
//         payment.status = 'FAILED';
//         payment.failureReason = verifyResult.message;
//         payment.rawResponse = payload;
//         await payment.save();
//       }

//       return providerName === 'VNPAY'
//         ? { RspCode: '97', Message: 'Checksum failed' }
//         : { resultCode: 1, message: verifyResult.message };
//     }
//   }

//   /**
//    * 4. Lấy thông tin thanh toán theo mã đơn hàng
//    */
//   async getPaymentByOrderId(orderId: string): Promise<IPayment | null> {
//     const isObjectId = Types.ObjectId.isValid(orderId);
//     const filter = isObjectId
//       ? { $or: [{ orderId: new Types.ObjectId(orderId) }, { orderCode: orderId.toUpperCase() }] }
//       : { orderCode: orderId.toUpperCase() };

//     return PaymentModel.findOne(filter).sort({ createdAt: -1 }).exec();
//   }
// }

// export const paymentService = new PaymentService();


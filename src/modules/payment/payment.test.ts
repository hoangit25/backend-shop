// import { describe, it, expect, vi, beforeEach } from 'vitest';
// import { Types } from 'mongoose';
// import { paymentService } from './payment.service';
// import PaymentModel from './payment.model';
// import OrderModel from '../order/order.model';
// import { vnpayProvider } from './providers/vnpay.provider';
// import { codProvider } from './providers/cod.provider';

// describe('PaymentService', () => {
//   beforeEach(() => {
//     vi.restoreAllMocks();
//   });

//   describe('getProvider', () => {
//     it('should return COD, VNPAY, MOMO providers', () => {
//       expect(paymentService.getProvider('COD')).toBeDefined();
//       expect(paymentService.getProvider('VNPAY')).toBeDefined();
//       expect(paymentService.getProvider('MOMO')).toBeDefined();
//     });

//     it('should throw error for unsupported provider', () => {
//       expect(() => paymentService.getProvider('ZALOPAY' as any)).toThrow('Payment provider "ZALOPAY" is not supported');
//     });
//   });

//   describe('createPayment', () => {
//     it('should throw error if order not found', async () => {
//       vi.spyOn(OrderModel, 'findOne').mockResolvedValue(null);

//       await expect(
//         paymentService.createPayment({
//           orderId: new Types.ObjectId().toString(),
//           provider: 'COD',
//         })
//       ).rejects.toThrow('Order not found');
//     });

//     it('should throw error if order is already paid', async () => {
//       vi.spyOn(OrderModel, 'findOne').mockResolvedValue({
//         _id: new Types.ObjectId(),
//         paymentStatus: 'PAID',
//         orderStatus: 'CONFIRMED',
//       } as any);

//       await expect(
//         paymentService.createPayment({
//           orderId: new Types.ObjectId().toString(),
//           provider: 'COD',
//         })
//       ).rejects.toThrow('Order has already been paid');
//     });

//     it('should create payment successfully for VNPAY', async () => {
//       const orderId = new Types.ObjectId();
//       const mockOrder = {
//         _id: orderId,
//         orderCode: 'ORD-TEST-999',
//         pricing: { totalAmount: 500000 },
//         paymentStatus: 'PENDING',
//         orderStatus: 'PENDING',
//         paymentMethod: 'VNPAY',
//         save: vi.fn().mockResolvedValue(true),
//       };

//       vi.spyOn(OrderModel, 'findOne').mockResolvedValue(mockOrder as any);
//       vi.spyOn(PaymentModel, 'findOne').mockResolvedValue(null);
//       vi.spyOn(PaymentModel.prototype, 'save').mockImplementation(function (this: any) {
//         return Promise.resolve(this);
//       });

//       const result = await paymentService.createPayment({
//         orderId: orderId.toString(),
//         provider: 'VNPAY',
//         ipAddr: '127.0.0.1',
//       });

//       expect(result).toBeDefined();
//       expect(result.provider).toBe('VNPAY');
//       expect(result.paymentUrl).toContain('vnp_SecureHash=');
//       expect(result.paymentUrl).toContain('vnp_Amount=50000000'); // 500k * 100
//     });
//   });

//   describe('handleReturn', () => {
//     it('should update payment and order to SUCCESS/PAID when return is verified', async () => {
//       const orderCode = 'ORD-TEST-888';
//       const mockOrder = {
//         _id: new Types.ObjectId(),
//         orderCode,
//         pricing: { totalAmount: 300000 },
//         orderStatus: 'PENDING',
//         paymentStatus: 'PENDING',
//         statusHistory: [],
//         save: vi.fn().mockResolvedValue(true),
//       };

//       const mockPayment = {
//         _id: new Types.ObjectId(),
//         status: 'PENDING',
//         save: vi.fn().mockResolvedValue(true),
//       };

//       vi.spyOn(vnpayProvider, 'verifyReturnUrl').mockResolvedValue({
//         isSuccess: true,
//         orderCode,
//         transactionId: '14000123',
//         message: 'Success',
//         rawResponse: {},
//       });

//       vi.spyOn(OrderModel, 'findOne').mockResolvedValue(mockOrder as any);
//       vi.spyOn(PaymentModel, 'findOne').mockReturnValue({
//         sort: vi.fn().mockResolvedValue(mockPayment),
//       } as any);

//       const result = await paymentService.handleReturn('VNPAY', { vnp_TxnRef: orderCode });

//       expect(result.isSuccess).toBe(true);
//       expect(mockOrder.paymentStatus).toBe('PAID');
//       expect(mockOrder.orderStatus).toBe('CONFIRMED');
//       expect(mockPayment.status).toBe('SUCCESS');
//     });
//   });
// });


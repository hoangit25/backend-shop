// import { Router, Request, Response } from 'express';
// import { ApiResponse } from '../../common/api.responsitory';
// import { asyncHandler } from '../../common/asycn.handel';
// import { AppError } from '../../common/appError';
// import { optionalAuth } from '../cart/cart.route';
// import { paymentService } from './payment.service';
// import { PaymentProviderType } from './payment.model';

// const router = Router();

// /**
//  * Trích xuất IP client
//  */
// function getClientIp(req: Request): string {
//   const forwarded = req.headers['x-forwarded-for'];
//   if (typeof forwarded === 'string') {
//     return forwarded.split(',')[0].trim();
//   }
//   return req.socket.remoteAddress || '127.0.0.1';
// }

// // 1. Khởi tạo thanh toán (Lấy URL thanh toán cho VNPay, MoMo hoặc xác nhận COD)
// router.post(
//   '/create',
//   optionalAuth,
//   asyncHandler(async (req: Request, res: Response) => {
//     const { orderId, provider, returnUrl } = req.body;

//     if (!orderId) {
//       throw AppError.BadRequest('orderId is required', 'MISSING_ORDER_ID');
//     }

//     if (!provider) {
//       throw AppError.BadRequest('provider is required (COD, VNPAY, MOMO)', 'MISSING_PROVIDER');
//     }

//     const ipAddr = getClientIp(req);
//     const result = await paymentService.createPayment({
//       orderId,
//       provider: provider.toUpperCase() as PaymentProviderType,
//       ipAddr,
//       returnUrl,
//     });

//     return ApiResponse.success(res, result, 'Payment initiated successfully');
//   })
// );

// // 2. VNPay Return URL (Khách hàng được VNPay chuyển hướng về)
// router.get(
//   '/vnpay/return',
//   asyncHandler(async (req: Request, res: Response) => {
//     const query = req.query as Record<string, any>;
//     const result = await paymentService.handleReturn('VNPAY', query);

//     // Chuyển hướng về Frontend hoặc trả lời kết quả JSON
//     const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
//     const redirectUrl = `${clientUrl}/checkout/payment-return?orderCode=${result.orderCode}&isSuccess=${result.isSuccess}&message=${encodeURIComponent(result.message)}&provider=VNPAY`;

//     return res.redirect(redirectUrl);
//   })
// );

// // 3. VNPay IPN Webhook (Máy chủ VNPay gọi sang để đồng bộ giao dịch)
// router.get(
//   '/vnpay/webhook',
//   asyncHandler(async (req: Request, res: Response) => {
//     const query = req.query as Record<string, any>;
//     const vnpayResponse = await paymentService.handleWebhook('VNPAY', query);
//     return res.status(200).json(vnpayResponse);
//   })
// );

// // 4. MoMo Return URL (Khách hàng được MoMo chuyển hướng về)
// router.get(
//   '/momo/return',
//   asyncHandler(async (req: Request, res: Response) => {
//     const query = req.query as Record<string, any>;
//     const result = await paymentService.handleReturn('MOMO', query);

//     const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
//     const redirectUrl = `${clientUrl}/checkout/payment-return?orderCode=${result.orderCode}&isSuccess=${result.isSuccess}&message=${encodeURIComponent(result.message)}&provider=MOMO`;

//     return res.redirect(redirectUrl);
//   })
// );

// // 5. MoMo IPN Webhook (Máy chủ MoMo gọi sang để đồng bộ giao dịch)
// router.post(
//   '/momo/webhook',
//   asyncHandler(async (req: Request, res: Response) => {
//     const body = req.body as Record<string, any>;
//     const momoResponse = await paymentService.handleWebhook('MOMO', body);
//     return res.status(200).json(momoResponse);
//   })
// );

// // 6. Lấy trạng thái thanh toán của một đơn hàng
// router.get(
//   '/order/:orderId',
//   optionalAuth,
//   asyncHandler(async (req: Request, res: Response) => {
//     const orderId = req.params.orderId as string;
//     const payment = await paymentService.getPaymentByOrderId(orderId);

//     if (!payment) {
//       throw AppError.NotFound('Payment record not found for this order', 'PAYMENT_NOT_FOUND');
//     }

//     return ApiResponse.success(res, payment, 'Payment details retrieved');
//   })
// );

// export const paymentRouter = router;
// export default router;


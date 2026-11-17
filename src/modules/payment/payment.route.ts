import { Router, Request, Response } from 'express';
import { ApiResponse } from '../../common/api.responsitory';
import { asyncHandler } from '../../common/asycn.handel';
import { AppError } from '../../common/appError';
import { optionalAuth } from '../cart/cart.route';
import { paymentService } from './payment.service';
import { PaymentProviderType } from './payment.model';

const router = Router();

/**
 * Trích xuất IP client
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

// 1. Khởi tạo thanh toán (Lấy URL thanh toán cho VNPay hoặc xác nhận COD)
router.post(
  '/create',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const { orderId, provider, returnUrl } = req.body;

    if (!orderId) {
      throw AppError.BadRequest('orderId is required', 'MISSING_ORDER_ID');
    }

    if (!provider) {
      throw AppError.BadRequest(
        'provider is required (COD, VNPAY)',
        'MISSING_PROVIDER'
      );
    }

    const ipAddr = getClientIp(req);
    const result = await paymentService.createPayment({
      orderId,
      provider: provider.toUpperCase() as PaymentProviderType,
      ipAddr,
      returnUrl,
    });

    return ApiResponse.success(res, result, 'Payment initiated successfully');
  })
);

// 2. VNPay Return URL (Khách hàng được VNPay redirect về trình duyệt sau khi thanh toán)
// TIÊU CHÍ 1: Xác thực chữ ký số HMAC-SHA512 để không thể giả mạo URL Return.
// TIÊU CHÍ 2: Kiểm tra số tiền khớp với đơn hàng.
router.get(
  '/vnpay/return',
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as Record<string, any>;
    const clientUrl =
      process.env.CLIENT_URL?.trim() ||
      'https://frontend-shop-gamma.vercel.app';

    try {
      const result = await paymentService.handleReturn('VNPAY', query);

      const redirectUrl = `${clientUrl}/checkout/payment-return?orderCode=${result.orderCode}&isSuccess=${result.isSuccess}&message=${encodeURIComponent(
        result.message
      )}&transactionId=${encodeURIComponent(
        result.transactionId || ''
      )}&provider=VNPAY`;

      return res.redirect(redirectUrl);
    } catch (error: any) {
      const orderCode = (query.vnp_TxnRef as string) || '';
      const errorMessage = error?.message || 'Xác thực thanh toán thất bại';
      const redirectUrl = `${clientUrl}/checkout/payment-return?orderCode=${orderCode}&isSuccess=false&message=${encodeURIComponent(
        errorMessage
      )}&provider=VNPAY`;

      return res.redirect(redirectUrl);
    }
  })
);

// 3. VNPay IPN Webhook (Máy chủ VNPay gọi sang đồng bộ giao dịch Server-to-Server)
// Hỗ trợ cả 2 endpoint: /vnpay/ipn và /vnpay/webhook, hỗ trợ cả GET và POST
const handleVNPayIPN = asyncHandler(async (req: Request, res: Response) => {
  const data = (req.method === 'GET' ? req.query : req.body) as Record<string, any>;
  const vnpayResponse = await paymentService.handleWebhook('VNPAY', data);
  return res.status(200).json(vnpayResponse);
});

router.get('/vnpay/ipn', handleVNPayIPN);
router.post('/vnpay/ipn', handleVNPayIPN);
router.get('/vnpay/webhook', handleVNPayIPN);
router.post('/vnpay/webhook', handleVNPayIPN);

// 4. Lấy trạng thái thanh toán của một đơn hàng (Dành cho frontend kiểm tra trạng thái)
// TIÊU CHÍ 4: Tránh mất trạng thái khi khách hàng đóng tab rồi mở lại
router.get(
  '/order/:orderId',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.orderId as string;
    const payment = await paymentService.getPaymentByOrderId(orderId);

    if (!payment) {
      throw AppError.NotFound(
        'Payment record not found for this order',
        'PAYMENT_NOT_FOUND'
      );
    }

    return ApiResponse.success(res, payment, 'Payment details retrieved');
  })
);

// 5. [TIÊU CHÍ 5]: Danh sách đối soát giao dịch với VNPay Merchant Sandbox
router.get(
  '/reconciliation',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      orderCode,
      transactionId,
      bankTranNo,
      bankCode,
      status,
      page,
      limit,
    } = req.query;

    const result = await paymentService.getReconciliation({
      orderCode: orderCode as string,
      transactionId: transactionId as string,
      bankTranNo: bankTranNo as string,
      bankCode: bankCode as string,
      status: status as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    return ApiResponse.success(res, result, 'Reconciliation data retrieved');
  })
);

// 6. [TIÊU CHÍ 5]: Đối soát chi tiết 1 giao dịch theo mã tham chiếu / mã GD VNPay
router.get(
  '/reconciliation/:txnRef',
  optionalAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const txnRef = req.params.txnRef as string;
    const result = await paymentService.getReconciliationByTxnRef(txnRef);
    return ApiResponse.success(
      res,
      result,
      'Transaction reconciliation details retrieved'
    );
  })
);

export const paymentRouter = router;
export default router;

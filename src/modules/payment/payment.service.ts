import { Types } from 'mongoose';
import { AppError } from '../../common/appError';
import OrderModel from '../order/order.model';
import PaymentModel, {
  IPayment,
  PaymentProviderType,
} from './payment.model';
import { IPaymentProvider } from './providers/payment-provider.interface';
import { codProvider } from './providers/cod.provider';
import { vnpayProvider } from './providers/vnpay.provider';

export interface CreatePaymentDto {
  orderId: string;
  provider: PaymentProviderType;
  ipAddr?: string;
  returnUrl?: string;
}

export interface ReconciliationQueryDto {
  orderCode?: string;
  transactionId?: string;
  bankTranNo?: string;
  bankCode?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export class PaymentService {
  private providers: Map<PaymentProviderType, IPaymentProvider> = new Map();

  constructor() {
    this.registerProvider(codProvider);
    this.registerProvider(vnpayProvider);
  }

  /**
   * Đăng ký provider thanh toán vào registry
   */
  registerProvider(provider: IPaymentProvider) {
    this.providers.set(
      provider.name.toUpperCase() as PaymentProviderType,
      provider
    );
  }

  /**
   * Lấy provider tương ứng theo tên (COD, VNPAY)
   */
  getProvider(providerName: PaymentProviderType): IPaymentProvider {
    const provider = this.providers.get(
      providerName.toUpperCase() as PaymentProviderType
    );
    if (!provider) {
      throw AppError.BadRequest(
        `Payment provider "${providerName}" is not supported. Supported: COD, VNPAY`,
        'UNSUPPORTED_PAYMENT_PROVIDER'
      );
    }
    return provider;
  }

  /**
   * 1. Khởi tạo thanh toán cho một đơn hàng (Lấy URL thanh toán VNPay hoặc xác nhận COD)
   */
  async createPayment(dto: CreatePaymentDto) {
    const { orderId, provider: providerName, ipAddr = '127.0.0.1', returnUrl } = dto;

    const isObjectId = Types.ObjectId.isValid(orderId);
    const filter = isObjectId
      ? { $or: [{ _id: new Types.ObjectId(orderId) }, { orderCode: orderId.toUpperCase() }] }
      : { orderCode: orderId.toUpperCase() };

    const order = await OrderModel.findOne(filter);
    if (!order) {
      throw AppError.NotFound('Order not found', 'ORDER_NOT_FOUND');
    }

    if (order.paymentStatus === 'PAID') {
      throw AppError.BadRequest('Order has already been paid', 'ORDER_ALREADY_PAID');
    }

    if (order.orderStatus === 'CANCELLED') {
      throw AppError.BadRequest('Cannot pay for a cancelled order', 'ORDER_CANCELLED');
    }

    const provider = this.getProvider(providerName);

    // Tìm hoặc tạo mới bản ghi Payment
    let payment = await PaymentModel.findOne({
      orderId: order._id,
      status: 'PENDING',
    });

    if (!payment) {
      payment = new PaymentModel({
        orderId: order._id,
        orderCode: order.orderCode,
        userId: order.userId || null,
        provider: providerName,
        amount: order.pricing.totalAmount,
        currency: 'VND',
        status: 'PENDING',
      });
    } else {
      payment.provider = providerName;
      payment.amount = order.pricing.totalAmount;
    }

    // Gọi provider để sinh URL thanh toán
    const result = await provider.createPaymentUrl({
      orderId: order._id.toString(),
      orderCode: order.orderCode,
      amount: order.pricing.totalAmount,
      orderInfo: `Thanh toan don hang ${order.orderCode}`,
      ipAddr,
      returnUrl,
    });

    payment.paymentUrl = result.paymentUrl;
    payment.rawRequest = {
      orderCode: order.orderCode,
      amount: order.pricing.totalAmount,
      provider: providerName,
      extra: result.extra,
    };

    await payment.save();

    // Đồng bộ phương thức thanh toán trên Order nếu có thay đổi
    if (order.paymentMethod !== providerName) {
      order.paymentMethod = providerName;
      await order.save();
    }

    return {
      payment,
      paymentUrl: result.paymentUrl,
      provider: providerName,
      orderCode: order.orderCode,
      amount: order.pricing.totalAmount,
    };
  }

  /**
   * 2. Xử lý khi khách hàng được chuyển hướng về trang web sau khi thanh toán (Return URL)
   * TIÊU CHÍ 1: Kiểm tra nghiêm ngặt chữ ký số HMAC-SHA512 để không thể giả mạo URL Return.
   * TIÊU CHÍ 2: Kiểm tra số tiền khớp với đơn hàng trước khi đánh dấu thành công.
   */
  async handleReturn(providerName: PaymentProviderType, query: Record<string, any>) {
    const provider = this.getProvider(providerName);
    const verifyResult = await provider.verifyReturnUrl(query);

    const orderCode = verifyResult.orderCode;
    if (!orderCode) {
      throw AppError.BadRequest('Thiếu mã đơn hàng trong dữ liệu trả về', 'INVALID_RESPONSE');
    }

    const order = await OrderModel.findOne({ orderCode: orderCode.toUpperCase() });
    if (!order) {
      throw AppError.NotFound(`Không tìm thấy đơn hàng: ${orderCode}`, 'ORDER_NOT_FOUND');
    }

    // [TIÊU CHÍ 1]: Chữ ký số không hợp lệ -> Giả mạo hoặc lỗi checksum, từ chối ngay lập tức
    if (!verifyResult.isSignatureValid) {
      throw AppError.BadRequest(
        'Chữ ký số không hợp lệ (Checksum failed). Giao dịch có thể đã bị can thiệp.',
        'CHECKSUM_FAILED'
      );
    }

    const payment = await PaymentModel.findOne({ orderId: order._id }).sort({ createdAt: -1 });

    // [TIÊU CHÍ 2]: Kiểm tra số tiền thanh toán thực tế với số tiền trong Database của đơn hàng
    const expectedAmount = Math.round(order.pricing.totalAmount);
    const actualAmount =
      verifyResult.amount !== undefined ? Math.round(verifyResult.amount) : null;

    if (actualAmount !== null && actualAmount !== expectedAmount) {
      if (payment) {
        payment.status = 'FAILED';
        payment.failureReason = `Số tiền không khớp: Thực nhận ${actualAmount} VND, cần thanh toán ${expectedAmount} VND`;
        payment.rawResponse = query;
        await payment.save();
      }
      throw AppError.BadRequest(
        `Số tiền thanh toán (${actualAmount} VND) không khớp với số tiền đơn hàng (${expectedAmount} VND)`,
        'INVALID_AMOUNT'
      );
    }

    if (verifyResult.isSuccess) {
      // [TIÊU CHÍ 5]: Lưu đầy đủ các mã đối soát vào PaymentModel
      if (payment) {
        payment.status = 'SUCCESS';
        payment.transactionId = verifyResult.transactionId || payment.transactionId;
        payment.bankTranNo = verifyResult.bankTranNo || payment.bankTranNo;
        payment.bankCode = verifyResult.bankCode || payment.bankCode;
        payment.cardType = verifyResult.cardType || payment.cardType;
        payment.vnpPayDate = verifyResult.payDate || payment.vnpPayDate;
        payment.orderInfo = query.vnp_OrderInfo || payment.orderInfo;
        payment.paidAt = verifyResult.paymentTime || new Date();
        payment.rawResponse = query;
        await payment.save();
      }

      // [TIÊU CHÍ 3]: Cập nhật trạng thái Order có kiểm tra tính Idempotent
      if (order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'PAID';
        order.transactionNo = verifyResult.transactionId || order.transactionNo;
        order.bankCode = verifyResult.bankCode || order.bankCode;
        order.paidAt = verifyResult.paymentTime || new Date();

        if (order.orderStatus === 'PENDING') {
          order.orderStatus = 'CONFIRMED';
          order.statusHistory.push({
            status: 'CONFIRMED',
            changedAt: new Date(),
            changedBy: 'PAYMENT_RETURN_URL',
            note: `Thanh toán thành công qua ${providerName} (Mã GD VNPay: ${verifyResult.transactionId || 'N/A'})`,
          });
        }

        await order.save();
      }
    } else {
      if (payment && payment.status !== 'SUCCESS') {
        payment.status = 'FAILED';
        payment.failureReason = verifyResult.message;
        payment.rawResponse = query;
        await payment.save();
      }

      if (order.paymentStatus !== 'PAID') {
        order.paymentStatus = 'FAILED';
        await order.save();
      }
    }

    return {
      isSuccess: verifyResult.isSuccess,
      message: verifyResult.message,
      orderCode: order.orderCode,
      orderId: order._id,
      amount: order.pricing.totalAmount,
      paymentMethod: providerName,
      transactionId: verifyResult.transactionId,
      bankTranNo: verifyResult.bankTranNo,
      bankCode: verifyResult.bankCode,
    };
  }

  /**
   * 3. Xử lý IPN Webhook gửi trực tiếp từ máy chủ cổng thanh toán (Server-to-Server)
   * TIÊU CHÍ 1: Xác thực chữ ký số độc lập.
   * TIÊU CHÍ 2: So sánh số tiền nhận từ IPN với số tiền đơn hàng (trả RspCode '04' nếu sai).
   * TIÊU CHÍ 3: Idempotent check (trả RspCode '02' nếu đã PAID trước đó, chống IPN lặp và race condition).
   * TIÊU CHÍ 4: Hoạt động ngầm ngay cả khi khách hàng đóng trình duyệt sau khi thanh toán.
   * TIÊU CHÍ 5: Lưu trữ đầy đủ dữ liệu để đối soát trên Merchant Sandbox.
   */
  async handleWebhook(providerName: PaymentProviderType, payload: Record<string, any>) {
    const provider = this.getProvider(providerName);
    const verifyResult = await provider.verifyWebhook(payload);

    // [TIÊU CHÍ 1]: Kiểm tra chữ ký số (Checksum)
    if (!verifyResult.isSignatureValid) {
      return providerName === 'VNPAY'
        ? { RspCode: '97', Message: 'Checksum failed' }
        : { resultCode: 97, message: 'Checksum failed' };
    }

    const orderCode = verifyResult.orderCode;
    if (!orderCode) {
      return providerName === 'VNPAY'
        ? { RspCode: '01', Message: 'Order not found' }
        : { resultCode: 1, message: 'Order not found' };
    }

    const order = await OrderModel.findOne({ orderCode: orderCode.toUpperCase() });
    if (!order) {
      return providerName === 'VNPAY'
        ? { RspCode: '01', Message: 'Order not found' }
        : { resultCode: 1, message: 'Order not found' };
    }

    // [TIÊU CHÍ 2]: Kiểm tra số tiền thanh toán (Amount check)
    // VNPay gửi vnp_Amount = amount * 100
    const expectedAmount = Math.round(order.pricing.totalAmount);
    const actualAmount =
      verifyResult.amount !== undefined ? Math.round(verifyResult.amount) : null;

    if (actualAmount !== null && actualAmount !== expectedAmount) {
      console.warn(
        `[VNPAY IPN AMOUNT MISMATCH] Order ${orderCode}: expected ${expectedAmount}, received ${actualAmount}`
      );
      return providerName === 'VNPAY'
        ? { RspCode: '04', Message: 'Invalid amount' }
        : { resultCode: 4, message: 'Invalid amount' };
    }

    // [TIÊU CHÍ 3]: Chống cập nhật lặp (Idempotent Check)
    // Nếu đơn hàng đã được xác nhận thanh toán trước đó (bởi Return URL hoặc IPN trước)
    if (order.paymentStatus === 'PAID') {
      return providerName === 'VNPAY'
        ? { RspCode: '02', Message: 'Order already confirmed' }
        : { resultCode: 0, message: 'Order already confirmed' };
    }

    const payment = await PaymentModel.findOne({ orderId: order._id }).sort({ createdAt: -1 });

    if (verifyResult.isSuccess) {
      // [TIÊU CHÍ 3 & 4]: Atomic Update chống race condition khi Return URL và IPN webhook đến đồng thời
      const updatedOrder = await OrderModel.findOneAndUpdate(
        {
          _id: order._id,
          paymentStatus: { $ne: 'PAID' },
        },
        {
          $set: {
            paymentStatus: 'PAID',
            orderStatus: order.orderStatus === 'PENDING' ? 'CONFIRMED' : order.orderStatus,
            transactionNo: verifyResult.transactionId || order.transactionNo,
            bankCode: verifyResult.bankCode || order.bankCode,
            paidAt: verifyResult.paymentTime || new Date(),
          },
          $push: {
            statusHistory: {
              status: 'CONFIRMED',
              changedAt: new Date(),
              changedBy: 'VNPAY_IPN_WEBHOOK',
              note: `IPN xác nhận thành công. Mã GD VNPay: ${verifyResult.transactionId || 'N/A'}, Ngân hàng: ${verifyResult.bankCode || 'N/A'}`,
            },
          },
        },
        { new: true }
      );

      if (!updatedOrder) {
        // Một request khác vừa cập nhật PAID
        return providerName === 'VNPAY'
          ? { RspCode: '02', Message: 'Order already confirmed' }
          : { resultCode: 0, message: 'Order already confirmed' };
      }

      // [TIÊU CHÍ 5]: Cập nhật đầy đủ thông tin giao dịch đối soát
      if (payment) {
        payment.status = 'SUCCESS';
        payment.transactionId = verifyResult.transactionId || payment.transactionId;
        payment.bankTranNo = verifyResult.bankTranNo || payment.bankTranNo;
        payment.bankCode = verifyResult.bankCode || payment.bankCode;
        payment.cardType = verifyResult.cardType || payment.cardType;
        payment.vnpPayDate = verifyResult.payDate || payment.vnpPayDate;
        payment.orderInfo = payload.vnp_OrderInfo || payment.orderInfo;
        payment.paidAt = verifyResult.paymentTime || new Date();
        payment.rawResponse = payload;
        payment.ipnReceivedAt = new Date();
        payment.ipnCallCount = (payment.ipnCallCount || 0) + 1;
        await payment.save();
      }

      return providerName === 'VNPAY'
        ? { RspCode: '00', Message: 'Confirm Success' }
        : { resultCode: 0, message: 'Success' };
    } else {
      if (payment) {
        payment.status = 'FAILED';
        payment.failureReason = verifyResult.message;
        payment.rawResponse = payload;
        payment.ipnReceivedAt = new Date();
        payment.ipnCallCount = (payment.ipnCallCount || 0) + 1;
        await payment.save();
      }

      // Khi giao dịch không thành công nhưng IPN hợp lệ, VNPay yêu cầu trả về RspCode 00 để không retry nữa
      return providerName === 'VNPAY'
        ? { RspCode: '00', Message: 'Confirm Success' }
        : { resultCode: 1, message: verifyResult.message };
    }
  }

  /**
   * 4. Lấy thông tin thanh toán theo mã đơn hàng (cho frontend polling trạng thái)
   */
  async getPaymentByOrderId(orderId: string): Promise<IPayment | null> {
    const isObjectId = Types.ObjectId.isValid(orderId);
    const filter = isObjectId
      ? { $or: [{ orderId: new Types.ObjectId(orderId) }, { orderCode: orderId.toUpperCase() }] }
      : { orderCode: orderId.toUpperCase() };

    return PaymentModel.findOne(filter).sort({ createdAt: -1 }).exec();
  }

  /**
   * 5. [TIÊU CHÍ 5]: Đối soát giao dịch với danh sách giao dịch trên VNPay Merchant Sandbox
   */
  async getReconciliation(query: ReconciliationQueryDto) {
    const filter: Record<string, any> = { provider: 'VNPAY' };

    if (query.orderCode) {
      filter.orderCode = { $regex: query.orderCode.trim(), $options: 'i' };
    }
    if (query.transactionId) {
      filter.transactionId = { $regex: query.transactionId.trim(), $options: 'i' };
    }
    if (query.bankTranNo) {
      filter.bankTranNo = { $regex: query.bankTranNo.trim(), $options: 'i' };
    }
    if (query.bankCode) {
      filter.bankCode = query.bankCode.trim().toUpperCase();
    }
    if (query.status) {
      filter.status = query.status.trim().toUpperCase();
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      PaymentModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      PaymentModel.countDocuments(filter),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p._id,
        orderId: p.orderId,
        orderCode: p.orderCode,           // Khớp vnp_TxnRef
        transactionId: p.transactionId,   // Khớp vnp_TransactionNo trên Merchant Sandbox
        bankTranNo: p.bankTranNo,         // Khớp vnp_BankTranNo trên Merchant Sandbox
        bankCode: p.bankCode,             // Khớp vnp_BankCode
        cardType: p.cardType,             // Khớp vnp_CardType
        vnpPayDate: p.vnpPayDate,         // Khớp vnp_PayDate (YYYYMMDDHHmmss)
        orderInfo: p.orderInfo,           // Khớp vnp_OrderInfo
        amount: p.amount,                 // Khớp vnp_Amount / 100
        currency: p.currency,
        status: p.status,
        paidAt: p.paidAt,
        ipnReceivedAt: p.ipnReceivedAt,
        ipnCallCount: p.ipnCallCount || 0,
        rawResponse: p.rawResponse,       // Bằng chứng đối soát đầy đủ
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 6. [TIÊU CHÍ 5]: Đối soát chi tiết 1 giao dịch theo mã tham chiếu
   */
  async getReconciliationByTxnRef(txnRef: string) {
    const payment = await PaymentModel.findOne({
      $or: [
        { orderCode: txnRef.toUpperCase() },
        { transactionId: txnRef },
        { bankTranNo: txnRef },
      ],
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!payment) {
      throw AppError.NotFound(
        `Không tìm thấy giao dịch đối soát cho mã tham chiếu: ${txnRef}`,
        'TRANSACTION_NOT_FOUND'
      );
    }

    const order = await OrderModel.findById(payment.orderId).lean().exec();

    return {
      reconciliation: {
        orderCode: payment.orderCode,
        vnpTransactionNo: payment.transactionId,
        vnpBankTranNo: payment.bankTranNo,
        vnpBankCode: payment.bankCode,
        vnpCardType: payment.cardType,
        vnpPayDate: payment.vnpPayDate,
        amount: payment.amount,
        status: payment.status,
        paidAt: payment.paidAt,
        ipnCallCount: payment.ipnCallCount || 0,
        ipnReceivedAt: payment.ipnReceivedAt,
        rawResponse: payment.rawResponse,
      },
      order: order
        ? {
            orderCode: order.orderCode,
            paymentStatus: order.paymentStatus,
            orderStatus: order.orderStatus,
            totalAmount: order.pricing.totalAmount,
            paidAt: order.paidAt,
          }
        : null,
    };
  }
}

export const paymentService = new PaymentService();

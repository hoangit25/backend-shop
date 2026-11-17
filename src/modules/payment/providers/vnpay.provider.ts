import crypto from 'crypto';
import {
  IPaymentProvider,
  CreatePaymentInput,
  PaymentUrlOutput,
  VerifyResult,
} from './payment-provider.interface';

export class VNPayProvider implements IPaymentProvider {
  readonly name = 'VNPAY';

  private get hashSecret(): string {
    const secret =
      process.env.VNPAY_HASH_SECRET || process.env.VNP_HASH_SECRET;

    if (!secret) {
      throw new Error(
        'VNP_HASH_SECRET (hoặc VNPAY_HASH_SECRET) chưa được cấu hình trong .env'
      );
    }

    return secret.trim();
  }

  private get tmnCode(): string {
    const code =
      process.env.VNPAY_TMN_CODE || process.env.VNP_TMN_CODE;

    if (!code) {
      throw new Error(
        'VNP_TMN_CODE (hoặc VNPAY_TMN_CODE) chưa được cấu hình trong .env'
      );
    }

    return code.trim();
  }

  private get vnpUrl(): string {
    return (
      process.env.VNPAY_URL ||
      process.env.VNP_URL ||
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
    ).trim();
  }

  /**
   * Định dạng ngày giờ theo chuẩn YYYYMMDDHHmmss theo múi giờ Việt Nam (GMT+7)
   */
  private formatVnpDate(date: Date): string {
    const tzOffset = 7 * 60; // GMT+7 tính bằng phút
    const localTime = new Date(
      date.getTime() + (tzOffset + date.getTimezoneOffset()) * 60000
    );

    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = localTime.getFullYear();
    const month = pad(localTime.getMonth() + 1);
    const day = pad(localTime.getDate());
    const hours = pad(localTime.getHours());
    const minutes = pad(localTime.getMinutes());
    const seconds = pad(localTime.getSeconds());

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  /**
   * Sắp xếp object theo thứ tự bảng chữ cái của key (theo chuẩn tài liệu kỹ thuật VNPay 2.1.0)
   * Mã hóa URI và thay thế khoảng trắng '%20' bằng '+'
   */
  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      const val = obj[key];
      if (val !== undefined && val !== null && val !== '') {
        sorted[key] = encodeURIComponent(String(val)).replace(/%20/g, '+');
      }
    }
    return sorted;
  }

  /**
   * 1. Khởi tạo đường dẫn thanh toán VNPay
   */
  async createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput> {
    const createDate = new Date();
    const expireDate = new Date(createDate.getTime() + 15 * 60 * 1000); // Hết hạn sau 15 phút

    const returnUrl =
      process.env.VNP_RETURN_URL?.trim() ||
      input.returnUrl ||
      `${process.env.CLIENT_URL || 'https://frontend-shop-gamma.vercel.app'}/checkout/payment-return`;

    const vnpParams: Record<string, any> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: input.orderCode,
      vnp_OrderInfo:
        input.orderInfo || `Thanh toan don hang ${input.orderCode}`,
      vnp_OrderType: 'other',
      vnp_Amount: Math.round(input.amount * 100), // VNPay tính bằng đơn vị VND * 100
      vnp_ReturnUrl: returnUrl,
      vnp_IpAddr: input.ipAddr || '127.0.0.1',
      vnp_CreateDate: this.formatVnpDate(createDate),
      vnp_ExpireDate: this.formatVnpDate(expireDate),
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

    return {
      paymentUrl,
      transactionRef: input.orderCode,
      provider: this.name,
      extra: {
        createDate: vnpParams.vnp_CreateDate,
        expireDate: vnpParams.vnp_ExpireDate,
      },
    };
  }

  /**
   * 2. Xác thực chữ ký và dữ liệu trả về từ VNPay khi người dùng hoàn tất thanh toán (Return URL)
   */
  async verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult> {
    const secureHash = query.vnp_SecureHash;
    const cleanParams: Record<string, any> = {};

    // TIÊU CHÍ 1: CHỈ lấy các tham số bắt đầu bằng 'vnp_' và loại trừ vnp_SecureHash, vnp_SecureHashType
    for (const [key, value] of Object.entries(query)) {
      if (
        key.startsWith('vnp_') &&
        key !== 'vnp_SecureHash' &&
        key !== 'vnp_SecureHashType' &&
        value !== undefined &&
        value !== null &&
        value !== ''
      ) {
        cleanParams[key] = value;
      }
    }

    const sortedParams = this.sortObject(cleanParams);
    const signData = Object.entries(sortedParams)
      .map(([k, v]) => `${k}=${v}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // So sánh an toàn chống timing attack
    let isSignatureValid = false;
    try {
      const checkHashBuffer = Buffer.from(checkHash.toLowerCase(), 'utf-8');
      const secureHashBuffer = Buffer.from(
        String(secureHash || '').toLowerCase(),
        'utf-8'
      );
      if (checkHashBuffer.length === secureHashBuffer.length) {
        isSignatureValid = crypto.timingSafeEqual(
          checkHashBuffer,
          secureHashBuffer
        );
      }
    } catch {
      isSignatureValid = false;
    }

    const responseCode = query.vnp_ResponseCode;
    const transactionStatus = query.vnp_TransactionStatus;
    const isSuccess =
      isSignatureValid &&
      responseCode === '00' &&
      transactionStatus === '00';

    const rawAmount = query.vnp_Amount
      ? parseInt(String(query.vnp_Amount), 10)
      : undefined;
    const amount = rawAmount !== undefined ? rawAmount / 100 : undefined;

    // Parse vnp_PayDate sang Date object nếu có
    let paymentTime: Date | undefined;
    if (
      query.vnp_PayDate &&
      typeof query.vnp_PayDate === 'string' &&
      query.vnp_PayDate.length === 14
    ) {
      const y = parseInt(query.vnp_PayDate.substring(0, 4), 10);
      const m = parseInt(query.vnp_PayDate.substring(4, 6), 10) - 1;
      const d = parseInt(query.vnp_PayDate.substring(6, 8), 10);
      const h = parseInt(query.vnp_PayDate.substring(8, 10), 10);
      const min = parseInt(query.vnp_PayDate.substring(10, 12), 10);
      const s = parseInt(query.vnp_PayDate.substring(12, 14), 10);
      paymentTime = new Date(Date.UTC(y, m, d, h - 7, min, s));
    }

    return {
      isSuccess,
      isSignatureValid,
      orderCode: query.vnp_TxnRef || '',
      transactionId: query.vnp_TransactionNo || '',
      bankTranNo: query.vnp_BankTranNo || '',
      bankCode: query.vnp_BankCode || '',
      cardType: query.vnp_CardType || '',
      payDate: query.vnp_PayDate || '',
      amount,
      responseCode,
      transactionStatus,
      paymentTime,
      message: !isSignatureValid
        ? 'Chữ ký số VNPay không hợp lệ (Checksum failed)'
        : isSuccess
          ? 'Giao dịch qua VNPay thành công'
          : `Giao dịch không thành công (Mã lỗi: ${responseCode})`,
      rawResponse: query,
    };
  }

  /**
   * 3. Xác thực IPN Webhook từ máy chủ VNPay (Server-to-Server)
   */
  async verifyWebhook(payload: Record<string, any>): Promise<VerifyResult> {
    return this.verifyReturnUrl(payload);
  }
}

export const vnpayProvider = new VNPayProvider();

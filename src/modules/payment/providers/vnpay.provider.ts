// import crypto from 'crypto';
// import {
//   IPaymentProvider,
//   CreatePaymentInput,
//   PaymentUrlOutput,
//   VerifyResult,
// } from './payment-provider.interface';

// export class VNPayProvider implements IPaymentProvider {
//   readonly name = 'VNPAY';

//   private get tmnCode(): string {
//     return process.env.VNPAY_TMN_CODE || 'VNPAYDEMO';
//   }

//   private get hashSecret(): string {
//     return process.env.VNPAY_HASH_SECRET || 'SECRETKEYDEMO1234567890ABCDEFGH';
//   }

//   private get vnpUrl(): string {
//     return (
//       process.env.VNPAY_URL ||
//       'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
//     );
//   }

//   /**
//    * Định dạng ngày giờ theo chuẩn YYYYMMDDHHmmss theo múi giờ Việt Nam (GMT+7)
//    */
//   private formatVnpDate(date: Date): string {
//     const tzOffset = 7 * 60; // GMT+7 tính bằng phút
//     const localTime = new Date(date.getTime() + (tzOffset + date.getTimezoneOffset()) * 60000);

//     const pad = (n: number) => n.toString().padStart(2, '0');
//     const year = localTime.getFullYear();
//     const month = pad(localTime.getMonth() + 1);
//     const day = pad(localTime.getDate());
//     const hours = pad(localTime.getHours());
//     const minutes = pad(localTime.getMinutes());
//     const seconds = pad(localTime.getSeconds());

//     return `${year}${month}${day}${hours}${minutes}${seconds}`;
//   }

//   /**
//    * Sắp xếp object theo thứ tự bảng chữ cái của key
//    */
//   private sortObject(obj: Record<string, any>): Record<string, string> {
//     const sorted: Record<string, string> = {};
//     const keys = Object.keys(obj).sort();
//     for (const key of keys) {
//       const val = obj[key];
//       if (val !== undefined && val !== null && val !== '') {
//         sorted[key] = encodeURIComponent(String(val)).replace(/%20/g, '+');
//       }
//     }
//     return sorted;
//   }

//   /**
//    * 1. Khởi tạo đường dẫn thanh toán VNPay
//    */
//   async createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput> {
//     const createDate = new Date();
//     const expireDate = new Date(createDate.getTime() + 15 * 60 * 1000); // Hết hạn sau 15 phút

//     const returnUrl =
//       input.returnUrl ||
//       `${process.env.CLIENT_URL || 'https://frontend-shop-gamma.vercel.app/'}/checkout/payment-return`;

//     const vnpParams: Record<string, any> = {
//       vnp_Version: '2.1.0',
//       vnp_Command: 'pay',
//       vnp_TmnCode: this.tmnCode,
//       vnp_Locale: 'vn',
//       vnp_CurrCode: 'VND',
//       vnp_TxnRef: input.orderCode,
//       vnp_OrderInfo: input.orderInfo || `Thanh toan don hang ${input.orderCode}`,
//       vnp_OrderType: 'other',
//       vnp_Amount: Math.round(input.amount * 100), // VNPay tính bằng đơn vị đồng * 100
//       vnp_ReturnUrl: returnUrl,
//       vnp_IpAddr: input.ipAddr || '127.0.0.1',
//       vnp_CreateDate: this.formatVnpDate(createDate),
//       vnp_ExpireDate: this.formatVnpDate(expireDate),
//     };

//     const sortedParams = this.sortObject(vnpParams);
//     const signData = Object.entries(sortedParams)
//       .map(([k, v]) => `${k}=${v}`)
//       .join('&');

//     const hmac = crypto.createHmac('sha512', this.hashSecret);
//     const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

//     const paymentUrl = `${this.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;

//     return {
//       paymentUrl,
//       transactionRef: input.orderCode,
//       provider: this.name,
//       extra: {
//         createDate: vnpParams.vnp_CreateDate,
//         expireDate: vnpParams.vnp_ExpireDate,
//       },
//     };
//   }

//   /**
//    * 2. Xác thực chữ ký dữ liệu trả về từ VNPay khi người dùng hoàn tất thanh toán
//    */
//   async verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult> {
//     const secureHash = query.vnp_SecureHash;
//     const cleanParams: Record<string, any> = { ...query };

//     delete cleanParams.vnp_SecureHash;
//     delete cleanParams.vnp_SecureHashType;

//     const sortedParams = this.sortObject(cleanParams);
//     const signData = Object.entries(sortedParams)
//       .map(([k, v]) => `${k}=${v}`)
//       .join('&');

//     const hmac = crypto.createHmac('sha512', this.hashSecret);
//     const checkHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

//     const isSignatureValid = checkHash.toLowerCase() === String(secureHash || '').toLowerCase();
//     const responseCode = query.vnp_ResponseCode;
//     const transactionStatus = query.vnp_TransactionStatus;
//     const isSuccess = isSignatureValid && responseCode === '00' && (transactionStatus === '00' || !transactionStatus);

//     const amount = query.vnp_Amount ? parseInt(query.vnp_Amount, 10) / 100 : undefined;

//     return {
//       isSuccess,
//       orderCode: query.vnp_TxnRef || '',
//       transactionId: query.vnp_TransactionNo || '',
//       amount,
//       bankCode: query.vnp_BankCode || '',
//       cardType: query.vnp_CardType || '',
//       message: isSuccess
//         ? 'Giao dịch qua VNPay thành công'
//         : isSignatureValid
//         ? `Giao dịch không thành công (Mã lỗi: ${responseCode})`
//         : 'Chữ ký số VNPay không hợp lệ (Checksum failed)',
//       rawResponse: query,
//     };
//   }

//   /**
//    * 3. Xác thực IPN Webhook từ máy chủ VNPay
//    */
//   async verifyWebhook(payload: Record<string, any>): Promise<VerifyResult> {
//     return this.verifyReturnUrl(payload);
//   }
// }

// export const vnpayProvider = new VNPayProvider();


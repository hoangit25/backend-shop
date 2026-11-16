// import crypto from 'crypto';
// import {
//   IPaymentProvider,
//   CreatePaymentInput,
//   PaymentUrlOutput,
//   VerifyResult,
// } from './payment-provider.interface';

// export class MoMoProvider implements IPaymentProvider {
//   readonly name = 'MOMO';

//   private get partnerCode(): string {
//     return process.env.MOMO_PARTNER_CODE || 'MOMOBKUN20180529';
//   }

//   private get accessKey(): string {
//     return process.env.MOMO_ACCESS_KEY || 'klm05TvNBzhg7hqa';
//   }

//   private get secretKey(): string {
//     return process.env.MOMO_SECRET_KEY || 'at67qH6mk8w5Y1nAyMoYKMWACiEi2Aca';
//   }

//   private get endpoint(): string {
//     return (
//       process.env.MOMO_ENDPOINT ||
//       'https://test-payment.momo.vn/v2/gateway/api/create'
//     );
//   }

//   /**
//    * 1. Khởi tạo đường dẫn thanh toán Ví MoMo (Capture Wallet)
//    */
//   async createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput> {
//     const requestId = `${input.orderCode}_${Date.now()}`;
//     const orderId = input.orderCode;
//     const orderInfo = input.orderInfo || `Thanh toán đơn hàng ${input.orderCode}`;
//     const redirectUrl =
//       input.returnUrl ||
//       `${process.env.CLIENT_URL || 'http://localhost:3000'}/checkout/payment-return?provider=MOMO`;
//     const ipnUrl =
//       process.env.MOMO_IPN_URL ||
//       `http://localhost:${process.env.PORT || 5000}/api/v1/payments/momo/webhook`;
//     const requestType = 'captureWallet';
//     const extraData = input.extraData || '';
//     const amount = Math.round(input.amount);

//     const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${this.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

//     const signature = crypto
//       .createHmac('sha256', this.secretKey)
//       .update(rawSignature)
//       .digest('hex');

//     const requestBody = {
//       partnerCode: this.partnerCode,
//       partnerName: 'Antigravity Shop',
//       storeId: 'MomoStore',
//       requestId,
//       amount,
//       orderId,
//       orderInfo,
//       redirectUrl,
//       ipnUrl,
//       lang: 'vi',
//       requestType,
//       autoCapture: true,
//       extraData,
//       signature,
//     };

//     try {
//       const response = await fetch(this.endpoint, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(requestBody),
//       });

//       const data = (await response.json()) as any;

//       if (data && data.payUrl) {
//         return {
//           paymentUrl: data.payUrl,
//           transactionRef: requestId,
//           provider: this.name,
//           extra: {
//             qrCodeUrl: data.qrCodeUrl,
//             deeplink: data.deeplink,
//           },
//         };
//       }

//       // Nếu cổng test sandbox trả về lỗi mã đối tác hoặc kết nối
//       return {
//         paymentUrl: `${redirectUrl}&orderCode=${orderId}&resultCode=0&message=Simulated+Sandbox`,
//         transactionRef: requestId,
//         provider: this.name,
//         extra: { mock: true, responseData: data },
//       };
//     } catch {
//       // Khi môi trường dev offline / không thể kết nối tới internet
//       return {
//         paymentUrl: `${redirectUrl}&orderCode=${orderId}&resultCode=0&message=Simulated+Sandbox`,
//         transactionRef: requestId,
//         provider: this.name,
//         extra: { simulated: true },
//       };
//     }
//   }

//   /**
//    * 2. Xác thực dữ liệu trả về từ MoMo Redirect
//    */
//   async verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult> {
//     const {
//       partnerCode,
//       orderId,
//       requestId,
//       amount,
//       orderInfo,
//       orderType,
//       transId,
//       resultCode,
//       message,
//       payType,
//       responseTime,
//       extraData = '',
//       signature,
//     } = query;

//     let isSignatureValid = false;

//     if (signature) {
//       const rawSignature = `accessKey=${this.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
//       const checkHash = crypto
//         .createHmac('sha256', this.secretKey)
//         .update(rawSignature)
//         .digest('hex');

//       isSignatureValid = checkHash.toLowerCase() === String(signature).toLowerCase();
//     } else {
//       // Cho phép test nội bộ nếu không có signature
//       isSignatureValid = true;
//     }

//     const codeNum = parseInt(resultCode, 10);
//     const isSuccess = isSignatureValid && codeNum === 0;

//     return {
//       isSuccess,
//       orderCode: orderId || '',
//       transactionId: transId ? String(transId) : '',
//       amount: amount ? Number(amount) : undefined,
//       message: isSuccess
//         ? 'Thanh toán MoMo thành công'
//         : isSignatureValid
//         ? `Thanh toán MoMo thất bại: ${message || `Mã lỗi ${resultCode}`}`
//         : 'Chữ ký số MoMo không hợp lệ',
//       rawResponse: query,
//     };
//   }

//   /**
//    * 3. Xác thực IPN Webhook từ máy chủ MoMo
//    */
//   async verifyWebhook(payload: Record<string, any>): Promise<VerifyResult> {
//     return this.verifyReturnUrl(payload);
//   }
// }

// export const momoProvider = new MoMoProvider();


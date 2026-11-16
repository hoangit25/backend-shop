// import {
//   IPaymentProvider,
//   CreatePaymentInput,
//   PaymentUrlOutput,
//   VerifyResult,
// } from './payment-provider.interface';

// export class CODProvider implements IPaymentProvider {
//   readonly name = 'COD';

//   async createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput> {
//     const returnUrl =
//       input.returnUrl ||
//       `${process.env.CLIENT_URL || 'http://localhost:3000'}/checkout/success?orderCode=${input.orderCode}&paymentMethod=COD`;

//     return {
//       paymentUrl: returnUrl,
//       transactionRef: `COD_${input.orderCode}`,
//       provider: this.name,
//       extra: {
//         instructions: 'Thanh toán trực tiếp bằng tiền mặt khi nhận hàng (COD).',
//       },
//     };
//   }

//   async verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult> {
//     const orderCode = (query.orderCode as string) || '';
//     return {
//       isSuccess: true,
//       orderCode,
//       message: 'Phương thức thanh toán khi nhận hàng (COD) đã được ghi nhận.',
//       rawResponse: query,
//     };
//   }

//   async verifyWebhook(payload: Record<string, any>): Promise<VerifyResult> {
//     const orderCode = (payload.orderCode as string) || '';
//     return {
//       isSuccess: true,
//       orderCode,
//       message: 'Xác nhận đơn hàng COD thành công.',
//       rawResponse: payload,
//     };
//   }
// }

// export const codProvider = new CODProvider();


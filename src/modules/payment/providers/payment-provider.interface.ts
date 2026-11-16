// export interface CreatePaymentInput {
//   orderId: string;
//   orderCode: string;
//   amount: number;
//   orderInfo: string;
//   ipAddr: string;
//   returnUrl?: string;
//   cancelUrl?: string;
//   extraData?: string;
// }

// export interface PaymentUrlOutput {
//   paymentUrl: string;
//   transactionRef: string;
//   provider: string;
//   extra?: any;
// }

// export interface VerifyResult {
//   isSuccess: boolean;
//   orderCode: string;
//   transactionId?: string;
//   amount?: number;
//   message: string;
//   bankCode?: string;
//   cardType?: string;
//   paymentTime?: Date;
//   rawResponse: any;
// }

// export interface IPaymentProvider {
//   readonly name: string;
//   createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput>;
//   verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult>;
//   verifyWebhook(payload: Record<string, any>): Promise<VerifyResult>;
// }


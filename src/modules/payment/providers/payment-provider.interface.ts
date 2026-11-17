export interface CreatePaymentInput {
  orderId: string;
  orderCode: string;
  amount: number;
  orderInfo: string;
  ipAddr: string;
  returnUrl?: string;
  cancelUrl?: string;
  extraData?: string;
}

export interface PaymentUrlOutput {
  paymentUrl: string;
  transactionRef: string;
  provider: string;
  extra?: any;
}

export interface VerifyResult {
  isSuccess: boolean;
  isSignatureValid: boolean;
  orderCode: string;
  transactionId?: string; // vnp_TransactionNo trên VNPay Sandbox
  bankTranNo?: string;    // vnp_BankTranNo tại Ngân hàng
  bankCode?: string;      // vnp_BankCode (NCB, VCB, VISA,...)
  cardType?: string;      // vnp_CardType (ATM, QRCODE,...)
  payDate?: string;       // vnp_PayDate (YYYYMMDDHHmmss)
  amount?: number;        // Số tiền thực tế (VND)
  responseCode?: string;  // vnp_ResponseCode
  transactionStatus?: string; // vnp_TransactionStatus
  message: string;
  paymentTime?: Date;
  rawResponse: any;
}

export interface IPaymentProvider {
  readonly name: string;
  createPaymentUrl(input: CreatePaymentInput): Promise<PaymentUrlOutput>;
  verifyReturnUrl(query: Record<string, any>): Promise<VerifyResult>;
  verifyWebhook(payload: Record<string, any>): Promise<VerifyResult>;
}

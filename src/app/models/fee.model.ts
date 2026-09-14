export interface FeeHeadItem {
  feeHeadName: string;
  originalAmount: number;
  revisedAmount: number;
  collectedAmount?: number;
  headCount?: number;
}

export interface PaymentLedgerRow {
  paymentId: number;
  challanNo: string;
  challanDate?: string;
  amountPaid: number;
  paymentModeName?: string;
  paymentDate?: string;
  receiptNo?: string;
  bankName?: string;
  chequeOrDdno?: string;
  gatewayTxnId?: string;
  status: 'Success' | 'Pending' | 'Void' | 'Failed' | string;
  remarks?: string;
  createdAt?: string;
  openingBalance: number;
  closingBalance: number;
}

export interface FeeDemandItem {
  studentDemandId: number;
  demandId?: number;
  demandTitle: string;
  demandCode?: string;
  collegeName?: string;
  courseName?: string;
  sessionName?: string;
  openDate?: string;
  closeDate?: string;
  appliedDate?: string;
  demandAmount: number;
  openingBalance?: number;
  totalAmount: number;
  amountPaid: number;
  balanceAmount: number;
  paymentStatus: 'Paid' | 'Partial' | 'Pending' | string;
  isArrears: boolean;
  payBlocked: boolean;
  payBlockedReason?: string | null;
  feeHeads: FeeHeadItem[];
  payments: PaymentLedgerRow[];
}

export interface StudentFeeOverview {
  studentId: number;
  grandTotalDemand: number;
  grandTotalPaid: number;
  grandBalance: number;
  outstandingArrears: number;
  demands: FeeDemandItem[];
  /** Calculated mobile status: 'not_assessed' | 'arrears_pending' | 'due' | 'cleared' */
  assessmentState: 'not_assessed' | 'arrears_pending' | 'due' | 'cleared';
}

export interface StudentTransactionItem {
  slnum: number;
  merchantTxnNo: string;
  amount: number;
  status: string;
  gatewayTxnNo?: string;
  responseCode?: string;
  txnDate: string;
  completedAt?: string;
  studentDemandId?: number;
  demandTitle?: string;
  demandCode?: string;
  totalDemand?: number;
  balanceAmount?: number;
  paymentId?: number;
}

export interface FeeReceiptDetail {
  paymentId: number;
  receiptNo: string;
  challanNo: string;
  paymentDate: string;
  paymentModeName: string;
  amountPaid: number;
  studentName: string;
  usn?: string;
  courseName?: string;
  sessionName?: string;
  demandTitle?: string;
  bankName?: string;
  gatewayTxnId?: string;
  heads?: { headName: string; amount: number }[];
}

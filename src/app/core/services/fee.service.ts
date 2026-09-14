import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import {
  StudentFeeOverview,
  FeeDemandItem,
  StudentTransactionItem,
  FeeReceiptDetail
} from '../../models/fee.model';

@Injectable({ providedIn: 'root' })
export class FeeService {
  constructor(private http: HttpClient) {}

  /**
   * Fetch all fee demands, payments, and outstanding balances for a student.
   * Enforces the critical parity rule: If no demands exist (demands.length === 0),
   * assessmentState is set to 'not_assessed' and must never be shown as '₹0 Fully Paid'.
   */
  getMyFees(studentId: number): Observable<StudentFeeOverview> {
    return this.http.get<any>(`${environment.apiUrl}StudentDemandPayment/myfees/${studentId}`).pipe(
      map(data => {
        const grandTotalDemand = Number(data?.grandTotalDemand ?? 0);
        const grandTotalPaid   = Number(data?.grandTotalPaid ?? 0);
        const grandBalance     = Number(data?.grandBalance ?? 0);
        const outstandingArrears = Number(data?.outstandingArrears ?? 0);
        const rawDemands: any[] = Array.isArray(data?.demands) ? data.demands : [];

        const demands: FeeDemandItem[] = rawDemands.map(d => ({
          studentDemandId: d.studentDemandId,
          demandId: d.demandId,
          demandTitle: d.demandTitle || 'Fee Demand',
          demandCode: d.demandCode || '',
          collegeName: d.collegeName || '',
          courseName: d.courseName || '',
          sessionName: d.sessionName || '',
          openDate: d.openDate || '',
          closeDate: d.closeDate || '',
          appliedDate: d.appliedDate || '',
          demandAmount: Number(d.demandAmount ?? 0),
          openingBalance: Number(d.openingBalance ?? 0),
          totalAmount: Number(d.totalAmount ?? 0),
          amountPaid: Number(d.amountPaid ?? 0),
          balanceAmount: Number(d.balanceAmount ?? 0),
          paymentStatus: d.paymentStatus || 'Pending',
          isArrears: !!d.isArrears,
          payBlocked: !!d.payBlocked,
          payBlockedReason: d.payBlockedReason || null,
          feeHeads: Array.isArray(d.feeHeads) ? d.feeHeads.map((h: any) => ({
            feeHeadName: h.feeHeadName || 'Fee Head',
            originalAmount: Number(h.originalAmount ?? 0),
            revisedAmount: Number(h.revisedAmount ?? 0),
            collectedAmount: Number(h.collectedAmount ?? 0),
            headCount: Number(h.headCount ?? 1)
          })) : [],
          payments: Array.isArray(d.payments) ? d.payments.map((p: any) => ({
            paymentId: p.paymentId,
            challanNo: p.challanNo || '—',
            challanDate: p.challanDate,
            amountPaid: Number(p.amountPaid ?? 0),
            paymentModeName: p.paymentModeName || 'Online',
            paymentDate: p.paymentDate,
            receiptNo: p.receiptNo || '—',
            bankName: p.bankName,
            chequeOrDdno: p.chequeOrDdno,
            gatewayTxnId: p.gatewayTxnId,
            status: p.status || 'Success',
            remarks: p.remarks,
            createdAt: p.createdAt,
            openingBalance: Number(p.openingBalance ?? 0),
            closingBalance: Number(p.closingBalance ?? 0)
          })) : []
        }));

        let assessmentState: 'not_assessed' | 'arrears_pending' | 'due' | 'cleared';
        if (demands.length === 0) {
          assessmentState = 'not_assessed';
        } else if (outstandingArrears > 0) {
          assessmentState = 'arrears_pending';
        } else if (grandBalance <= 0) {
          assessmentState = 'cleared';
        } else {
          assessmentState = 'due';
        }

        return {
          studentId,
          grandTotalDemand,
          grandTotalPaid,
          grandBalance,
          outstandingArrears,
          demands,
          assessmentState
        };
      }),
      catchError(err => {
        console.error('Error fetching student fee overview:', err);
        return of({
          studentId,
          grandTotalDemand: 0,
          grandTotalPaid: 0,
          grandBalance: 0,
          outstandingArrears: 0,
          demands: [],
          assessmentState: 'not_assessed' as const
        });
      })
    );
  }

  /**
   * Fetch all payment attempts / gateway logs for student.
   */
  getMyTransactions(studentId: number): Observable<StudentTransactionItem[]> {
    return this.http.get<any[]>(`${environment.apiUrl}Payment/my-transactions/${studentId}`).pipe(
      map(items => {
        if (!Array.isArray(items)) return [];
        return items.map(t => ({
          slnum: t.slnum,
          merchantTxnNo: t.merchantTxnNo || '—',
          amount: Number(t.amount ?? 0),
          status: t.status || 'Unknown',
          gatewayTxnNo: t.gatewayTxnNo,
          responseCode: t.responseCode,
          txnDate: t.txnDate,
          completedAt: t.completedAt,
          studentDemandId: t.studentDemandId,
          demandTitle: t.demandTitle,
          demandCode: t.demandCode,
          totalDemand: t.totalDemand != null ? Number(t.totalDemand) : undefined,
          balanceAmount: t.balanceAmount != null ? Number(t.balanceAmount) : undefined,
          paymentId: t.paymentId
        }));
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch structured receipt detail for a given payment ID.
   */
  getFeeReceipt(paymentId: number): Observable<FeeReceiptDetail | null> {
    return this.http.get<any>(`${environment.apiUrl}StudentDemandPayment/receipt/${paymentId}`).pipe(
      map(data => {
        if (!data) return null;
        return {
          paymentId: data.paymentId || paymentId,
          receiptNo: data.receiptNo || '—',
          challanNo: data.challanNo || '—',
          paymentDate: data.paymentDate || data.createdAt || '',
          paymentModeName: data.paymentModeName || data.paymentMode || 'Online',
          amountPaid: Number(data.amountPaid ?? data.amount ?? 0),
          studentName: data.studentName || data.studentFullName || 'Student',
          usn: data.usn || data.studentUsn || '',
          courseName: data.courseName || '',
          sessionName: data.sessionName || '',
          demandTitle: data.demandTitle || '',
          bankName: data.bankName || '',
          gatewayTxnId: data.gatewayTxnId || '',
          heads: Array.isArray(data.heads) ? data.heads : []
        };
      }),
      catchError(() => of(null))
    );
  }
}

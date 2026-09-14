import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { FeeService } from '../../core/services/fee.service';
import {
  StudentFeeOverview,
  FeeDemandItem,
  StudentTransactionItem,
  FeeReceiptDetail,
  PaymentLedgerRow
} from '../../models/fee.model';

@Component({
  selector: 'app-fees',
  templateUrl: './fees.page.html',
  styleUrls: ['./fees.page.scss'],
  standalone: false
})
export class FeesPage implements OnInit {
  studentId = 0;
  studentName = '';
  selectedSegment: 'demands' | 'transactions' = 'demands';

  loading = true;
  error = false;
  overview: StudentFeeOverview | null = null;
  transactions: StudentTransactionItem[] = [];

  expandedDemands: { [demandId: number]: boolean } = {};

  // Receipt Modal
  showReceiptModal = false;
  selectedReceipt: FeeReceiptDetail | null = null;
  loadingReceipt = false;

  constructor(
    private authService: AuthService,
    private feeService: FeeService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(
      filter(u => !!u),
      take(1)
    ).subscribe(u => {
      this.studentId = u!.userId;
      this.studentName = u!.fullName || `${u!.firstName || ''} ${u!.lastName || ''}`.trim() || 'Student';
      this.loadFeeData();
    });
  }

  loadFeeData(event?: any) {
    if (!this.studentId) {
      this.loading = false;
      event?.target?.complete();
      return;
    }

    this.loading = !event;
    this.error = false;

    this.feeService.getMyFees(this.studentId).subscribe({
      next: (data) => {
        this.overview = data;
        this.loading = false;

        // Auto-expand unpaid arrears or single demand
        this.expandedDemands = {};
        if (data.demands.length > 0) {
          const arrears = data.demands.find(d => d.isArrears && d.balanceAmount > 0);
          if (arrears) {
            this.expandedDemands[arrears.studentDemandId] = true;
          } else if (data.demands.length === 1) {
            this.expandedDemands[data.demands[0].studentDemandId] = true;
          }
        }

        // Also fetch transactions in background
        this.feeService.getMyTransactions(this.studentId).subscribe({
          next: txns => {
            this.transactions = txns;
            event?.target?.complete();
          },
          error: () => event?.target?.complete()
        });
      },
      error: () => {
        this.loading = false;
        this.error = true;
        event?.target?.complete();
        this.showToast('Unable to load fee records. Please retry.', 'danger');
      }
    });
  }

  toggleDemand(id: number) {
    this.expandedDemands[id] = !this.expandedDemands[id];
  }

  isExpanded(id: number): boolean {
    return !!this.expandedDemands[id];
  }

  getOverallPercent(): number {
    if (!this.overview || this.overview.grandTotalDemand <= 0) return 0;
    return Math.min(100, Math.round((this.overview.grandTotalPaid / this.overview.grandTotalDemand) * 100));
  }

  getDemandPercent(demand: FeeDemandItem): number {
    if (!demand.totalAmount || demand.totalAmount <= 0) return 0;
    return Math.min(100, Math.round((demand.amountPaid / demand.totalAmount) * 100));
  }

  viewReceipt(payment: PaymentLedgerRow, demand: FeeDemandItem) {
    if (!payment.paymentId) {
      // Create instant fallback detail from payment row
      this.selectedReceipt = {
        paymentId: 0,
        receiptNo: payment.receiptNo || payment.challanNo,
        challanNo: payment.challanNo,
        paymentDate: payment.paymentDate || payment.createdAt || new Date().toISOString(),
        paymentModeName: payment.paymentModeName || 'Online',
        amountPaid: payment.amountPaid,
        studentName: this.studentName,
        courseName: demand.courseName,
        sessionName: demand.sessionName,
        demandTitle: demand.demandTitle,
        bankName: payment.bankName,
        gatewayTxnId: payment.gatewayTxnId
      };
      this.showReceiptModal = true;
      return;
    }

    this.loadingReceipt = true;
    this.feeService.getFeeReceipt(payment.paymentId).subscribe({
      next: receipt => {
        this.loadingReceipt = false;
        if (receipt) {
          this.selectedReceipt = receipt;
        } else {
          this.selectedReceipt = {
            paymentId: payment.paymentId,
            receiptNo: payment.receiptNo || payment.challanNo,
            challanNo: payment.challanNo,
            paymentDate: payment.paymentDate || payment.createdAt || '',
            paymentModeName: payment.paymentModeName || 'Online',
            amountPaid: payment.amountPaid,
            studentName: this.studentName,
            courseName: demand.courseName,
            sessionName: demand.sessionName,
            demandTitle: demand.demandTitle,
            bankName: payment.bankName,
            gatewayTxnId: payment.gatewayTxnId
          };
        }
        this.showReceiptModal = true;
      },
      error: () => {
        this.loadingReceipt = false;
        this.selectedReceipt = {
          paymentId: payment.paymentId,
          receiptNo: payment.receiptNo || payment.challanNo,
          challanNo: payment.challanNo,
          paymentDate: payment.paymentDate || payment.createdAt || '',
          paymentModeName: payment.paymentModeName || 'Online',
          amountPaid: payment.amountPaid,
          studentName: this.studentName,
          courseName: demand.courseName,
          sessionName: demand.sessionName,
          demandTitle: demand.demandTitle,
          bankName: payment.bankName,
          gatewayTxnId: payment.gatewayTxnId
        };
        this.showReceiptModal = true;
      }
    });
  }

  closeReceiptModal() {
    this.showReceiptModal = false;
    this.selectedReceipt = null;
  }

  statusClass(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'paid' || s === 'success') return 'badge-paid';
    if (s === 'partial') return 'badge-partial';
    if (s === 'void' || s === 'failed') return 'badge-void';
    return 'badge-pending';
  }

  async showToast(message: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      position: 'bottom',
      color
    });
    await toast.present();
  }
}

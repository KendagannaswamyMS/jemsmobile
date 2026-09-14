import { Component, OnInit } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUser } from '../../models/user.model';

export interface DocCatalogItem {
  id: number;
  code: string;
  name: string;
  category: string;
  feePerCopy: number;
  deliveryEstimate: string;
  requirements: string[];
}

export interface RequestRecord {
  trackingId: string;
  docName: string;
  requestedOn: string;
  copies: number;
  totalFee: number;
  status: 'Submitted' | 'Verification' | 'Prepared' | 'Dispatched' | 'Delivered';
  deliveryMode: 'Courier' | 'Counter Collection';
}

@Component({
  selector: 'app-doc-request',
  templateUrl: './doc-request.page.html',
  styleUrls: ['./doc-request.page.scss'],
  standalone: false
})
export class DocRequestPage implements OnInit {
  user: CurrentUser | null = null;
  activeSegment: 'catalog' | 'track' = 'catalog';

  // Tracking query
  searchTrackingId = '';
  searchedRecord: RequestRecord | null = null;
  hasTracked = false;

  // New application state
  selectedDoc: DocCatalogItem | null = null;
  copiesCount = 1;
  deliveryMode: 'Courier' | 'Counter Collection' = 'Courier';
  courierFee = 150;
  isSubmitting = false;

  readonly catalog: DocCatalogItem[] = [
    {
      id: 1,
      code: 'PDC-01',
      name: 'Provisional Degree Certificate (PDC)',
      category: 'Graduation',
      feePerCopy: 1000,
      deliveryEstimate: '3-5 Working Days',
      requirements: ['All semester grade cards', 'No-dues clearance', 'Government ID copy']
    },
    {
      id: 2,
      code: 'TRN-02',
      name: 'Official Academic Transcripts',
      category: 'Transcripts & WES',
      feePerCopy: 1600,
      deliveryEstimate: '7-10 Working Days',
      requirements: ['Grade cards set', 'PDC or Degree Certificate', 'Application letter']
    },
    {
      id: 3,
      code: 'CGC-03',
      name: 'Consolidated Grade Card',
      category: 'Grade Cards',
      feePerCopy: 1200,
      deliveryEstimate: '5 Working Days',
      requirements: ['All Semester Grade Cards', 'Clearance Certificate']
    },
    {
      id: 4,
      code: 'MOI-04',
      name: 'Medium of Instruction Certificate (English)',
      category: 'Certifications',
      feePerCopy: 500,
      deliveryEstimate: '2-3 Working Days',
      requirements: ['Degree Certificate / ID copy']
    },
    {
      id: 5,
      code: 'DUP-05',
      name: 'Duplicate Grade Card (Single Sem)',
      category: 'Grade Cards',
      feePerCopy: 600,
      deliveryEstimate: '5 Working Days',
      requirements: ['Police FIR / Affidavit copy', 'Identity proof']
    }
  ];

  // Mock historical records for the account
  myRequests: RequestRecord[] = [
    {
      trackingId: 'JST-DOC-2026-8841',
      docName: 'Provisional Degree Certificate (PDC)',
      requestedOn: '10-Sep-2026',
      copies: 1,
      totalFee: 1150,
      status: 'Prepared',
      deliveryMode: 'Courier'
    }
  ];

  constructor(
    public authService: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
  }

  get isAlumni(): boolean {
    return this.authService.isDocRequestOnly();
  }

  get estimatedTotal(): number {
    if (!this.selectedDoc) return 0;
    const docTotal = this.selectedDoc.feePerCopy * this.copiesCount;
    const shipping = this.deliveryMode === 'Courier' ? this.courierFee : 0;
    return docTotal + shipping;
  }

  openApplyModal(doc: DocCatalogItem) {
    this.selectedDoc = doc;
    this.copiesCount = 1;
    this.deliveryMode = 'Courier';
  }

  closeApplyModal() {
    this.selectedDoc = null;
  }

  incrementCopies() {
    if (this.copiesCount < 5) this.copiesCount++;
  }

  decrementCopies() {
    if (this.copiesCount > 1) this.copiesCount--;
  }

  async submitDocRequest() {
    if (!this.selectedDoc) return;
    this.isSubmitting = true;

    setTimeout(async () => {
      this.isSubmitting = false;
      const newRef = `JST-DOC-2026-${Math.floor(1000 + Math.random() * 9000)}`;
      const record: RequestRecord = {
        trackingId: newRef,
        docName: this.selectedDoc!.name,
        requestedOn: 'Today',
        copies: this.copiesCount,
        totalFee: this.estimatedTotal,
        status: 'Submitted',
        deliveryMode: this.deliveryMode
      };
      this.myRequests.unshift(record);
      this.closeApplyModal();

      const toast = await this.toastCtrl.create({
        message: `Application submitted! Tracking Ref: ${newRef}`,
        duration: 5000,
        color: 'success',
        position: 'top'
      });
      toast.present();
    }, 1200);
  }

  trackApplication() {
    const q = this.searchTrackingId.trim().toUpperCase();
    this.hasTracked = true;
    if (!q) {
      this.searchedRecord = null;
      return;
    }
    const found = this.myRequests.find(r => r.trackingId.toUpperCase() === q);
    this.searchedRecord = found || null;
  }
}

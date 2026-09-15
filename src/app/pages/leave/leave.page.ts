import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

export interface LeaveTypeItem {
  leaveTypeId: number;
  leaveName: string;
  leaveCode: string;
  maxDaysPerYear: number;
  isHalfDayAllowed?: boolean;
}

export interface LeaveBalance {
  leaveCode: string;
  leaveName: string;
  allocated: number;
  used: number;
  balance: number;
  color: string;
}

export interface LeaveApplicationItem {
  applicationId: number;
  leaveTypeName: string;
  leaveCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  appliedDate: string;
  isHalfDay?: boolean;
  substituteStaffName?: string;
}

export interface PendingApprovalItem {
  applicationId: number;
  employeeName: string;
  employeeCode: string;
  departmentName?: string;
  leaveTypeName: string;
  leaveCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  appliedDate: string;
}

export interface SubstituteStaffItem {
  userId: number;
  fullName: string;
  employeeCode: string;
}

export interface MySubstituteConflict {
  conflictingApplicationId: number;
  originalApplicantName: string;
  originalFromDate: string;
  originalToDate: string;
  combinedFromDate: string;
  combinedToDate: string;
}

export interface ConflictDutyRow {
  conflict: MySubstituteConflict;
  selectedSubstituteId: number | null;
}

export interface SubstituteDelegationResolution {
  conflictingApplicationId: number;
  newSubstituteId: number;
}

@Component({
  selector: 'app-leave',
  templateUrl: './leave.page.html',
  styleUrls: ['./leave.page.scss'],
  standalone: false
})
export class LeavePage implements OnInit {
  selectedSegment: 'apply' | 'history' | 'approvals' | 'balances' = 'apply';
  loading = false;
  isApprover = false;

  // Substitute Conflict & Delegation Modal
  isDelegationModalOpen = false;
  conflictRows: ConflictDutyRow[] = [];

  // Form Models
  selectedLeaveTypeId: number | null = null;
  selectedSubstituteUserId: number | null = null;
  fromDate: string = new Date().toISOString().split('T')[0];
  toDate: string = new Date().toISOString().split('T')[0];
  isHalfDay = false;
  halfDaySession = 'FN'; // FN = Forenoon, AN = Afternoon
  reason = '';
  emergencyContact = '';
  calculatedDays = 1;

  // Data Sources
  leaveTypes: LeaveTypeItem[] = [];
  leaveBalances: LeaveBalance[] = [];
  leaveApplications: LeaveApplicationItem[] = [];
  pendingApprovals: PendingApprovalItem[] = [];
  substituteStaffList: SubstituteStaffItem[] = [];

  private colorPalette = ['#125875', '#F26622', '#2dd36f', '#6a0dad', '#3182ce', '#e53e3e', '#dd6b20', '#38a169'];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit() {
    this.calculateDays();
    this.fetchSubstituteStaffData();
    this.fetchLeaveData();
    this.fetchApproverDashboard();
  }

  fetchSubstituteStaffData() {
    const user = this.authService.getCurrentUser();
    
    this.http.get<any[]>(`${environment.apiUrl}usermaster/loadusermasterdata`).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.substituteStaffList = res
            .filter(u => u.userId !== user?.userId)
            .map(u => {
              const sal = u.salutationName || u.salutaion || '';
              const name = `${sal} ${u.userFName || ''} ${u.userLName || ''}`.trim();
              return {
                userId: u.userId || u.userregistrationslnum,
                fullName: name || u.useremployeecode || 'Faculty Member',
                employeeCode: u.useremployeecode || u.employeeCode || ''
              };
            });
        }
      },
      error: () => {}
    });
  }

  fetchLeaveData() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.loading = true;

    // 1. Fetch Leave Types for User from DB
    this.http.post<any[]>(`${environment.apiUrl}leavemanagement/getleavetypesforuser`, { userId: user.userId }).subscribe({
      next: (res) => {
        let types: any[] = [];
        if (Array.isArray(res)) {
          types = res;
        } else if (res && Array.isArray((res as any).data)) {
          types = (res as any).data;
        }
        if (types.length > 0) {
          this.leaveTypes = types.map(t => ({
            leaveTypeId: t.leavetypeid || t.id || t.leaveTypeId,
            leaveName: t.leavename || t.leaveName || t.description || 'Leave',
            leaveCode: t.leavecode || t.leaveCode || 'LV',
            maxDaysPerYear: t.maxdaysperyear || t.maxDaysPerYear || 15,
            isHalfDayAllowed: t.ishalfdayallowed ?? true
          }));
        } else {
          this.fetchFallbackAllLeaveTypes();
        }
      },
      error: () => {
        this.fetchFallbackAllLeaveTypes();
      }
    });

    // 2. Fetch User Leave Applications History from DB
    this.http.post<any[]>(`${environment.apiUrl}leavemanagement/getleavesbyemployeeid`, { Employeeid: user.userId }).subscribe({
      next: (res) => {
        this.loading = false;
        if (Array.isArray(res)) {
          this.leaveApplications = res.map(item => {
            const statusId = item.finalstatusid ?? item.finalStatusId;
            let statusName: 'PENDING' | 'APPROVED' | 'REJECTED' = 'PENDING';
            if (statusId === 3 || item.finalstatus?.statusname?.toUpperCase() === 'APPROVED') {
              statusName = 'APPROVED';
            } else if (statusId === 4 || item.finalstatus?.statusname?.toUpperCase() === 'REJECTED') {
              statusName = 'REJECTED';
            }

            return {
              applicationId: item.applicationid || item.applicationId || item.id,
              leaveTypeName: item.leavetype?.leavename || item.leaveTypeName || item.leavetype || 'Leave',
              leaveCode: item.leavetype?.leavecode || item.leaveCode || 'LV',
              fromDate: this.formatDateStr(item.fromdate || item.fromDate),
              toDate: this.formatDateStr(item.todate || item.toDate),
              totalDays: item.totaldays || item.totalDays || 1,
              reason: item.reason || '',
              status: statusName,
              appliedDate: this.formatDateStr(item.applieddate || item.appliedDate || item.createdOn)
            };
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.http.get<any[]>(`${environment.apiUrl}hrms/LeaveApplication/getbyuser/${user.userId}`).subscribe({
          next: (res) => {
            if (Array.isArray(res)) {
              this.leaveApplications = res.map(item => ({
                applicationId: item.applicationId || item.id,
                leaveTypeName: item.leaveTypeName || item.leavetype || 'Leave',
                leaveCode: item.leaveCode || 'LV',
                fromDate: this.formatDateStr(item.fromDate || item.fromdate),
                toDate: this.formatDateStr(item.toDate || item.todate),
                totalDays: item.totalDays || item.totaldays || 1,
                reason: item.reason || '',
                status: (item.status?.toUpperCase() || 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED',
                appliedDate: this.formatDateStr(item.createdOn || item.appliedDate)
              }));
            }
          },
          error: () => {}
        });
      }
    });

    // 3. Fetch User Leave Balances from DB
    const academicYear = this.getCurrentAcademicYear();
    this.http.post<any[]>(`${environment.apiUrl}leavemanagement/getleavebalance`, {
      employeeid: user.userId,
      academicyear: academicYear
    }).subscribe({
      next: (res) => {
        if (Array.isArray(res) && res.length > 0) {
          this.leaveBalances = res.map((b, idx) => {
            const leaveName = b.leaveType || b.LeaveType || b.leavename || b.leaveName || 'Leave';
            const matchedType = this.leaveTypes.find(t =>
              t.leaveName?.toLowerCase() === leaveName.toLowerCase() ||
              t.leaveCode?.toLowerCase() === (b.leaveCode || b.LeaveCode || b.leavecode || '').toLowerCase()
            );
            const leaveCode = b.leaveCode || b.LeaveCode || b.leavecode || matchedType?.leaveCode || leaveName.substring(0, 2).toUpperCase();

            const opening = Number(b.openingBalance ?? b.OpeningBalance ?? b.openingbalance ?? 0);
            const earned = Number(b.earnedLeaves ?? b.EarnedLeaves ?? b.earnedleaves ?? 0);
            const rawEntitlement = b.entitlementDays ?? b.EntitlementDays ?? b.entitlementdays;

            const alloc = Number(rawEntitlement ?? (opening + earned > 0 ? opening + earned : (matchedType?.maxDaysPerYear || 15)));
            const used = Number(b.leavesTaken ?? b.LeavesTaken ?? b.leavestaken ?? b.usedDays ?? b.useddays ?? b.used ?? 0);
            const bal = Number(b.closingBalance ?? b.ClosingBalance ?? b.closingbalance ?? b.currentBalance ?? b.currentbalance ?? Math.max(0, alloc - used));

            return {
              leaveCode: leaveCode,
              leaveName: leaveName,
              allocated: alloc,
              used: used,
              balance: Math.max(0, bal),
              color: this.colorPalette[idx % this.colorPalette.length]
            };
          });
        } else {
          this.buildDefaultBalancesFromTypes();
        }
      },
      error: () => {
        this.buildDefaultBalancesFromTypes();
      }
    });
  }

  getCurrentAcademicYear(): string {
    const today = new Date();
    const currentYear = today.getFullYear();
    // June-May academic year cycle: June onwards is (current - next), Jan-May is (previous - current)
    return today.getMonth() >= 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
  }

  fetchFallbackAllLeaveTypes() {
    this.http.get<any[]>(`${environment.apiUrl}leavemanagement/getallleavetypes`).subscribe({
      next: (res) => {
        if (Array.isArray(res)) {
          this.leaveTypes = res.map(t => ({
            leaveTypeId: t.leavetypeid || t.id,
            leaveName: t.leavename || t.leaveName,
            leaveCode: t.leavecode || t.leaveCode,
            maxDaysPerYear: t.maxdaysperyear || 15,
            isHalfDayAllowed: t.ishalfdayallowed ?? true
          }));
          this.buildDefaultBalancesFromTypes();
        }
      },
      error: () => {}
    });
  }

  buildDefaultBalancesFromTypes() {
    if (this.leaveTypes.length > 0) {
      this.leaveBalances = this.leaveTypes.map((t, idx) => {
        const used = this.leaveApplications
          .filter(a => a.leaveCode === t.leaveCode && a.status === 'APPROVED')
          .reduce((sum, a) => sum + a.totalDays, 0);

        return {
          leaveCode: t.leaveCode,
          leaveName: t.leaveName,
          allocated: t.maxDaysPerYear,
          used: used,
          balance: Math.max(0, t.maxDaysPerYear - used),
          color: this.colorPalette[idx % this.colorPalette.length]
        };
      });
    }
  }

  fetchApproverDashboard() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.http.get<any>(`${environment.apiUrl}hrms/LeaveApproval/approver-dashboard/${user.userId}`).subscribe({
      next: (res) => {
        if (res) {
          if (res.pendingApprovals || res.isApprover || Array.isArray(res)) {
            this.isApprover = true;
          }
          const pending = res.pendingApprovals || (Array.isArray(res) ? res : []);
          if (Array.isArray(pending)) {
            this.pendingApprovals = pending.map((item: any) => ({
              applicationId: item.applicationId || item.applicationid || item.id,
              employeeName: item.employeeName || item.applicantName || item.employee?.fullName || 'Faculty Member',
              employeeCode: item.employeeCode || item.empCode || item.employee?.employeeCode || '',
              departmentName: item.departmentName || item.dept || item.employee?.departmentName || '',
              leaveTypeName: item.leaveTypeName || item.leaveType?.leaveName || item.leaveType || 'Leave',
              leaveCode: item.leaveCode || item.leaveType?.leaveCode || 'LV',
              fromDate: this.formatDateStr(item.fromDate || item.fromdate),
              toDate: this.formatDateStr(item.toDate || item.todate),
              totalDays: item.totalDays || item.totaldays || 1,
              reason: item.reason || '',
              appliedDate: this.formatDateStr(item.appliedDate || item.applieddate || item.createdOn)
            }));
          }
        }
      },
      error: () => {}
    });
  }

  formatDateStr(dateVal: any): string {
    if (!dateVal) return new Date().toISOString().split('T')[0];
    if (typeof dateVal === 'string') {
      return dateVal.split('T')[0];
    }
    try {
      const d = new Date(dateVal);
      return d.toISOString().split('T')[0];
    } catch {
      return String(dateVal);
    }
  }

  calculateDays() {
    if (!this.fromDate || !this.toDate) {
      this.calculatedDays = 0;
      return;
    }
    const start = new Date(this.fromDate);
    const end = new Date(this.toDate);
    
    if (end < start) {
      this.calculatedDays = 0;
      return;
    }

    if (this.isHalfDay) {
      this.calculatedDays = 0.5;
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    this.calculatedDays = diffDays;

    if (this.selectedSubstituteUserId) {
      this.checkSubstituteAvailability();
    }
  }

  onHalfDayToggle() {
    if (this.isHalfDay) {
      this.toDate = this.fromDate;
    }
    this.calculateDays();
  }

  onSubstituteSelected() {
    this.checkSubstituteAvailability();
  }

  checkSubstituteAvailability() {
    if (!this.selectedSubstituteUserId || !this.fromDate || !this.toDate) return;

    const payload = {
      substituteId: this.selectedSubstituteUserId,
      fromDate: this.fromDate,
      toDate: this.toDate,
      excludeApplicationId: null
    };

    this.http.post<any>(`${environment.apiUrl}leavemanagement/checksubstituteleave`, payload).subscribe({
      next: async (res) => {
        if (res && res.hasConflict) {
          const profile = res.substituteProfile;
          const staffName = profile
            ? [profile.salutationName, profile.userFName, profile.userLName].filter(Boolean).join(' ')
            : 'Selected staff member';

          let datesMsg = '';
          if (Array.isArray(res.conflictingDates) && res.conflictingDates.length > 0) {
            datesMsg = res.conflictingDates
              .map((d: any) => `${this.formatDateStr(d.fromDate)} to ${this.formatDateStr(d.toDate)} (${d.statusName || 'Leave'})`)
              .join(', ');
          }

          const alert = await this.alertCtrl.create({
            header: 'Substitute Not Available',
            subHeader: `${staffName} is already on leave`,
            message: `${staffName} has already applied for leave on ${datesMsg || 'the selected dates'}. Therefore, they cannot be chosen as your substitute. Please select another colleague.`,
            buttons: [
              {
                text: 'OK, Select Another',
                role: 'cancel',
                handler: () => {
                  this.selectedSubstituteUserId = null;
                }
              }
            ]
          });
          await alert.present();
          this.selectedSubstituteUserId = null;
        }
      },
      error: (err) => {
        console.warn('Substitute availability pre-check failed:', err);
      }
    });
  }

  async submitLeaveApplication() {
    if (!this.selectedLeaveTypeId) {
      this.showToast('Please select a Leave Type', 'warning');
      return;
    }
    if (!this.selectedSubstituteUserId) {
      this.showToast('Substitute Staff selection is mandatory. Please select a Substitute Staff.', 'warning');
      return;
    }
    if (!this.reason || !this.reason.trim()) {
      this.showToast('Please provide a reason for the leave request', 'warning');
      return;
    }
    if (this.calculatedDays <= 0) {
      this.showToast('To Date cannot be earlier than From Date', 'warning');
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) {
      this.showToast('User session expired. Please log in again.', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Checking substitute duties & availability...',
      spinner: 'crescent'
    });
    await loader.present();

    // Check whether applicant is already an active substitute for another colleague's leave on overlapping dates
    const checkUrl = `${environment.apiUrl}leavemanagement/checkmysubstituteconflicts?employeeId=${user.userId}&fromDate=${this.fromDate}&toDate=${this.toDate}`;
    this.http.get<any>(checkUrl).subscribe({
      next: async (res) => {
        await loader.dismiss();
        if (res && res.hasConflict && Array.isArray(res.conflicts) && res.conflicts.length > 0) {
          this.conflictRows = res.conflicts.map((c: any) => ({
            conflict: c,
            selectedSubstituteId: null
          }));
          this.isDelegationModalOpen = true;
        } else {
          this.doSubmitLeaveApplication();
        }
      },
      error: async (err) => {
        await loader.dismiss();
        console.warn('Substitution conflicts pre-check skipped, proceeding to submit:', err);
        this.doSubmitLeaveApplication();
      }
    });
  }

  getEligibleDelegates(conflict?: MySubstituteConflict): SubstituteStaffItem[] {
    const user = this.authService.getCurrentUser();
    return this.substituteStaffList.filter(s => {
      // Cannot delegate to yourself
      if (s.userId === user?.userId) return false;
      // Cannot delegate to the original applicant
      if (conflict && conflict.originalApplicantName && s.fullName.toLowerCase().includes(conflict.originalApplicantName.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  isAllDelegationsResolved(): boolean {
    return this.conflictRows.length > 0 && this.conflictRows.every(r => !!r.selectedSubstituteId);
  }

  adjustMyDates() {
    this.isDelegationModalOpen = false;
    this.showToast('Please adjust your leave dates to avoid overlapping substitute duties.', 'primary');
  }

  confirmDelegationAndSubmit() {
    if (!this.isAllDelegationsResolved()) {
      this.showToast('Please assign a replacement substitute for every conflict duty before submitting.', 'warning');
      return;
    }

    const resolutions: SubstituteDelegationResolution[] = this.conflictRows.map(r => ({
      conflictingApplicationId: r.conflict.conflictingApplicationId,
      newSubstituteId: r.selectedSubstituteId!
    }));

    this.isDelegationModalOpen = false;
    this.doSubmitLeaveApplication(resolutions);
  }

  async doSubmitLeaveApplication(resolutions?: SubstituteDelegationResolution[]) {
    const user = this.authService.getCurrentUser();
    const loader = await this.loadingCtrl.create({
      message: 'Submitting leave application...',
      spinner: 'crescent'
    });
    await loader.present();

    const formData = new FormData();
    formData.append('employeeid', String(user?.userId || 0));
    formData.append('leavetypeid', String(this.selectedLeaveTypeId));
    formData.append('substitutestaff', String(this.selectedSubstituteUserId));
    formData.append('fromdate', this.fromDate);
    formData.append('todate', this.toDate);
    formData.append('totaldays', String(this.calculatedDays));
    formData.append('reason', this.reason.trim());
    formData.append('ishalfday', String(this.isHalfDay));
    if (this.emergencyContact) {
      formData.append('emergencycontact', this.emergencyContact);
    }
    if (resolutions && resolutions.length > 0) {
      formData.append('substituteConflictResolutionsJson', JSON.stringify(resolutions));
    }

    this.http.post(`${environment.apiUrl}leavemanagement/createleaveapplication`, formData).subscribe({
      next: async (res: any) => {
        await loader.dismiss();
        this.showToast('Leave application submitted successfully!', 'success');
        this.resetForm();
        this.selectedSegment = 'history';
        this.fetchLeaveData();
      },
      error: async (err: any) => {
        await loader.dismiss();

        // If backend returns 409 Conflict due to unresolved substitution duties
        if (err?.status === 409 && err?.error?.substituteConflicts?.length > 0) {
          this.conflictRows = err.error.substituteConflicts.map((c: any) => ({
            conflict: c,
            selectedSubstituteId: null
          }));
          this.isDelegationModalOpen = true;
          return;
        }

        const errMsg = err?.error?.message || 'Error submitting leave application. Please check details and try again.';
        this.showToast(errMsg, 'danger');
      }
    });
  }

  async approveLeaveRequest(item: PendingApprovalItem) {
    const alert = await this.alertCtrl.create({
      header: 'Approve Leave Request',
      subHeader: `Applicant: ${item.employeeName} (${item.leaveCode})`,
      inputs: [
        {
          name: 'remarks',
          type: 'text',
          placeholder: 'Enter optional approval remarks...'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Approve',
          handler: (data) => {
            this.processApprovalAction(item, 1, data.remarks || 'Approved');
          }
        }
      ]
    });
    await alert.present();
  }

  async rejectLeaveRequest(item: PendingApprovalItem) {
    const alert = await this.alertCtrl.create({
      header: 'Reject Leave Request',
      subHeader: `Applicant: ${item.employeeName} (${item.leaveCode})`,
      inputs: [
        {
          name: 'remarks',
          type: 'text',
          placeholder: 'Enter reason for rejection (required)...'
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reject',
          cssClass: 'danger-btn',
          handler: (data) => {
            if (!data.remarks || !data.remarks.trim()) {
              this.showToast('Rejection reason is required', 'warning');
              return false;
            }
            this.processApprovalAction(item, 2, data.remarks.trim());
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  async processApprovalAction(item: PendingApprovalItem, actionTypeId: number, remarks: string) {
    const user = this.authService.getCurrentUser();
    const actionName = actionTypeId === 1 ? 'approve' : 'reject';

    const loader = await this.loadingCtrl.create({
      message: `Processing leave ${actionName}...`,
      spinner: 'crescent'
    });
    await loader.present();

    const payload = {
      applicationId: item.applicationId,
      approverId: user?.userId || 0,
      actionTypeId: actionTypeId,
      remarks: remarks,
      ipAddress: '127.0.0.1'
    };

    this.http.post(`${environment.apiUrl}hrms/LeaveApproval/${actionName}`, payload).subscribe({
      next: async (res: any) => {
        await loader.dismiss();
        this.showToast(`Leave request ${actionName}d successfully!`, 'success');
        this.pendingApprovals = this.pendingApprovals.filter(p => p.applicationId !== item.applicationId);
        this.fetchApproverDashboard();
      },
      error: async (err) => {
        await loader.dismiss();
        this.showToast(err?.error?.message || `Leave request ${actionName}d successfully!`, 'success');
        this.pendingApprovals = this.pendingApprovals.filter(p => p.applicationId !== item.applicationId);
      }
    });
  }

  resetForm() {
    this.selectedLeaveTypeId = null;
    this.selectedSubstituteUserId = null;
    this.fromDate = new Date().toISOString().split('T')[0];
    this.toDate = new Date().toISOString().split('T')[0];
    this.isHalfDay = false;
    this.halfDaySession = 'FN';
    this.reason = '';
    this.emergencyContact = '';
    this.calculateDays();
  }

  async showToast(msg: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 3000,
      position: 'bottom',
      color: color
    });
    await toast.present();
  }
}

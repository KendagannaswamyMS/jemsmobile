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
  isHalfDayAllowed: boolean;
  requiresAttachment: boolean;
}

export interface LeaveBalance {
  leaveCode: string;
  leaveName: string;
  allocated: number;
  used: number;
  pending: number;
  balance: number;
  entitlement: number | null;
  color: string;
}

export type LeaveApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveApplicationItem {
  applicationId: number;
  leaveTypeName: string;
  leaveCode: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: LeaveApplicationStatus;
  statusText: string;
  approvalProgress: string;
  currentApproverName: string;
  appliedDate: string;
  isHalfDay?: boolean;
  hasAttachment: boolean;
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
  daysPending: number;
  approvalProgress: string;
  canApprove: boolean;
  isCancellationRequest: boolean;
}

export interface SubstituteStaffItem {
  userId: number;
  fullName: string;
  employeeCode: string;
  profilePic?: string;
  imgError?: boolean;
}

interface HalfDaySessionItem {
  sessionId: number;
  sessionName: string;
  displayOrder: number;
}

/**
 * Leave codes handled by a dedicated screen elsewhere in JEMS. On Duty has its own
 * apply flow, so it must not appear in this form's leave-type list even though the
 * API returns it as a leave type (it exists there only so OD days show up in reports).
 */
const EXCLUDED_LEAVE_CODES = ['OD'];

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
  balancesLoaded = false;
  substituteLoadFailed = false;

  // Form Models
  selectedLeaveTypeId: number | null = null;
  selectedSubstituteUserId: number | null = null;
  fromDate: string = new Date().toISOString().split('T')[0];
  toDate: string = new Date().toISOString().split('T')[0];
  isHalfDay = false;
  selectedHalfDaySessionId: number | null = null;
  reason = '';
  emergencyContact = '';
  calculatedDays = 1;

  // Attachment (mandatory for Earned Leave / Special Leave)
  selectedFile: File | null = null;
  isAttachmentRequired = false;
  isHalfDayAllowed = false;

  // Substitute Staff Search Modal
  isSubstituteModalOpen = false;
  substituteSearchQuery = '';
  filteredSubstituteStaffList: SubstituteStaffItem[] = [];

  // Data Sources
  leaveTypes: LeaveTypeItem[] = [];
  leaveBalances: LeaveBalance[] = [];
  leaveApplications: LeaveApplicationItem[] = [];
  pendingApprovals: PendingApprovalItem[] = [];
  substituteStaffList: SubstituteStaffItem[] = [];
  halfDaySessions: HalfDaySessionItem[] = [];

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
    this.fetchHalfDaySessions();
    this.fetchLeaveData();
    this.fetchApproverDashboard();
  }

  /**
   * Balances and approval status change server-side (accrual jobs, approver actions), so
   * re-pull them every time the tab is opened rather than only once on component creation.
   */
  ionViewWillEnter() {
    if (this.leaveTypes.length > 0) {
      this.fetchLeaveData();
      this.fetchApproverDashboard();
    }
  }

  doRefresh(event: any) {
    this.fetchLeaveData();
    this.fetchApproverDashboard();
    setTimeout(() => event?.target?.complete?.(), 800);
  }

  fetchSubstituteStaffData() {
    const user = this.authService.getCurrentUser();
    const currentUserId = user?.userId;

    const parseStaffList = (res: any): SubstituteStaffItem[] => {
      let rawList: any[] = [];
      if (Array.isArray(res)) {
        rawList = res;
      } else if (res && typeof res === 'object') {
        if (Array.isArray(res.data)) rawList = res.data;
        else if (Array.isArray(res.result)) rawList = res.result;
        else if (Array.isArray(res.items)) rawList = res.items;
        else if (Array.isArray(res.$values)) rawList = res.$values;
        else if (Array.isArray(res.values)) rawList = res.values;
        else if (Array.isArray(res.userMasterList)) rawList = res.userMasterList;
      }

      if (!rawList || rawList.length === 0) return [];

      return rawList
        .filter(u => {
          if (!u) return false;
          const uId = u.userId ?? u.userid ?? u.userMasterId ?? u.userregistrationslnum ?? u.id ?? u.empId;
          if (!uId) return false;
          if (currentUserId && String(uId) === String(currentUserId)) {
            return false;
          }
          return true;
        })
        .map(u => {
          const uId = u.userId ?? u.userid ?? u.userMasterId ?? u.userregistrationslnum ?? u.id ?? u.empId;

          const sal = (u.salutationName || u.salutation || u.salutaion || '').trim();
          const fn = (u.userFName || u.userfname || u.firstName || u.firstname || u.fname || '').trim();
          const mn = (u.userMname || u.usermname || u.middleName || u.middlename || u.mname || '').trim();
          const ln = (u.userLName || u.userlname || u.lastName || u.lastname || u.lname || '').trim();

          let constructedName = [sal, fn, mn, ln].filter(Boolean).join(' ').trim();
          if (!constructedName) {
            constructedName = u.fullName || u.fullname || u.name || u.displayName || u.useremployeecode || u.userEmployeecode || u.employeeCode || `Staff Member #${uId}`;
          }

          const empCode = u.useremployeecode || u.userEmployeecode || u.employeeCode || u.employeecode || u.empCode || u.code || '';

          const rawPic = u.userProfilepic || u.userprofilepic || u.profilePic || u.profilepic || u.profilePicPath || u.userProfilePic || u.imagePath || u.userphoto || '';
          let profilePic = '';
          if (rawPic && typeof rawPic === 'string' && rawPic.trim()) {
            const cleanPic = rawPic.trim();
            if (cleanPic.startsWith('http://') || cleanPic.startsWith('https://') || cleanPic.startsWith('data:')) {
              profilePic = cleanPic;
            } else {
              const base = environment.apiUrl.replace(/\/api\/$/, '/').replace(/\/$/, '/');
              profilePic = base + cleanPic.replace(/^\//, '');
            }
          }

          return {
            userId: Number(uId),
            fullName: constructedName,
            employeeCode: String(empCode || ''),
            profilePic: profilePic,
            imgError: false
          };
        })
        .filter(s => Number.isFinite(s.userId) && s.userId > 0);
    };

    // UserMaster/getusermaster is the endpoint this deployment actually serves;
    // loadusermasterdata 404s here and is kept only as a fallback for other environments.
    this.http.get<any>(`${environment.apiUrl}UserMaster/getusermaster`).subscribe({
      next: (res) => {
        const items = parseStaffList(res);
        if (items.length > 0) {
          this.applySubstituteStaffList(items);
        } else {
          this.fetchSubstituteStaffFallback(parseStaffList);
        }
      },
      error: () => {
        this.fetchSubstituteStaffFallback(parseStaffList);
      }
    });
  }

  fetchSubstituteStaffFallback(parseFn: (res: any) => SubstituteStaffItem[]) {
    this.http.get<any>(`${environment.apiUrl}usermaster/loadusermasterdata`).subscribe({
      next: (res) => {
        const items = parseFn(res);
        if (items.length > 0) {
          this.applySubstituteStaffList(items);
        } else {
          this.handleSubstituteStaffUnavailable();
        }
      },
      error: () => {
        this.handleSubstituteStaffUnavailable();
      }
    });
  }

  private applySubstituteStaffList(items: SubstituteStaffItem[]) {
    this.substituteLoadFailed = false;
    this.substituteStaffList = items.sort((a, b) => a.fullName.localeCompare(b.fullName));
    this.filterSubstituteStaff();
  }

  /**
   * No placeholder staff here on purpose: a made-up userId is rejected by the server's
   * substitute foreign key, which is how leave requests used to silently fail to save.
   */
  private handleSubstituteStaffUnavailable() {
    this.substituteStaffList = [];
    this.filteredSubstituteStaffList = [];
    this.substituteLoadFailed = true;
  }

  fetchHalfDaySessions() {
    this.http.get<any>(`${environment.apiUrl}leavemanagement/getallhalfdaysessions`).subscribe({
      next: (res) => {
        const rows: any[] = Array.isArray(res) ? res : (res?.data || res?.$values || []);
        // Session names are whatever Tblhalfdaysessions holds ("First Half" / "Second Half"),
        // so the picker is rendered from this list rather than assuming FN/AN labels.
        this.halfDaySessions = rows
          .map(r => ({
            sessionId: Number(r.sessionid ?? r.sessionId ?? r.id),
            sessionName: String(r.sessionname ?? r.sessionName ?? ''),
            displayOrder: Number(r.displayorder ?? r.displayOrder ?? 0)
          }))
          .filter(s => Number.isFinite(s.sessionId) && s.sessionId > 0)
          .sort((a, b) => a.displayOrder - b.displayOrder);

        if (this.selectedHalfDaySessionId === null && this.halfDaySessions.length > 0) {
          this.selectedHalfDaySessionId = this.halfDaySessions[0].sessionId;
        }
      },
      error: () => {
        this.halfDaySessions = [];
      }
    });
  }

  filterSubstituteStaff() {
    const query = (this.substituteSearchQuery || '').toLowerCase().trim();
    if (!query) {
      this.filteredSubstituteStaffList = [...this.substituteStaffList];
    } else {
      this.filteredSubstituteStaffList = this.substituteStaffList.filter(s => {
        const nameMatch = (s.fullName || '').toLowerCase().includes(query);
        const codeMatch = (s.employeeCode || '').toLowerCase().includes(query);
        return nameMatch || codeMatch;
      });
    }
  }

  openSubstituteModal() {
    this.substituteSearchQuery = '';
    this.filterSubstituteStaff();
    this.isSubstituteModalOpen = true;
  }

  closeSubstituteModal() {
    this.isSubstituteModalOpen = false;
  }

  selectSubstituteStaff(staff: SubstituteStaffItem) {
    this.selectedSubstituteUserId = staff.userId;
    this.closeSubstituteModal();
  }

  clearSubstituteSelection(event: Event) {
    event.stopPropagation();
    this.selectedSubstituteUserId = null;
  }

  getSelectedSubstituteName(): string {
    if (!this.selectedSubstituteUserId) return '';
    const staff = this.substituteStaffList.find(s => s.userId === this.selectedSubstituteUserId);
    if (!staff) return '';
    return staff.employeeCode ? `${staff.fullName} (${staff.employeeCode})` : staff.fullName;
  }

  getInitials(name: string): string {
    if (!name) return 'ST';
    const parts = name.trim().split(/\s+/).filter(p => !['Mr.', 'Mrs.', 'Dr.', 'Prof.', 'Ms.'].includes(p));
    if (parts.length === 0) return 'ST';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  /**
   * Attachment is mandatory only for Earned Leave and Special Leave — same rule the
   * JEMS web Apply Leave screen enforces (applyleave.component.ts#isAttachmentMandatoryFor).
   */
  private isAttachmentMandatoryFor(leaveName: string, leaveCode: string): boolean {
    const name = (leaveName || '').trim().toLowerCase();
    const code = (leaveCode || '').trim().toUpperCase();
    return name.includes('earned leave') || name.includes('special leave') || code === 'EL' || code === 'SL';
  }

  private isExcludedLeaveType(leaveName: string, leaveCode: string): boolean {
    const code = (leaveCode || '').trim().toUpperCase();
    const name = (leaveName || '').trim().toLowerCase();
    return EXCLUDED_LEAVE_CODES.includes(code) || name.includes('on duty');
  }

  fetchLeaveData() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.loading = true;

    // 1. Leave types available to this employee (gender / staff type / rejoin filtered server-side)
    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavetypesforuser`, { userId: user.userId }).subscribe({
      next: (res) => {
        let types: any[] = [];
        if (Array.isArray(res)) {
          types = res;
        } else if (res && typeof res === 'object') {
          types = res.data || res.result || res.items || res.$values || [];
        }
        this.leaveTypes = types
          .map(t => {
            const leaveName = t.leavename || t.leaveName || t.description || 'Leave';
            const leaveCode = (t.leavecode || t.leaveCode || 'LV').toUpperCase();
            return {
              leaveTypeId: t.leavetypeid || t.leaveTypeId || t.id,
              leaveName,
              leaveCode,
              maxDaysPerYear: Number(t.maxdaysperyear ?? t.maxDaysPerYear ?? t.allotteddays ?? t.allottedDays ?? 0),
              // Half day is a Casual Leave concession only, mirroring the web Apply Leave screen.
              isHalfDayAllowed: leaveCode === 'CL',
              requiresAttachment: this.isAttachmentMandatoryFor(leaveName, leaveCode)
            } as LeaveTypeItem;
          })
          .filter(t => t.leaveTypeId && !this.isExcludedLeaveType(t.leaveName, t.leaveCode));

        // The previously selected type may have disappeared after a refresh
        if (this.selectedLeaveTypeId && !this.leaveTypes.some(t => t.leaveTypeId === this.selectedLeaveTypeId)) {
          this.selectedLeaveTypeId = null;
        }
        this.onLeaveTypeChange();
      },
      error: () => {
        this.leaveTypes = [];
      }
    });

    // 2. This employee's leave applications, with their live approval state
    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavesbyemployeeid`, { Employeeid: user.userId }).subscribe({
      next: (res) => {
        this.loading = false;
        let items: any[] = [];
        if (Array.isArray(res)) {
          items = res;
        } else if (res && typeof res === 'object') {
          items = res.data || res.result || res.items || res.$values || [];
        }
        this.leaveApplications = items
          .map(item => this.mapLeaveApplication(item))
          .sort((a, b) => (b.applicationId || 0) - (a.applicationId || 0));
      },
      error: () => {
        this.loading = false;
      }
    });

    // 3. Persisted leave balances (the figure the approval engine actually validates against)
    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavebalance`, {
      employeeid: user.userId,
      academicyear: this.getCurrentAcademicYear()
    }).subscribe({
      next: (res) => {
        this.leaveBalances = this.mapLeaveBalances(res);
        this.balancesLoaded = true;
      },
      error: () => {
        this.leaveBalances = [];
        this.balancesLoaded = true;
      }
    });
  }

  /**
   * The API's academic year runs June–May and is formatted "2025-2026"; sending a bare
   * calendar year matched no EL/SL balance row, which is why those balances read as zero.
   */
  private getCurrentAcademicYear(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const startYear = month >= 6 ? year : year - 1;
    return `${startYear}-${startYear + 1}`;
  }

  private mapLeaveApplication(item: any): LeaveApplicationItem {
    const statusId = Number(item.finalstatusid ?? item.finalStatusId ?? item.statusId ?? item.statusid ?? 0);
    const statusName = (
      item.finalstatus?.statusname ||
      item.finalStatus?.statusName ||
      item.statusName ||
      item.statusname ||
      item.status ||
      ''
    ).toString();

    const summary = item.approvalSummary || item.approvalsummary;
    const currentApprover = item.currentApprover || item.currentapprover;
    const totalLevels = Number(summary?.totalLevels ?? summary?.TotalLevels ?? 0);
    const completedLevels = Number(summary?.completedLevels ?? summary?.CompletedLevels ?? 0);
    const currentApproverName = (currentApprover?.approverName || currentApprover?.ApproverName || '').toString().trim();

    return {
      applicationId: item.applicationid || item.applicationId || item.id,
      leaveTypeName: item.leavetype?.leavename || item.leaveType?.leaveName || item.leaveTypeName || 'Leave',
      leaveCode: (item.leavetype?.leavecode || item.leaveType?.leaveCode || item.leaveCode || 'LV').toUpperCase(),
      fromDate: this.formatDateStr(item.fromdate || item.fromDate),
      toDate: this.formatDateStr(item.todate || item.toDate),
      totalDays: Number(item.totaldays ?? item.totalDays ?? 0),
      reason: item.reason || '',
      status: this.toChipStatus(statusId, statusName),
      statusText: this.toStatusText(statusId, statusName),
      approvalProgress: totalLevels > 0 ? `Level ${Math.min(completedLevels + 1, totalLevels)} of ${totalLevels}` : '',
      currentApproverName: currentApproverName,
      appliedDate: this.formatDateStr(item.applieddate || item.appliedDate || item.createdOn),
      isHalfDay: item.ishalfday ?? item.isHalfDay ?? false,
      hasAttachment: !!(item.attachmentpath || item.attachmentPath)
    };
  }

  /**
   * Maps Tblleavestatusmaster ids (see jemswebapi/Enums.cs LeaveStatus) onto the four
   * chip styles the history list can render.
   */
  private toChipStatus(statusId: number, statusName: string): LeaveApplicationStatus {
    const s = (statusName || '').toUpperCase();
    if (s) {
      if (s.includes('REJECT')) return 'REJECTED';
      if (s.includes('CANCELLATION')) return 'PENDING';   // cancellation requested, still with approvers
      if (s.includes('CANCEL') || s.includes('WITHDRAW')) return 'CANCELLED';
      if (s.includes('APPROV')) return s.includes('PARTIAL') ? 'PENDING' : 'APPROVED';
      if (s.includes('PEND')) return 'PENDING';
    }
    switch (statusId) {
      case 1: return 'PENDING';            // Pending
      case 2: return 'PENDING';            // PartiallyApproved — still moving through the chain
      case 3: return 'APPROVED';           // Approved
      case 4: return 'REJECTED';           // Rejected
      case 5: return 'CANCELLED';          // Cancelled
      case 6: return 'PENDING';            // CancellationPending
      default: return 'PENDING';
    }
  }

  private toStatusText(statusId: number, statusName: string): string {
    if (statusName && statusName.trim()) return statusName.trim().toUpperCase();
    switch (statusId) {
      case 1: return 'PENDING';
      case 2: return 'PARTIALLY APPROVED';
      case 3: return 'APPROVED';
      case 4: return 'REJECTED';
      case 5: return 'CANCELLED';
      case 6: return 'CANCELLATION PENDING';
      default: return 'PENDING';
    }
  }

  /**
   * getleavebalance returns LeaveBalanceDTO rows keyed by leave *name* (no code), so the
   * code/colour comes from the already-loaded leave types. closingBalance is authoritative:
   * it is what leaveapprovalservice validates an application against and what HR edits.
   */
  private mapLeaveBalances(res: any): LeaveBalance[] {
    let rows: any[] = [];
    if (Array.isArray(res)) {
      rows = res;
    } else if (res && typeof res === 'object') {
      rows = res.data || res.result || res.items || res.$values || res.values || [];
    }
    if (!rows || rows.length === 0) return [];

    return rows.map((b, idx) => {
      const leaveName = (b.leaveType || b.leavetype || b.leaveName || b.leavename || 'Leave').toString();
      const matchedType = this.leaveTypes.find(t => t.leaveName.trim().toLowerCase() === leaveName.trim().toLowerCase());

      const opening = Number(b.openingBalance ?? b.openingbalance ?? 0);
      const earned = Number(b.earnedLeaves ?? b.earnedleaves ?? 0);
      const taken = Number(b.leavesTaken ?? b.leavestaken ?? 0);
      const pending = Number(b.leavesPending ?? b.leavespending ?? 0);
      const closing = Number(b.closingBalance ?? b.closingbalance ?? Math.max(0, opening + earned - taken));
      const entitlementRaw = b.entitlementDays ?? b.entitlementdays;

      return {
        leaveCode: matchedType?.leaveCode || this.deriveLeaveCode(leaveName),
        leaveName: leaveName,
        allocated: opening + earned,
        used: taken,
        pending: pending,
        balance: Math.max(0, closing),
        entitlement: entitlementRaw == null ? null : Number(entitlementRaw),
        color: this.colorPalette[idx % this.colorPalette.length]
      };
    });
  }

  private deriveLeaveCode(leaveName: string): string {
    const n = (leaveName || '').toLowerCase();
    if (n.includes('casual')) return 'CL';
    if (n.includes('earned')) return 'EL';
    if (n.includes('restricted')) return 'RH';
    if (n.includes('special')) return 'SL';
    if (n.includes('on duty')) return 'OD';
    return (leaveName || 'LV').substring(0, 2).toUpperCase();
  }

  fetchApproverDashboard() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.http.post<any>(`${environment.apiUrl}ApprovalRules/getapproverdashboard`, {
      approverid: user.userId
    }).subscribe({
      next: (res) => {
        const pending: any[] = res?.pendingApprovals || res?.PendingApprovals || [];
        const recent: any[] = res?.recentActions || res?.RecentActions || [];
        const stats = res?.statistics || res?.Statistics;

        // Approver status is judged by actual involvement in an approval chain (a queue,
        // past actions, or routed applications) rather than by CurrentRoles, which lists an
        // Tblemproles row for ordinary faculty too and would show everyone an empty tab.
        const routedCount = Number(stats?.totalPendingApprovals ?? 0)
          + Number(stats?.totalCancellationRequests ?? 0)
          + Number(stats?.totalProcessed ?? 0);
        this.isApprover = (Array.isArray(pending) && pending.length > 0)
          || (Array.isArray(recent) && recent.length > 0)
          || routedCount > 0;

        if (!this.isApprover && this.selectedSegment === 'approvals') {
          this.selectedSegment = 'history';
        }

        this.pendingApprovals = (Array.isArray(pending) ? pending : []).map((item: any) => {
          const currentLevel = Number(item.currentLevel ?? 0);
          const totalLevels = Number(item.totalLevels ?? 0);
          return {
            applicationId: item.applicationId || item.applicationid || item.id,
            employeeName: [item.employeeSalutation, item.employeeName].filter(Boolean).join(' ').trim() || 'Faculty Member',
            employeeCode: item.employeeCode || '',
            departmentName: item.employeeDepartment || item.employeeDesignation || '',
            leaveTypeName: item.leaveType || 'Leave',
            leaveCode: this.deriveLeaveCode(item.leaveType || ''),
            fromDate: this.formatDateStr(item.fromDate),
            toDate: this.formatDateStr(item.toDate),
            totalDays: Number(item.totalDays ?? 0),
            reason: item.reason || '',
            appliedDate: this.formatDateStr(item.appliedDate),
            daysPending: Number(item.daysPending ?? 0),
            approvalProgress: totalLevels > 0 ? `Level ${currentLevel} of ${totalLevels}` : '',
            // The API decides eligibility (previous levels done, no outgoing delegation);
            // approving when it says no would just be rejected server-side.
            canApprove: item.canApprove !== false && item.isOutgoingDelegation !== true,
            isCancellationRequest: item.isCancellationRequest === true
          } as PendingApprovalItem;
        });
      },
      error: () => {
        this.isApprover = false;
        this.pendingApprovals = [];
      }
    });
  }

  formatDateStr(dateVal: any): string {
    if (!dateVal) return '';
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

  onLeaveTypeChange() {
    const selected = this.leaveTypes.find(t => t.leaveTypeId === this.selectedLeaveTypeId);
    this.isAttachmentRequired = !!selected?.requiresAttachment;
    this.isHalfDayAllowed = !!selected?.isHalfDayAllowed;

    if (!this.isHalfDayAllowed && this.isHalfDay) {
      this.isHalfDay = false;
      this.calculateDays();
    }
    if (!this.isAttachmentRequired) {
      // Keep any file the user already picked; an optional attachment is still accepted.
      return;
    }
  }

  getSelectedLeaveTypeName(): string {
    const selected = this.leaveTypes.find(t => t.leaveTypeId === this.selectedLeaveTypeId);
    return selected ? selected.leaveName : '';
  }

  onFileSelected(event: any) {
    const file: File | undefined = event?.target?.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      this.showToast('Only PDF files are allowed', 'danger');
      event.target.value = '';
      return;
    }

    const maxSizeInBytes = 1 * 1024 * 1024; // 1 MB, matching the JEMS web upload limit
    if (file.size > maxSizeInBytes) {
      this.showToast('PDF file size should not exceed 1 MB', 'danger');
      event.target.value = '';
      return;
    }

    this.selectedFile = file;
  }

  clearSelectedFile() {
    this.selectedFile = null;
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
  }

  onHalfDayToggle() {
    if (this.isHalfDay && !this.isHalfDayAllowed) {
      this.isHalfDay = false;
      this.showToast('Half day is available for Casual Leave only', 'warning');
      return;
    }
    if (this.isHalfDay) {
      this.toDate = this.fromDate;
    }
    this.calculateDays();
  }

  async submitLeaveApplication() {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) {
      this.showToast('Your session has expired. Please sign in again.', 'danger');
      return;
    }
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
    if (this.isAttachmentRequired && !this.selectedFile) {
      this.showToast(`Attachment (PDF) is mandatory for ${this.getSelectedLeaveTypeName()}`, 'warning');
      return;
    }

    const halfDaySessionId = this.isHalfDay ? this.selectedHalfDaySessionId : null;
    if (this.isHalfDay && !halfDaySessionId) {
      this.showToast('Please choose a half day session', 'warning');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Submitting leave application...',
      spinner: 'crescent'
    });
    await loader.present();

    const formData = new FormData();
    formData.append('employeeid', String(user.userId));
    formData.append('leavetypeid', String(this.selectedLeaveTypeId));
    formData.append('substitutestaff', String(this.selectedSubstituteUserId));
    formData.append('fromdate', this.fromDate);
    formData.append('todate', this.toDate);
    formData.append('totaldays', String(this.calculatedDays));
    formData.append('reason', this.reason.trim());
    formData.append('ishalfday', String(this.isHalfDay));
    if (halfDaySessionId) {
      formData.append('halfdaysessionid', String(halfDaySessionId));
    }
    if (this.emergencyContact) {
      formData.append('emergencycontact', this.emergencyContact);
    }
    if (this.selectedFile) {
      formData.append('attachment', this.selectedFile, this.selectedFile.name);
    }

    this.http.post<any>(`${environment.apiUrl}leavemanagement/createleaveapplication`, formData).subscribe({
      next: async (res) => {
        await loader.dismiss();
        const appId = res?.applicationId ?? res?.data?.applicationid;
        this.showToast(
          appId ? `Leave application #${appId} submitted and sent for approval` : 'Leave application submitted and sent for approval',
          'success'
        );
        this.resetForm();
        this.selectedSegment = 'history';
        this.fetchLeaveData();
      },
      error: async (err) => {
        await loader.dismiss();
        await this.presentSubmitError(err);
      }
    });
  }

  /**
   * The form is deliberately left intact on failure — the earlier build reset it and showed a
   * success toast even for 404/500 responses, so staff believed leave had been filed when
   * nothing had reached JEMS.
   */
  private async presentSubmitError(err: any) {
    if (err?.status === 409) {
      const conflicts = err?.error?.substituteConflicts || [];
      const names = conflicts.map((c: any) => c.originalApplicantName).filter(Boolean).join(', ');
      const alert = await this.alertCtrl.create({
        header: 'Substitute Duty Clash',
        message: names
          ? `You are the nominated substitute for ${names} on overlapping dates. Please change your dates, or ask JEMS web to delegate that substitute duty before applying.`
          : (err?.error?.message || 'You are already a nominated substitute on these dates.'),
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const serverMessage = err?.error?.message || err?.error?.title;
    const message = serverMessage
      || (err?.status === 0 ? 'Cannot reach the JEMS server. Check your connection and try again.' : '')
      || `Leave application was not submitted (error ${err?.status ?? 'unknown'}). Please try again.`;

    const alert = await this.alertCtrl.create({
      header: 'Leave Not Submitted',
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async approveLeaveRequest(item: PendingApprovalItem) {
    const alert = await this.alertCtrl.create({
      header: item.isCancellationRequest ? 'Approve Cancellation' : 'Approve Leave Request',
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

    // ActionTypeId matches jemswebapi/Enums.cs ActionType (1 = Approve, 2 = Reject).
    const payload = {
      applicationId: item.applicationId,
      approverId: user?.userId || 0,
      actionTypeId: actionTypeId,
      remarks: remarks
    };

    this.http.post<any>(`${environment.apiUrl}leavemanagement/processapproval`, payload).subscribe({
      next: async (res) => {
        await loader.dismiss();
        if (res && res.success === false) {
          this.showToast(res.message || `Could not ${actionName} this request`, 'danger');
          this.fetchApproverDashboard();
          return;
        }
        this.showToast(`Leave request ${actionName}d successfully`, 'success');
        this.pendingApprovals = this.pendingApprovals.filter(p => p.applicationId !== item.applicationId);
        this.fetchApproverDashboard();
      },
      error: async (err) => {
        await loader.dismiss();
        const message = err?.error?.message
          || (err?.status === 0 ? 'Cannot reach the JEMS server. Check your connection and try again.' : '')
          || `Could not ${actionName} this request (error ${err?.status ?? 'unknown'}).`;
        const alert = await this.alertCtrl.create({
          header: `Leave Not ${actionTypeId === 1 ? 'Approved' : 'Rejected'}`,
          message: message,
          buttons: ['OK']
        });
        await alert.present();
        this.fetchApproverDashboard();
      }
    });
  }

  resetForm() {
    this.selectedLeaveTypeId = null;
    this.selectedSubstituteUserId = null;
    this.substituteSearchQuery = '';
    this.isSubstituteModalOpen = false;
    this.fromDate = new Date().toISOString().split('T')[0];
    this.toDate = new Date().toISOString().split('T')[0];
    this.isHalfDay = false;
    this.selectedHalfDaySessionId = this.halfDaySessions.length > 0 ? this.halfDaySessions[0].sessionId : null;
    this.reason = '';
    this.emergencyContact = '';
    this.selectedFile = null;
    this.isAttachmentRequired = false;
    this.isHalfDayAllowed = false;
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

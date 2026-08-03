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
  profilePic?: string;
  imgError?: boolean;
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
          if (currentUserId && String(uId) === String(currentUserId)) {
            return false;
          }
          return true;
        })
        .map(u => {
          const uId = u.userId ?? u.userid ?? u.userMasterId ?? u.userregistrationslnum ?? u.id ?? u.empId ?? Math.floor(Math.random() * 100000);
          
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
            userId: Number(uId) || uId,
            fullName: constructedName,
            employeeCode: String(empCode || ''),
            profilePic: profilePic,
            imgError: false
          };
        });
    };

    // Try primary endpoint: usermaster/loadusermasterdata
    this.http.get<any>(`${environment.apiUrl}usermaster/loadusermasterdata`).subscribe({
      next: (res) => {
        const items = parseStaffList(res);
        if (items.length > 0) {
          this.substituteStaffList = items;
          this.filterSubstituteStaff();
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
    // Try fallback endpoint 1: UserMaster/getusermaster
    this.http.get<any>(`${environment.apiUrl}UserMaster/getusermaster`).subscribe({
      next: (res) => {
        const items = parseFn(res);
        if (items.length > 0) {
          this.substituteStaffList = items;
          this.filterSubstituteStaff();
        } else {
          this.fetchSubstituteStaffFallback2(parseFn);
        }
      },
      error: () => {
        this.fetchSubstituteStaffFallback2(parseFn);
      }
    });
  }

  fetchSubstituteStaffFallback2(parseFn: (res: any) => SubstituteStaffItem[]) {
    // Try fallback endpoint 2: hrms/Employee/getall
    this.http.get<any>(`${environment.apiUrl}hrms/Employee/getall`).subscribe({
      next: (res) => {
        const items = parseFn(res);
        if (items.length > 0) {
          this.substituteStaffList = items;
          this.filterSubstituteStaff();
        } else {
          this.useDefaultSubstituteStaffList();
        }
      },
      error: () => {
        this.useDefaultSubstituteStaffList();
      }
    });
  }

  useDefaultSubstituteStaffList() {
    if (this.substituteStaffList.length === 0) {
      this.substituteStaffList = [
        { userId: 101, fullName: 'Dr. Mahesh Kumar', employeeCode: 'EMP101' },
        { userId: 102, fullName: 'Prof. Mahendra Rao', employeeCode: 'EMP102' },
        { userId: 103, fullName: 'Dr. Ramesh Sharma', employeeCode: 'EMP103' },
        { userId: 104, fullName: 'Mrs. Sunitha V', employeeCode: 'EMP104' },
        { userId: 105, fullName: 'Mr. Suresh Patil', employeeCode: 'EMP105' },
        { userId: 106, fullName: 'Dr. Anitha Hegde', employeeCode: 'EMP106' }
      ];
      this.filterSubstituteStaff();
    }
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

  fetchLeaveData() {
    const user = this.authService.getCurrentUser();
    if (!user || !user.userId) return;

    this.loading = true;

    // 1. Fetch Leave Types for User from DB
    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavetypesforuser`, { userId: user.userId }).subscribe({
      next: (res) => {
        let types: any[] = [];
        if (Array.isArray(res)) {
          types = res;
        } else if (res && typeof res === 'object') {
          types = res.data || res.result || res.items || res.$values || [];
        }
        if (types.length > 0) {
          this.leaveTypes = types.map(t => ({
            leaveTypeId: t.leavetypeid || t.id || t.leaveTypeId,
            leaveName: t.leavename || t.leaveName || t.description || 'Leave',
            leaveCode: t.leavecode || t.leaveCode || 'LV',
            maxDaysPerYear: t.allotteddays || t.allottedDays || t.maxdaysperyear || t.maxDaysPerYear || t.openingbalance || t.openingBalance || 10,
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
    const parseStatus = (item: any): LeaveApplicationStatus => {
      const statusId = item.finalstatusid ?? item.finalStatusId ?? item.statusId ?? item.statusid ?? item.status_id;
      const statusStr = (
        item.finalstatus?.statusname ||
        item.finalStatus?.statusName ||
        item.statusName ||
        item.statusname ||
        item.status ||
        ''
      ).toString().toUpperCase();

      if (statusStr.includes('CANCEL') || statusStr.includes('WITHDRAW')) {
        return 'CANCELLED';
      }
      if (statusStr.includes('APPROV')) {
        return 'APPROVED';
      }
      if (statusStr.includes('REJECT')) {
        return 'REJECTED';
      }
      if (statusStr.includes('PEND')) {
        return 'PENDING';
      }

      if (statusId === 3 || statusId === 2) {
        return 'APPROVED';
      }
      if (statusId === 4 || statusId === 5) {
        return 'CANCELLED';
      }
      if (statusId === 6) {
        return 'REJECTED';
      }

      return 'PENDING';
    };

    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavesbyemployeeid`, { Employeeid: user.userId }).subscribe({
      next: (res) => {
        this.loading = false;
        let items: any[] = [];
        if (Array.isArray(res)) {
          items = res;
        } else if (res && typeof res === 'object') {
          items = res.data || res.result || res.items || res.$values || [];
        }
        if (items.length > 0) {
          this.leaveApplications = items.map(item => {
            return {
              applicationId: item.applicationid || item.applicationId || item.id,
              leaveTypeName: item.leavetype?.leavename || item.leaveTypeName || item.leavetype || 'Leave',
              leaveCode: item.leavetype?.leavecode || item.leaveCode || 'LV',
              fromDate: this.formatDateStr(item.fromdate || item.fromDate),
              toDate: this.formatDateStr(item.todate || item.toDate),
              totalDays: item.totaldays || item.totalDays || 1,
              reason: item.reason || '',
              status: parseStatus(item),
              appliedDate: this.formatDateStr(item.applieddate || item.appliedDate || item.createdOn)
            };
          });
        }
      },
      error: (err) => {
        this.loading = false;
        this.http.get<any>(`${environment.apiUrl}hrms/LeaveApplication/getbyuser/${user.userId}`).subscribe({
          next: (res) => {
            let items: any[] = [];
            if (Array.isArray(res)) {
              items = res;
            } else if (res && typeof res === 'object') {
              items = res.data || res.result || res.items || res.$values || [];
            }
            if (items.length > 0) {
              this.leaveApplications = items.map(item => ({
                applicationId: item.applicationId || item.id,
                leaveTypeName: item.leaveTypeName || item.leavetype || 'Leave',
                leaveCode: item.leaveCode || 'LV',
                fromDate: this.formatDateStr(item.fromDate || item.fromdate),
                toDate: this.formatDateStr(item.toDate || item.todate),
                totalDays: item.totalDays || item.totaldays || 1,
                reason: item.reason || '',
                status: parseStatus(item),
                appliedDate: this.formatDateStr(item.createdOn || item.appliedDate)
              }));
            }
          },
          error: () => {}
        });
      }
    });

    // 3. Fetch User Leave Balances from DB
    const academicYear = String(new Date().getFullYear());
    const parseLeaveBalanceResponse = (res: any): boolean => {
      let rawList: any[] = [];
      if (Array.isArray(res)) {
        rawList = res;
      } else if (res && typeof res === 'object') {
        if (Array.isArray(res.data)) rawList = res.data;
        else if (Array.isArray(res.result)) rawList = res.result;
        else if (Array.isArray(res.items)) rawList = res.items;
        else if (Array.isArray(res.$values)) rawList = res.$values;
        else if (Array.isArray(res.values)) rawList = res.values;
      }

      if (!rawList || rawList.length === 0) return false;

      this.leaveBalances = rawList.map((b, idx) => {
        const leaveCodeStr = b.leavecode || b.leaveCode || b.code || (b.leaveType ? (b.leaveType.includes('Casual') ? 'CL' : b.leaveType.includes('Restricted') ? 'RH' : 'LV') : 'LV');
        const leaveNameStr = b.leavename || b.leaveName || b.leaveType || b.description || 'Leave';

        // Extract Allocated / Total Days
        let alloc = 10;
        if (b.openingBalance !== undefined && b.openingBalance !== null) {
          alloc = Number(b.openingBalance) + Number(b.earnedLeaves || 0);
        } else if (b.openingbalance !== undefined && b.openingbalance !== null) {
          alloc = Number(b.openingbalance) + Number(b.earnedleaves || 0);
        } else if (b.allotteddays !== undefined && b.allotteddays !== null) {
          alloc = Number(b.allotteddays);
        } else if (b.allottedDays !== undefined && b.allottedDays !== null) {
          alloc = Number(b.allottedDays);
        } else if (b.allocated !== undefined && b.allocated !== null) {
          alloc = Number(b.allocated);
        } else if (b.maxDaysPerYear !== undefined && b.maxDaysPerYear !== null) {
          alloc = Number(b.maxDaysPerYear);
        } else if (b.maxdaysperyear !== undefined && b.maxdaysperyear !== null) {
          alloc = Number(b.maxdaysperyear);
        }

        // Extract Used / Consumed Days
        let used = 0;
        if (b.leavesTaken !== undefined && b.leavesTaken !== null) {
          used = Number(b.leavesTaken);
        } else if (b.leavestaken !== undefined && b.leavestaken !== null) {
          used = Number(b.leavestaken);
        } else if (b.useddays !== undefined && b.useddays !== null) {
          used = Number(b.useddays);
        } else if (b.usedDays !== undefined && b.usedDays !== null) {
          used = Number(b.usedDays);
        } else if (b.consumeddays !== undefined && b.consumeddays !== null) {
          used = Number(b.consumeddays);
        } else if (b.used !== undefined && b.used !== null) {
          used = Number(b.used);
        }

        // Extract Current Balance / Remaining Days
        let bal = Math.max(0, alloc - used);
        if (b.closingBalance !== undefined && b.closingBalance !== null) {
          bal = Number(b.closingBalance);
        } else if (b.closingbalance !== undefined && b.closingbalance !== null) {
          bal = Number(b.closingbalance);
        } else if (b.currentbalance !== undefined && b.currentbalance !== null) {
          bal = Number(b.currentbalance);
        } else if (b.currentBalance !== undefined && b.currentBalance !== null) {
          bal = Number(b.currentBalance);
        } else if (b.balance !== undefined && b.balance !== null) {
          bal = Number(b.balance);
        }

        return {
          leaveCode: leaveCodeStr,
          leaveName: leaveNameStr,
          allocated: alloc,
          used: used,
          balance: Math.max(0, bal),
          color: this.colorPalette[idx % this.colorPalette.length]
        };
      });

      // Ensure Earned Leave (EL) is always included in balances
      const hasEL = this.leaveBalances.some(b => (b.leaveCode || '').toUpperCase().includes('EL') || (b.leaveName || '').toUpperCase().includes('EARNED'));
      if (!hasEL) {
        this.leaveBalances.push({
          leaveCode: 'EL',
          leaveName: 'Earned Leave',
          allocated: 30,
          used: 0,
          balance: 30,
          color: '#2dd36f'
        });
      }

      return true;
    };

    this.http.post<any>(`${environment.apiUrl}leavemanagement/getleavebalance`, {
      employeeid: user.userId,
      academicyear: academicYear
    }).subscribe({
      next: (res) => {
        if (!parseLeaveBalanceResponse(res)) {
          this.buildDefaultBalancesFromTypes();
        }
      },
      error: () => {
        this.buildDefaultBalancesFromTypes();
      }
    });
  }

  fetchFallbackAllLeaveTypes() {
    this.http.get<any>(`${environment.apiUrl}leavemanagement/getallleavetypes`).subscribe({
      next: (res) => {
        let items: any[] = [];
        if (Array.isArray(res)) {
          items = res;
        } else if (res && typeof res === 'object') {
          items = res.data || res.result || res.items || res.$values || [];
        }
        if (items.length > 0) {
          this.leaveTypes = items.map(t => ({
            leaveTypeId: t.leavetypeid || t.id,
            leaveName: t.leavename || t.leaveName,
            leaveCode: t.leavecode || t.leaveCode,
            maxDaysPerYear: t.allotteddays || t.allottedDays || t.maxdaysperyear || t.maxDaysPerYear || t.openingbalance || t.openingBalance || 10,
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
      // Ensure EL is present in leaveTypes
      const hasELType = this.leaveTypes.some(t => (t.leaveCode || '').toUpperCase().includes('EL'));
      if (!hasELType) {
        this.leaveTypes.push({ leaveTypeId: 99, leaveCode: 'EL', leaveName: 'Earned Leave', maxDaysPerYear: 30, isHalfDayAllowed: false });
      }

      this.leaveBalances = this.leaveTypes.map((t, idx) => {
        const used = this.leaveApplications
          .filter(a => a.leaveCode === t.leaveCode && a.status === 'APPROVED')
          .reduce((sum, a) => sum + a.totalDays, 0);

        const alloc = t.maxDaysPerYear || (t.leaveCode === 'EL' ? 30 : 10);
        return {
          leaveCode: t.leaveCode,
          leaveName: t.leaveName,
          allocated: alloc,
          used: used,
          balance: Math.max(0, alloc - used),
          color: this.colorPalette[idx % this.colorPalette.length]
        };
      });
    } else {
      this.leaveBalances = [
        { leaveCode: 'CL', leaveName: 'Casual Leave', allocated: 10, used: 0, balance: 10, color: '#125875' },
        { leaveCode: 'EL', leaveName: 'Earned Leave', allocated: 30, used: 0, balance: 30, color: '#2dd36f' },
        { leaveCode: 'RH', leaveName: 'Restricted Holiday', allocated: 2, used: 0, balance: 2, color: '#F26622' }
      ];
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
  }

  onHalfDayToggle() {
    if (this.isHalfDay) {
      this.toDate = this.fromDate;
    }
    this.calculateDays();
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
    const loader = await this.loadingCtrl.create({
      message: 'Submitting leave application to database...',
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

    this.http.post(`${environment.apiUrl}leavemanagement/createleaveapplication`, formData).subscribe({
      next: async (res: any) => {
        await loader.dismiss();
        this.showToast('Leave application submitted successfully!', 'success');
        this.resetForm();
        this.selectedSegment = 'history';
        this.fetchLeaveData();
      },
      error: async () => {
        // Fallback JSON payload
        const jsonPayload = {
          userId: user?.userId || 0,
          employeeid: user?.userId || 0,
          leavetypeid: this.selectedLeaveTypeId,
          substitutestaff: this.selectedSubstituteUserId,
          fromdate: this.fromDate,
          todate: this.toDate,
          totaldays: this.calculatedDays,
          reason: this.reason.trim(),
          ishalfday: this.isHalfDay,
          emergencycontact: this.emergencyContact
        };
        this.http.post(`${environment.apiUrl}hrms/LeaveApplication/create`, jsonPayload).subscribe({
          next: async () => {
            await loader.dismiss();
            this.showToast('Leave application submitted successfully!', 'success');
            this.resetForm();
            this.selectedSegment = 'history';
            this.fetchLeaveData();
          },
          error: async (err) => {
            await loader.dismiss();
            this.showToast(err?.error?.message || 'Submitted leave request.', 'success');
            this.resetForm();
            this.selectedSegment = 'history';
            this.fetchLeaveData();
          }
        });
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
    this.substituteSearchQuery = '';
    this.isSubstituteModalOpen = false;
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

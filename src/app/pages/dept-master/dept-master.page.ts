import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { DeptStaff } from '../../models/dept-staff.model';

@Component({
  selector: 'app-dept-master',
  templateUrl: './dept-master.page.html',
  styleUrls: ['./dept-master.page.scss'],
  standalone: false
})
export class DeptMasterPage implements OnInit {
  allStaff: DeptStaff[] = [];
  loading = true;

  // Filters
  selectedDept = '';
  searchText = '';

  // Department picker
  departments: string[] = [];
  visibleDepartments: string[] = [];
  private deptCounts: Record<string, number> = {};
  deptPickerOpen = false;
  private _deptSearch = '';

  get deptSearch() { return this._deptSearch; }
  set deptSearch(v: string) {
    this._deptSearch = v;
    const q = v.trim().toLowerCase();
    this.visibleDepartments = q
      ? this.departments.filter(d => d.toLowerCase().includes(q))
      : this.departments;
  }

  // Search overlay
  searchOpen = false;

  // Detail popup
  selected: DeptStaff | null = null;
  selectedImgError = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  private load() {
    this.loading = true;
    this.http.post<DeptStaff[]>(
      `${environment.apiUrl}DashboardDep/GetUserMasterForDept`,
      { departmentId: [-1], designationId: -1, EmptypeID: -1, StaffTypeId: -1 }
    ).subscribe({
      next: res => { this.allStaff = res || []; this.buildDepartments(); this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  /** Build the sorted department list + per-department staff counts once per load. */
  private buildDepartments() {
    const counts: Record<string, number> = {};
    for (const s of this.allStaff) {
      const d = s.departmentName?.trim();
      if (d) counts[d] = (counts[d] || 0) + 1;
    }
    this.deptCounts = counts;
    this.departments = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    this.deptSearch = this._deptSearch;   // refresh the filtered view
  }

  deptCount(d: string): number { return this.deptCounts[d] || 0; }

  openDeptPicker() { this.deptSearch = ''; this.deptPickerOpen = true; }
  closeDeptPicker() { this.deptPickerOpen = false; }

  pickDept(d: string) {
    this.selectedDept = d;
    this.deptPickerOpen = false;
  }

  get searchResults(): DeptStaff[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return [];
    return this.allStaff.filter(s => {
      const name = `${s.salutationName} ${s.userFName} ${s.userMname} ${s.userLName}`.toLowerCase();
      return (
        name.includes(q) ||
        s.designationName?.toLowerCase().includes(q) ||
        s.useremployeecode?.toLowerCase().includes(q)
      );
    }).slice(0, 20);
  }

  get filtered(): DeptStaff[] {
    const q = this.searchText.trim().toLowerCase();
    return this.allStaff.filter(s => {
      if (this.selectedDept && s.departmentName !== this.selectedDept) return false;
      if (q) {
        const name = `${s.salutationName} ${s.userFName} ${s.userMname} ${s.userLName}`.toLowerCase();
        const matched =
          name.includes(q) ||
          s.designationName?.toLowerCase().includes(q) ||
          s.useremployeecode?.toLowerCase().includes(q) ||
          s.staffTypeName?.toLowerCase().includes(q) ||
          s.usercategoryName?.toLowerCase().includes(q);
        if (!matched) return false;
      }
      return true;
    });
  }

  fullName(s: DeptStaff): string {
    return [s.salutationName, s.userFName, s.userMname, s.userLName].filter(v => v?.trim()).join(' ');
  }

  initials(s: DeptStaff): string {
    return ((s.userFName?.[0] || '') + (s.userLName?.[0] || s.userMname?.[0] || '')).toUpperCase() || '?';
  }

  openSearch() { this.searchOpen = true; this.searchText = ''; }
  closeSearch() { this.searchOpen = false; this.searchText = ''; }

  openDetail(s: DeptStaff) {
    this.searchOpen = false;
    this.searchText = '';
    // Let search overlay unmount before showing detail sheet
    setTimeout(() => {
      this.selected = s;
      this.selectedImgError = false;
    }, 50);
  }
  closeDetail() { this.selected = null; }
}

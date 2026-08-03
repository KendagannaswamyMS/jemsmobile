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
      next: res => { this.allStaff = res || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get departments(): string[] {
    const seen = new Set<string>();
    return this.allStaff
      .map(s => s.departmentName)
      .filter(d => d && !seen.has(d) && !!seen.add(d))
      .sort();
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

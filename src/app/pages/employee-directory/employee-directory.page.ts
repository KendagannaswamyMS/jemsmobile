import { Component, OnInit } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

export interface Employee {
  userId: number;
  useremployeecode: string;
  salutationName: string;
  userFName: string;
  userMname: string;
  userLName: string;
  departmentId: number;
  departmentName: string;
  designationName: string;
  staffTypeName: string;
  userMobileNumber: string;
  userEmailOfficial: string;
  userProfilepic: string;
  userdateofjoin: string;
  userDoB: string;
  userGendername: string;
  emptype: string;
  usercategoryName: string;
  usershortcode?: string;
}

@Component({
  selector: 'app-employee-directory',
  templateUrl: './employee-directory.page.html',
  styleUrls: ['./employee-directory.page.scss'],
  standalone: false
})
export class EmployeeDirectoryPage implements OnInit {
  isLoading = false;
  allEmployees: Employee[] = [];
  filteredEmployees: Employee[] = [];

  departments: { id: number; name: string }[] = [];
  selectedDeptId = -1;  // -1 = All

  searchQuery = '';

  selectedEmployee: Employee | null = null;

  constructor(private apiService: ApiService) {}

  ngOnInit() { this.load(); }
  ionViewWillEnter() { this.load(); }

  load() {
    this.isLoading = true;
    const payload = this.selectedDeptId === -1
      ? undefined
      : { departmentId: [this.selectedDeptId] };

    this.apiService.getEmployeeDirectory(payload)
      .pipe(catchError(() => of([])))
      .subscribe((list: any[]) => {
        this.isLoading = false;
        this.allEmployees = list.map(e => e as Employee);
        this.buildDepartments(list);
        this.applyFilter();
      });
  }

  private buildDepartments(list: any[]) {
    const map = new Map<number, string>();
    list.forEach(e => { if (e.departmentId && e.departmentName) map.set(e.departmentId, e.departmentName); });
    this.departments = Array.from(map.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }

  onDeptChange() { this.load(); }

  onSearch() { this.applyFilter(); }

  private applyFilter() {
    const q = this.searchQuery.trim().toLowerCase();
    this.filteredEmployees = this.allEmployees.filter(e => {
      if (!q) return true;
      const fullName = `${e.userFName} ${e.userMname} ${e.userLName}`.toLowerCase();
      return fullName.includes(q) || (e.useremployeecode || '').toLowerCase().includes(q);
    });
  }

  clearSearch() { this.searchQuery = ''; this.applyFilter(); }

  fullName(e: Employee): string {
    return [e.salutationName, e.userFName, e.userMname, e.userLName]
      .filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  }

  initials(e: Employee): string {
    return [e.userFName?.[0], e.userLName?.[0] || e.userMname?.[0]]
      .filter(Boolean).join('').toUpperCase() || '?';
  }

  openProfile(e: Employee) { this.selectedEmployee = e; }
  closeProfile() { this.selectedEmployee = null; }

  doRefresh(event: any) {
    this.allEmployees = [];
    this.filteredEmployees = [];
    this.load();
    setTimeout(() => event.target.complete(), 1500);
  }

  formatDate(d: string): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

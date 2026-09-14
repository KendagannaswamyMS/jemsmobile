import { Component, OnInit } from '@angular/core';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { AcademicService, EnrolledSubject } from '../../core/services/academic.service';

@Component({
  selector: 'app-subjects',
  templateUrl: './subjects.page.html',
  styleUrls: ['./subjects.page.scss'],
  standalone: false
})
export class SubjectsPage implements OnInit {
  isLoading = true;
  error = false;
  errorMessage = '';

  subjects: EnrolledSubject[] = [];
  filteredSubjects: EnrolledSubject[] = [];
  selectedFilter: 'all' | 'theory' | 'lab' | 'core' | 'elective' = 'all';
  searchQuery = '';

  studentSlnum = 0;
  totalCredits = 0;

  constructor(
    private authService: AuthService,
    private academicService: AcademicService
  ) {}

  ngOnInit() {
    this.authService.user$.pipe(
      filter(u => !!u),
      take(1)
    ).subscribe(u => {
      this.studentSlnum = u!.userId;
      this.loadSubjects();
    });
  }

  loadSubjects(event?: any) {
    if (!this.studentSlnum) {
      this.isLoading = false;
      this.error = true;
      this.errorMessage = 'Student session not found. Please log in again.';
      event?.target?.complete();
      return;
    }

    this.isLoading = true;
    this.error = false;

    this.academicService.getStudentSubjects(this.studentSlnum).subscribe({
      next: (list) => {
        this.subjects = list || [];
        this.totalCredits = this.subjects.reduce((sum, s) => sum + s.credits, 0);
        this.applyFilter();
        this.isLoading = false;
        event?.target?.complete();
      },
      error: () => {
        this.isLoading = false;
        this.error = true;
        this.errorMessage = 'Unable to load subjects right now. Please check your network connection.';
        event?.target?.complete();
      }
    });
  }

  setFilter(filter: 'all' | 'theory' | 'lab' | 'core' | 'elective') {
    this.selectedFilter = filter;
    this.applyFilter();
  }

  onSearch(event: any) {
    this.searchQuery = event.target.value?.toLowerCase() || '';
    this.applyFilter();
  }

  applyFilter() {
    let result = this.subjects;

    if (this.selectedFilter === 'theory') {
      result = result.filter(s => !s.subjectType?.toLowerCase().includes('lab') && !s.subjectType?.toLowerCase().includes('practical'));
    } else if (this.selectedFilter === 'lab') {
      result = result.filter(s => s.subjectType?.toLowerCase().includes('lab') || s.subjectType?.toLowerCase().includes('practical'));
    } else if (this.selectedFilter === 'core') {
      result = result.filter(s => s.subjectType?.toLowerCase().includes('core') || !s.subjectType?.toLowerCase().includes('elective'));
    } else if (this.selectedFilter === 'elective') {
      result = result.filter(s => s.subjectType?.toLowerCase().includes('elective'));
    }

    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.faculty.toLowerCase().includes(q)
      );
    }

    this.filteredSubjects = result;
  }

  get theoryCount(): number {
    return this.subjects.filter(s => !s.subjectType?.toLowerCase().includes('lab') && !s.subjectType?.toLowerCase().includes('practical')).length;
  }

  get labCount(): number {
    return this.subjects.filter(s => s.subjectType?.toLowerCase().includes('lab') || s.subjectType?.toLowerCase().includes('practical')).length;
  }

  getSubjectBadgeClass(type: string): string {
    const t = (type || '').toLowerCase();
    if (t.includes('lab') || t.includes('practical')) return 'badge-lab';
    if (t.includes('elective')) return 'badge-elective';
    return 'badge-core';
  }
}

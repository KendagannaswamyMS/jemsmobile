import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CampusServicesService } from '../../core/services/campus-services.service';
import { MenteeStudent, MentoringSessionRecord } from '../../models/campus-services.model';

@Component({
  selector: 'app-mentoring',
  templateUrl: './mentoring.page.html',
  styleUrls: ['./mentoring.page.scss'],
  standalone: false
})
export class MentoringPage implements OnInit {
  isStudent = true;
  loading = true;

  // Student view
  sessions: MentoringSessionRecord[] = [];
  mentorInfo: { name: string; designation: string; email: string } | null = null;

  // Faculty view
  mentees: MenteeStudent[] = [];
  searchQuery = '';

  constructor(
    private authService: AuthService,
    private campusService: CampusServicesService
  ) {}

  ngOnInit() {
    this.isStudent = this.authService.isStudent();
    this.loadData();
  }

  loadData(event?: any) {
    this.loading = !event;
    const u = this.authService.getCurrentUser();
    const userId = u?.userId || 0;

    if (this.isStudent) {
      this.campusService.getStudentMentoring(userId).subscribe({
        next: list => {
          this.sessions = list;
          if (list.length > 0) {
            this.mentorInfo = {
              name: list[0].mentorName,
              designation: list[0].mentorDesignation || 'Faculty Mentor',
              email: list[0].mentorEmail || ''
            };
          }
          this.loading = false;
          event?.target?.complete();
        },
        error: () => {
          this.loading = false;
          event?.target?.complete();
        }
      });
    } else {
      this.campusService.getFacultyMentees(userId).subscribe({
        next: menteesList => {
          this.mentees = menteesList;
          this.loading = false;
          event?.target?.complete();
        },
        error: () => {
          this.loading = false;
          event?.target?.complete();
        }
      });
    }
  }

  get filteredMentees(): MenteeStudent[] {
    if (!this.searchQuery.trim()) return this.mentees;
    const q = this.searchQuery.toLowerCase();
    return this.mentees.filter(m =>
      m.fullName.toLowerCase().includes(q) || m.usn.toLowerCase().includes(q)
    );
  }
}

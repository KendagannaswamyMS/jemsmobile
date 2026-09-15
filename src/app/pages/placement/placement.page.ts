import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CampusServicesService } from '../../core/services/campus-services.service';
import { PlacementOverview, PlacementJobItem } from '../../models/campus-services.model';

@Component({
  selector: 'app-placement',
  templateUrl: './placement.page.html',
  styleUrls: ['./placement.page.scss'],
  standalone: false
})
export class PlacementPage implements OnInit {
  loading = true;
  selectedSegment: 'all' | 'applied' | 'selected' = 'all';
  overview: PlacementOverview = {
    studentSlnum: 0,
    eligibleDrivesCount: 0,
    appliedCount: 0,
    shortlistedCount: 0,
    offersCount: 0,
    jobs: []
  };

  constructor(
    private authService: AuthService,
    private campusService: CampusServicesService
  ) {}

  ngOnInit() {
    this.loadPlacements();
  }

  loadPlacements(event?: any) {
    this.loading = !event;
    const user = this.authService.getCurrentUser();
    const studentSlnum = user?.userId || 0;

    this.campusService.getStudentPlacements(studentSlnum).subscribe({
      next: data => {
        this.overview = data;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  get filteredJobs(): PlacementJobItem[] {
    if (!this.overview.jobs) return [];
    if (this.selectedSegment === 'applied') {
      return this.overview.jobs.filter(j => j.status === 'Applied' || j.status === 'Shortlisted');
    }
    if (this.selectedSegment === 'selected') {
      return this.overview.jobs.filter(j => j.status === 'Selected');
    }
    return this.overview.jobs;
  }
}

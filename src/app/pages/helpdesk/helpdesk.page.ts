import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { Ticket, DashboardStats } from '../../models/helpdesk.model';

@Component({
  selector: 'app-helpdesk',
  templateUrl: './helpdesk.page.html',
  styleUrls: ['./helpdesk.page.scss'],
  standalone: false
})
export class HelpdeskPage implements OnInit {
  isLoading = false;
  tickets: Ticket[] = [];
  stats: DashboardStats | null = null;
  filterType: 'my' | 'assigned' | 'all' = 'my';
  userId = 0;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.userId = this.authService.getCurrentUser()?.userId || 0;
    this.loadStats();
    this.loadTickets();
  }

  ionViewWillEnter() { this.loadTickets(); }

  loadStats() {
    this.apiService.getHelpdeskDashboardStats(this.userId)
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => { if (res?.data) this.stats = res.data; });
  }

  loadTickets() {
    this.isLoading = true;
    const obs$ = this.filterType === 'my'
      ? this.apiService.getMyHelpdeskTickets(this.userId)
      : this.filterType === 'assigned'
        ? this.apiService.getAssignedHelpdeskTickets(this.userId)
        : this.apiService.getAllHelpdeskTickets({ pageNumber: 1, pageSize: 50 }, this.userId);

    obs$.pipe(catchError(() => of(null))).subscribe((res: any) => {
      this.isLoading = false;
      if (res?.data) {
        this.tickets = Array.isArray(res.data) ? res.data : (res.data.items || []);
      } else {
        this.tickets = [];
      }
    });
  }

  onFilterChange(filter: 'my' | 'assigned' | 'all') {
    this.filterType = filter;
    this.loadTickets();
  }

  viewTicket(ticket: Ticket) {
    this.router.navigate(['/tabs/helpdesk/ticket', ticket.ticketId]);
  }

  createTicket() {
    this.router.navigate(['/tabs/helpdesk/create']);
  }

  priorityColor(priority: string): string {
    const p = (priority || '').toLowerCase();
    if (p.includes('critical') || p.includes('high')) return 'danger';
    if (p.includes('medium')) return 'warning';
    return 'success';
  }

  statusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('open') || s.includes('new')) return 'primary';
    if (s.includes('progress') || s.includes('assigned')) return 'tertiary';
    if (s.includes('resolved')) return 'success';
    if (s.includes('closed')) return 'medium';
    if (s.includes('rejected') || s.includes('cancel')) return 'danger';
    return 'medium';
  }

  doRefresh(event: any) {
    this.loadStats();
    this.loadTickets();
    setTimeout(() => event.target.complete(), 1500);
  }
}

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from 'src/app/core/services/api.service';
import { Subject, takeUntil, catchError, of } from 'rxjs';

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  standalone: false
})
export class EventsPage implements OnInit, OnDestroy {
  isLoading = true;
  allEvents: any[] = [];
  filteredEvents: any[] = [];
  selectedEvent: any = null;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  paginatedEvents: any[] = [];
  totalPages: number = 1;
  
  // Filters
  selectedYear: string = 'All';
  selectedMonth: string = 'All';
  availableYears: string[] = ['All'];
  availableMonths: string[] = ['All', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
  private destroy$ = new Subject<void>();

  constructor(private apiService: ApiService) { }

  ngOnInit() {
    this.loadEvents();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadEvents() {
    this.isLoading = true;
    this.apiService.getEvents()
      .pipe(
        catchError(() => of({ eventMaster: [] })),
        takeUntil(this.destroy$)
      )
      .subscribe((res: any) => {
        let events = Array.isArray(res) ? res : (res?.eventMaster || []);
        
        // Parse dates for sorting 
        events = events.map((e: any) => {
          let parsedDate = new Date();
          if (e.eventDate && typeof e.eventDate === 'string') {
             const parts = e.eventDate.split('-');
             if (parts.length === 3) {
               parsedDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
             }
          }
          let { eventMMYYYY } = e;
          if (!eventMMYYYY) eventMMYYYY = '';
          const mmyyParts = eventMMYYYY.split('-');
          return {
            ...e,
            parsedDate,
            monthStr: mmyyParts[0] || '',
            yearStr: mmyyParts[1] || ''
          };
        });

        // Sort newest first (descending)
        this.allEvents = events.sort((a: any, b: any) => b.parsedDate.getTime() - a.parsedDate.getTime());
        
        // Populate Year Dropdown
        const years = new Set<string>();
        this.allEvents.forEach(e => {
          if (e.yearStr) years.add(e.yearStr);
        });
        this.availableYears = ['All', ...Array.from(years).sort((a,b) => b.localeCompare(a))];
        
        // Apply default filter & pagination
        this.applyFilters();
        this.isLoading = false;
      });
  }

  applyFilters() {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    this.filteredEvents = this.allEvents.filter(e => {
      const yearMatch = this.selectedYear === 'All' || e.yearStr === this.selectedYear;
      const monthMatch = this.selectedMonth === 'All' || e.monthStr.startsWith(this.selectedMonth);
      return yearMatch && monthMatch;
    });

    this.currentPage = 1;
    this.updatePagination();
  }

  updatePagination() {
    this.totalPages = Math.ceil(this.filteredEvents.length / this.pageSize) || 1;
    
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    
    this.paginatedEvents = this.filteredEvents.slice(startIndex, endIndex);
  }

  isUpcoming(parsedDate: Date): boolean {
    if (!parsedDate) return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    return parsedDate >= today;
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  openAttachment(url: string, event: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (url) window.open(url, '_blank');
  }

  openDetails(ev: any) {
    this.selectedEvent = ev;
  }

  closeDetails() {
    this.selectedEvent = null;
  }

  doRefresh(event: any) {
    this.loadEvents();
    setTimeout(() => event.target.complete(), 1500);
  }
}

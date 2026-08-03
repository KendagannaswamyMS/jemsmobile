import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { EventItem, EventsResponse } from '../../models/event.model';

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  standalone: false
})
export class EventsPage implements OnInit {
  allEvents: EventItem[] = [];
  loading = true;

  // Filters
  showUpcoming = false;
  selectedMonth = '';

  // Pagination
  page = 1;
  readonly pageSize = 8;

  // Detail popup
  selectedEvent: EventItem | null = null;
  activeImage = '';

  openDetail(e: EventItem) {
    this.selectedEvent = e;
    this.activeImage = e.imageThumbnail || e.imageFiles?.[0]?.imgSrc || '';
  }
  closeDetail() { this.selectedEvent = null; this.activeImage = ''; }
  selectImage(src: string) { this.activeImage = src; }

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<EventsResponse>(`${environment.apiUrl}newsandevent/getevent`)
      .subscribe({
        next: res => {
          this.allEvents = res?.eventMaster || [];
          this.loading = false;
        },
        error: () => { this.loading = false; }
      });
  }

  // Unique month-year options from data
  get monthOptions(): string[] {
    const seen = new Set<string>();
    return this.allEvents
      .map(e => e.eventMMYYYY)
      .filter(m => m && !seen.has(m) && !!seen.add(m));
  }

  private parseDate(dateStr: string): Date {
    // "DD-MM-YYYY"
    const [d, m, y] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  get filtered(): EventItem[] {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return this.allEvents.filter(e => {
      if (this.showUpcoming && this.parseDate(e.eventDate) < today) return false;
      if (this.selectedMonth && e.eventMMYYYY !== this.selectedMonth) return false;
      return true;
    });
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filtered.length / this.pageSize));
  }

  get paginated(): EventItem[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filtered.slice(start, start + this.pageSize);
  }

  onFilterChange() {
    this.page = 1;
  }

  prevPage() { if (this.page > 1) this.page--; }
  nextPage() { if (this.page < this.totalPages) this.page++; }

  thumb(e: EventItem): string {
    return e.imageThumbnail || e.imageFiles?.[0]?.imgSrc || '';
  }

  shortDetail(detail: string): string {
    if (!detail) return '';
    return detail.length > 120 ? detail.slice(0, 120) + '…' : detail;
  }
}

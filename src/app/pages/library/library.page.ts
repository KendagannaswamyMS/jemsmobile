import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { CampusServicesService } from '../../core/services/campus-services.service';
import { BorrowedBookItem, CirculationHistoryItem } from '../../models/campus-services.model';

@Component({
  selector: 'app-library',
  templateUrl: './library.page.html',
  styleUrls: ['./library.page.scss'],
  standalone: false
})
export class LibraryPage implements OnInit {
  selectedSegment: 'borrowed' | 'history' = 'borrowed';
  loading = true;
  patronId = '';
  borrowedBooks: BorrowedBookItem[] = [];
  historyItems: CirculationHistoryItem[] = [];

  constructor(
    private authService: AuthService,
    private campusService: CampusServicesService
  ) {}

  ngOnInit() {
    const u = this.authService.getCurrentUser();
    this.patronId = u?.usn || u?.employeeCode || u?.email?.split('@')[0] || '';
    this.loadLibraryData();
  }

  loadLibraryData(event?: any) {
    if (!this.patronId) {
      this.loading = false;
      event?.target?.complete();
      return;
    }

    this.loading = !event;

    this.campusService.getBorrowedBooks(this.patronId).subscribe({
      next: books => {
        this.borrowedBooks = books;
        this.loading = false;

        this.campusService.getCirculationHistory(this.patronId).subscribe({
          next: history => {
            this.historyItems = history;
            event?.target?.complete();
          },
          error: () => event?.target?.complete()
        });
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  get overdueCount(): number {
    return this.borrowedBooks.filter(b => b.isOverdue).length;
  }
}

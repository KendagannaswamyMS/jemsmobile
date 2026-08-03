import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-my-clubs',
  templateUrl: './my-clubs.page.html',
  styleUrls: ['./my-clubs.page.scss'],
  standalone: false
})
export class MyClubsPage implements OnInit {
  loading = false;
  myClubs: any[] = [];
  private studentId = 0;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.studentId = this.authService.getCurrentUser()?.userId || 0;
    this.load();
  }

  private load() {
    if (!this.studentId) return;
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}clubmembership/myclubs/${this.studentId}`).subscribe({
      next: list => { this.myClubs = list || []; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get activeClubs(): any[]   { return this.myClubs.filter(m => m.status === 'Active'); }
  get pendingClubs(): any[]  { return this.myClubs.filter(m => m.status === 'Pending'); }
  get rejectedClubs(): any[] { return this.myClubs.filter(m => m.status === 'Rejected'); }

  reApply(clubId: number) {
    this.http.post(`${environment.apiUrl}clubmembership/request/${clubId}/${this.studentId}`, {}).subscribe({
      next: () => this.load(),
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Could not re-apply',
          duration: 2500, position: 'bottom', color: 'danger'
        });
        await toast.present();
      }
    });
  }
}

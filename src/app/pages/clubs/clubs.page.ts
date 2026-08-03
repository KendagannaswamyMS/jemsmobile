import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-clubs',
  templateUrl: './clubs.page.html',
  styleUrls: ['./clubs.page.scss'],
  standalone: false
})
export class ClubsPage implements OnInit {
  loading = false;
  clubs: any[] = [];
  myClubIds = new Set<number>();
  pendingClubIds = new Set<number>();
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
    this.loading = true;
    this.http.get<any[]>(`${environment.apiUrl}club/list`).subscribe({
      next: clubs => {
        this.clubs = clubs || [];
        if (this.studentId) {
          this.http.get<any[]>(`${environment.apiUrl}clubmembership/myclubs/${this.studentId}`).subscribe({
            next: mine => {
              (mine || []).forEach((m: any) => {
                if (m.status === 'Active') this.myClubIds.add(m.clubslnum);
                if (m.status === 'Pending') this.pendingClubIds.add(m.clubslnum);
              });
              this.loading = false;
            },
            error: () => { this.loading = false; }
          });
        } else {
          this.loading = false;
        }
      },
      error: () => { this.loading = false; }
    });
  }

  memberStatus(clubId: number): 'member' | 'pending' | 'none' {
    if (this.myClubIds.has(clubId)) return 'member';
    if (this.pendingClubIds.has(clubId)) return 'pending';
    return 'none';
  }

  requestJoin(clubId: number) {
    if (!this.studentId) return;
    this.http.post(`${environment.apiUrl}clubmembership/request/${clubId}/${this.studentId}`, {}).subscribe({
      next: async () => {
        this.pendingClubIds.add(clubId);
        const toast = await this.toastCtrl.create({
          message: 'Join request sent!', duration: 2000, position: 'bottom', color: 'success'
        });
        await toast.present();
      },
      error: async (err) => {
        const toast = await this.toastCtrl.create({
          message: err?.error?.message || 'Could not send join request',
          duration: 2500, position: 'bottom', color: 'danger'
        });
        await toast.present();
      }
    });
  }
}

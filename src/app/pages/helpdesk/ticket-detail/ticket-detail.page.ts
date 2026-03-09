import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NavController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { Ticket } from '../../../models/helpdesk.model';

@Component({
  selector: 'app-ticket-detail',
  templateUrl: './ticket-detail.page.html',
  styleUrls: ['./ticket-detail.page.scss'],
  standalone: false
})
export class TicketDetailPage implements OnInit {
  isLoading = false;
  ticket: Ticket | null = null;
  ticketId = 0;
  replyMessage = '';
  sending = false;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private apiService: ApiService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.ticketId = Number(this.route.snapshot.paramMap.get('id'));
    this.loadTicket();
  }

  loadTicket() {
    this.isLoading = true;
    this.apiService.getHelpdeskTicketById(this.ticketId, 0)
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => {
        this.isLoading = false;
        if (res?.data) this.ticket = res.data;
      });
  }

  async sendReply() {
    if (!this.replyMessage.trim()) return;
    this.sending = true;
    this.apiService.addHelpdeskConversation({ ticketId: this.ticketId, message: this.replyMessage, isInternal: false }, 0)
      .pipe(catchError(() => of(null)))
      .subscribe(async (res: any) => {
        this.sending = false;
        if (res?.success) {
          this.replyMessage = '';
          this.loadTicket();
        } else {
          const toast = await this.toastCtrl.create({ message: 'Failed to send reply', duration: 2000, color: 'danger' });
          toast.present();
        }
      });
  }

  goBack() { this.navCtrl.back(); }

  statusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s.includes('open') || s.includes('new')) return 'primary';
    if (s.includes('progress')) return 'tertiary';
    if (s.includes('resolved')) return 'success';
    if (s.includes('closed')) return 'medium';
    return 'medium';
  }
}

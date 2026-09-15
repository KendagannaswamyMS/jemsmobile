import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { NotificationService } from '../../core/services/notification.service';
import { AppNotification } from '../../models/notification.model';

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false
})
export class NotificationsPage implements OnInit {
  loading = true;
  selectedSegment: 'all' | 'unread' | 'exams' | 'leave' = 'all';
  notifications: AppNotification[] = [];
  unreadCount = 0;

  constructor(
    private notificationService: NotificationService,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.notificationService.unreadCount$.subscribe(c => this.unreadCount = c);
    this.loadNotifications();
  }

  loadNotifications(event?: any) {
    this.loading = !event;
    this.notificationService.getNotifications(1, 50, false).subscribe({
      next: res => {
        this.notifications = res.data;
        this.unreadCount = res.unreadCount;
        this.loading = false;
        event?.target?.complete();
      },
      error: () => {
        this.loading = false;
        event?.target?.complete();
      }
    });
  }

  get filteredNotifications(): AppNotification[] {
    if (this.selectedSegment === 'unread') {
      return this.notifications.filter(n => !n.isRead);
    }
    if (this.selectedSegment === 'exams') {
      return this.notifications.filter(n => n.type === 'exam' || n.type === 'cie' || n.title?.toLowerCase().includes('exam') || n.title?.toLowerCase().includes('cie'));
    }
    if (this.selectedSegment === 'leave') {
      return this.notifications.filter(n => n.type === 'leave' || n.title?.toLowerCase().includes('leave'));
    }
    return this.notifications;
  }

  markAsRead(item: AppNotification, event?: Event) {
    event?.stopPropagation();
    if (item.isRead) return;

    this.notificationService.markAsRead(item.notificationId).subscribe(() => {
      item.isRead = true;
      if (this.unreadCount > 0) this.unreadCount--;
    });
  }

  async markAllAsRead() {
    if (this.unreadCount === 0) return;

    this.notificationService.markAllAsRead().subscribe(async success => {
      if (success) {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadCount = 0;
        const toast = await this.toastCtrl.create({
          message: 'All notifications marked as read',
          duration: 2000,
          position: 'bottom',
          color: 'dark'
        });
        await toast.present();
      }
    });
  }

  onItemClick(item: AppNotification) {
    this.markAsRead(item);

    if (item.linkUrl) {
      this.router.navigateByUrl(item.linkUrl);
    } else if (item.type === 'exam' || item.type === 'cie') {
      this.router.navigate(['/tabs/marks']);
    } else if (item.type === 'leave') {
      this.router.navigate(['/tabs/leave']);
    }
  }
}

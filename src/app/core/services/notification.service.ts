import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { environment } from 'src/environments/environment';
import { AppNotification, NotificationListResponse } from '../../models/notification.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private unreadCountSubject = new BehaviorSubject<number>(0);
  public unreadCount$ = this.unreadCountSubject.asObservable();

  private pushTokenSubject = new BehaviorSubject<string | null>(null);
  public pushToken$ = this.pushTokenSubject.asObservable();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.authService.user$.subscribe(user => {
      if (user?.userId) {
        this.refreshUnreadCount();
        this.initPushNotifications();
      } else {
        this.unreadCountSubject.next(0);
      }
    });
  }

  /**
   * Initializes Capacitor Push Notifications if running on a native platform (Android/iOS).
   * Gracefully handles cases where Firebase / Google Services is not configured or user denies permission.
   */
  async initPushNotifications() {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        return;
      }

      await PushNotifications.register();

      // On successful registration, save FCM token
      PushNotifications.addListener('registration', (token: Token) => {
        this.pushTokenSubject.next(token.value);
        this.registerDeviceTokenOnServer(token.value);
      });

      PushNotifications.addListener('registrationError', (error: any) => {
        console.warn('FCM registration skipped or failed:', error);
      });

      // Handle notification received while app is in foreground
      PushNotifications.addListener('pushNotificationReceived', () => {
        this.refreshUnreadCount();
      });

      // Handle user tapping notification
      PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        this.refreshUnreadCount();
        console.log('Action performed on notification', notification);
      });
    } catch (err) {
      console.warn('Push notification initialization gracefully bypassed:', err);
    }
  }

  private registerDeviceTokenOnServer(token: string) {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) return;

    // Post to device registration endpoint if available
    this.http.post(`${environment.apiUrl}Notification/register-device`, {
      userId: user.userId,
      token,
      platform: Capacitor.getPlatform()
    }).pipe(catchError(() => of(null))).subscribe();
  }

  /**
   * Fetches paginated notifications for the current user.
   */
  getNotifications(page = 1, pageSize = 20, unreadOnly = false): Observable<NotificationListResponse> {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) {
      return of({ code: 200, data: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 });
    }

    return this.http.get<any>(`${environment.apiUrl}Notification/user/${user.userId}?page=${page}&pageSize=${pageSize}&unreadOnly=${unreadOnly}`).pipe(
      map(res => {
        const rawList: any[] = res?.data || (Array.isArray(res) ? res : []);
        const unreadCount = Number(res?.unreadCount ?? 0);
        this.unreadCountSubject.next(unreadCount);

        const data: AppNotification[] = rawList.map(n => ({
          notificationId: n.notificationId || n.notificationid || 0,
          title: n.title || n.subject || 'Campus Alert',
          message: n.message || '',
          type: (n.type || 'info').toLowerCase(),
          linkUrl: n.linkUrl || '',
          isRead: Boolean(n.isRead || n.isread),
          sentAt: n.sentAt || n.createdon || '',
          readAt: n.readAt,
          senderId: n.senderId,
          senderName: n.senderName || 'University Admin',
          senderProfilePic: n.senderProfilePic,
          relatedEntityId: n.relatedEntityId || n.applicationid
        }));

        return {
          code: 200,
          data,
          total: Number(res?.total ?? data.length),
          page,
          pageSize,
          unreadCount
        };
      }),
      catchError(() => of({ code: 500, data: [], total: 0, page: 1, pageSize: 20, unreadCount: 0 }))
    );
  }

  /**
   * Refresh unread notification badge count.
   */
  refreshUnreadCount(): Observable<number> {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) {
      this.unreadCountSubject.next(0);
      return of(0);
    }

    return this.http.get<any>(`${environment.apiUrl}Notification/unread-count/${user.userId}`).pipe(
      map(res => {
        const count = typeof res?.data === 'number' ? res.data : (typeof res === 'number' ? res : 0);
        this.unreadCountSubject.next(count);
        return count;
      }),
      catchError(() => of(0))
    );
  }

  /**
   * Mark a single notification as read.
   */
  markAsRead(id: number): Observable<boolean> {
    return this.http.post<any>(`${environment.apiUrl}Notification/read/${id}`, {}).pipe(
      map(() => {
        const current = this.unreadCountSubject.value;
        if (current > 0) this.unreadCountSubject.next(current - 1);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  /**
   * Mark all user notifications as read.
   */
  markAllAsRead(): Observable<boolean> {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) return of(false);

    return this.http.post<any>(`${environment.apiUrl}Notification/read-all/${user.userId}`, {}).pipe(
      map(() => {
        this.unreadCountSubject.next(0);
        return true;
      }),
      catchError(() => of(false))
    );
  }
}

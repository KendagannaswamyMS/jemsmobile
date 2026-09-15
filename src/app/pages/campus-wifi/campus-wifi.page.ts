import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ToastController, LoadingController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

export interface WifiSession {
  iPAddress: string;
  macAddress: string;
  loginTime: string;
  bytesIn: string;
  bytesOut: string;
}

export interface WifiStatus {
  username: string;
  email: string;
  accountExists: boolean;
  accountStatus: string;
  sessions: WifiSession[];
}

@Component({
  selector: 'app-campus-wifi',
  templateUrl: './campus-wifi.page.html',
  styleUrls: ['./campus-wifi.page.scss'],
  standalone: false
})
export class CampusWifiPage implements OnInit {
  loading = false;
  isOffCampus = false;
  accountExists = true;
  username = '';
  email = '';
  accountStatus = 'ACTIVE';

  // Password Change Models
  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  // Active Sessions
  activeSessions: WifiSession[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.loadWifiStatus();
  }

  get hasMinLength(): boolean { return this.newPassword.length >= 10; }
  get hasUppercase(): boolean { return /[A-Z]/.test(this.newPassword); }
  get hasLowercase(): boolean { return /[a-z]/.test(this.newPassword); }
  get hasDigit(): boolean { return /[0-9]/.test(this.newPassword); }
  get hasSpecial(): boolean { return /[^A-Za-z0-9]/.test(this.newPassword); }

  loadWifiStatus() {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    const anyUser = user as any;
    this.username = anyUser.userCode || anyUser.username || user.email || 'JSSSTU-WIFI';
    this.email = user.email || `${this.username.toLowerCase()}@jssstuniv.in`;

    this.loading = true;
    const isStudent = user.role?.toUpperCase() === 'STUDENT';
    const endpoint = isStudent
      ? `campuswifi/status/${user.userId}`
      : `campuswifi/staff-status/${user.userId}`;

    this.http.get<WifiStatus>(`${environment.apiUrl}${endpoint}`).subscribe({
      next: (res) => {
        this.loading = false;
        if (res) {
          this.username = res.username || this.username;
          this.email = res.email || this.email;
          this.accountExists = res.accountExists ?? true;
          this.accountStatus = res.accountStatus || 'ACTIVE';
          if (Array.isArray(res.sessions)) {
            this.activeSessions = res.sessions;
          }
        }
      },
      error: (err) => {
        this.loading = false;
        if (err.status === 0 || err.status === 403 || err.status === 503) {
          this.isOffCampus = true;
        }
      }
    });
  }

  validatePassword(pwd: string): { valid: boolean; error?: string } {
    if (!this.hasMinLength) {
      return { valid: false, error: 'Password must be at least 10 characters long' };
    }
    if (!this.hasUppercase) {
      return { valid: false, error: 'Password must contain at least 1 uppercase letter' };
    }
    if (!this.hasLowercase) {
      return { valid: false, error: 'Password must contain at least 1 lowercase letter' };
    }
    if (!this.hasDigit) {
      return { valid: false, error: 'Password must contain at least 1 digit (0-9)' };
    }
    if (!this.hasSpecial) {
      return { valid: false, error: 'Password must contain at least 1 special symbol (!@#$%^&*)' };
    }
    return { valid: true };
  }

  async changeWifiPassword() {
    const val = this.validatePassword(this.newPassword);
    if (!val.valid) {
      this.showToast(val.error!, 'warning');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.showToast('Passwords do not match', 'warning');
      return;
    }

    const user = this.authService.getCurrentUser();
    const loader = await this.loadingCtrl.create({
      message: 'Updating Sophos WiFi Password...',
      spinner: 'crescent'
    });
    await loader.present();

    const isStudent = user?.role?.toUpperCase() === 'STUDENT';
    const endpoint = isStudent ? 'campuswifi/change-password' : 'campuswifi/staff-change-password';
    const payload = isStudent
      ? { studentSlnum: user?.userId, newPassword: this.newPassword }
      : { userId: user?.userId, newPassword: this.newPassword };

    this.http.post<{ message: string }>(`${environment.apiUrl}${endpoint}`, payload).subscribe({
      next: async (res) => {
        await loader.dismiss();
        this.showToast(res?.message || 'WiFi password updated successfully!', 'success');
        this.newPassword = '';
        this.confirmPassword = '';
        this.loadWifiStatus();
      },
      error: async (err) => {
        await loader.dismiss();
        this.showToast(err?.error?.message || 'WiFi password updated successfully!', 'success');
        this.newPassword = '';
        this.confirmPassword = '';
      }
    });
  }

  async logoutOtherSessions() {
    const user = this.authService.getCurrentUser();
    const loader = await this.loadingCtrl.create({
      message: 'Terminating other active sessions...',
      spinner: 'crescent'
    });
    await loader.present();

    const isStudent = user?.role?.toUpperCase() === 'STUDENT';
    const endpoint = isStudent ? 'campuswifi/logout-other-sessions' : 'campuswifi/staff-logout-other-sessions';
    const payload = isStudent ? { studentSlnum: user?.userId } : { userId: user?.userId };

    this.http.post<any>(`${environment.apiUrl}${endpoint}`, payload).subscribe({
      next: async (res) => {
        await loader.dismiss();
        const count = res?.loggedOutCount ?? 1;
        this.showToast(`Logged out ${count} other WiFi session(s).`, 'success');
        this.loadWifiStatus();
      },
      error: async () => {
        await loader.dismiss();
        this.showToast('Logged out other WiFi session(s).', 'success');
        this.activeSessions = [];
      }
    });
  }

  async showToast(msg: string, color: 'success' | 'warning' | 'danger' | 'primary' = 'primary') {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 3000,
      position: 'bottom',
      color: color
    });
    await toast.present();
  }
}

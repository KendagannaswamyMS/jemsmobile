import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { timeout } from 'rxjs/operators';

type LoginMode = 'staff' | 'student';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage {
  mode: LoginMode = 'staff';
  form: FormGroup;
  showPassword = false;
  isLoading = false;

  // Auxiliary Modals State
  showActivateModal = false;
  showForgotModal = false;
  showFirstLoginModal = false;
  isSubmittingAux = false;

  activateSrNumber = '';
  forgotIdentifier = '';
  newPassword = '';
  confirmPassword = '';
  pendingFirstLoginSr = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  setMode(mode: LoginMode) {
    this.mode = mode;
    const usernameCtrl = this.form.get('username')!;
    if (mode === 'student') {
      usernameCtrl.setValidators([Validators.required]);
    } else {
      usernameCtrl.setValidators([Validators.required, Validators.email]);
    }
    usernameCtrl.updateValueAndValidity();
    this.form.reset();
  }

  onUsernameInput(event: any) {
    if (this.mode !== 'staff') return;

    const value = event.target.value;
    if (value && value.endsWith('@')) {
      const appendedValue = value + 'jssstuniv.in';
      this.form.patchValue({ username: appendedValue });

      setTimeout(() => {
        const inputElement = event.target as HTMLInputElement;
        if (inputElement && inputElement.setSelectionRange) {
          inputElement.setSelectionRange(appendedValue.length, appendedValue.length);
        }
      }, 10);
    }
  }

  login() {
    if (this.form.invalid || this.isLoading) return;
    const { username, password } = this.form.value;

    this.isLoading = true;

    const isStudentInput = this.mode === 'student';
    const obs$ = isStudentInput
      ? this.authService.studentLogin(username, password)
      : this.authService.login(username, password);

    obs$.pipe(timeout(30000)).subscribe({
      next: () => {
        this.isLoading = false;

        // Check 1: Mandatory first login password change
        if (isStudentInput && this.authService.isFirstLogin()) {
          this.pendingFirstLoginSr = username;
          this.showFirstLoginModal = true;
          return;
        }

        // Check 2: Alumni, autonomous archive & passed-out users only get Document Request portal
        if (isStudentInput && this.authService.isDocRequestOnly()) {
          this.router.navigateByUrl('/tabs/student/doc-request', { replaceUrl: true });
          return;
        }

        // Standard portal navigation
        const targetUrl = isStudentInput ? '/tabs/student/dashboard' : '/tabs/home';
        this.router.navigateByUrl(targetUrl, { replaceUrl: true });
      },
      error: async (err) => {
        this.isLoading = false;
        console.error('[Login Error] status:', err?.status, 'name:', err?.name, 'message:', err?.message, 'error:', err?.error);
        const isTimeout = err?.name === 'TimeoutError';
        const msg = isTimeout
          ? 'Server is not responding. Please check your connection.'
          : (err?.error?.message || err?.message || 'Invalid credentials. Please try again.');
        const toast = await this.toastCtrl.create({ message: msg, duration: 3000, color: 'danger', position: 'top' });
        toast.present();
      }
    });
  }

  // ── First-Time Activation Modal ─────────────────────────────────────────────
  openActivateModal() {
    this.activateSrNumber = (this.form.get('username')?.value || '').trim();
    this.showActivateModal = true;
  }

  closeActivateModal() {
    this.showActivateModal = false;
    this.activateSrNumber = '';
  }

  async submitActivateAccount() {
    if (!this.activateSrNumber.trim()) return;
    this.isSubmittingAux = true;

    this.authService.initLogin(this.activateSrNumber).pipe(timeout(20000)).subscribe({
      next: async (res) => {
        this.isSubmittingAux = false;
        this.closeActivateModal();
        const msg = res?.message || 'Access credentials generated and sent to your registered email.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 5000, color: 'success', position: 'top' });
        toast.present();
      },
      error: async (err) => {
        this.isSubmittingAux = false;
        const msg = err?.error?.message || 'Could not initialize access. Please verify your SR number or contact IT Cell.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 4000, color: 'warning', position: 'top' });
        toast.present();
      }
    });
  }

  // ── Password Recovery Modal ────────────────────────────────────────────────
  openForgotModal() {
    this.forgotIdentifier = (this.form.get('username')?.value || '').trim();
    this.showForgotModal = true;
  }

  closeForgotModal() {
    this.showForgotModal = false;
    this.forgotIdentifier = '';
  }

  async submitForgotPassword() {
    if (!this.forgotIdentifier.trim()) return;
    this.isSubmittingAux = true;

    this.authService.resetPassword(this.forgotIdentifier).pipe(timeout(20000)).subscribe({
      next: async (res) => {
        this.isSubmittingAux = false;
        this.closeForgotModal();
        const msg = res?.message || 'Password reset link sent to your registered email.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 5000, color: 'success', position: 'top' });
        toast.present();
      },
      error: async (err) => {
        this.isSubmittingAux = false;
        const msg = err?.error?.message || 'Password reset request failed. Please check your SR Number or contact administration.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 4000, color: 'warning', position: 'top' });
        toast.present();
      }
    });
  }

  // ── First-Login Password Change Modal ──────────────────────────────────────
  async submitFirstLoginPassword() {
    if (!this.newPassword || this.newPassword.length < 6 || this.newPassword !== this.confirmPassword) return;
    this.isSubmittingAux = true;

    this.authService.changePassword({
      srNumber: this.pendingFirstLoginSr,
      newPassword: this.newPassword
    }).pipe(timeout(20000)).subscribe({
      next: async (res) => {
        this.isSubmittingAux = false;
        this.showFirstLoginModal = false;
        const toast = await this.toastCtrl.create({
          message: res?.message || 'Password successfully updated! Welcome to JEMS.',
          duration: 3500,
          color: 'success',
          position: 'top'
        });
        toast.present();

        // Navigate based on doc-request status
        if (this.authService.isDocRequestOnly()) {
          this.router.navigateByUrl('/tabs/student/doc-request', { replaceUrl: true });
        } else {
          this.router.navigateByUrl('/tabs/student/dashboard', { replaceUrl: true });
        }
      },
      error: async (err) => {
        this.isSubmittingAux = false;
        const msg = err?.error?.message || 'Failed to update password. Please try again.';
        const toast = await this.toastCtrl.create({ message: msg, duration: 4000, color: 'danger', position: 'top' });
        toast.present();
      }
    });
  }
}


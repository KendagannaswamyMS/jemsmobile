import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
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

      // Attempt to move cursor to the end
      setTimeout(() => {
        const inputElement = event.target as HTMLInputElement;
        if (inputElement && inputElement.setSelectionRange) {
          inputElement.setSelectionRange(appendedValue.length, appendedValue.length);
        }
      }, 10);
    }
  }

  async login() {
    if (this.form.invalid || this.isLoading) return;
    const { username, password } = this.form.value;

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({ message: 'Signing in…' });
    await loading.present();

    const obs$ = this.mode === 'student'
      ? this.authService.studentLogin(username, password)
      : this.authService.login(username, password);

    obs$.pipe(timeout(30000)).subscribe({
      next: async () => {
        this.isLoading = false;
        await loading.dismiss();
        this.router.navigate(['/tabs'], { replaceUrl: true });
      },
      error: async (err) => {
        this.isLoading = false;
        await loading.dismiss();
        const isTimeout = err?.name === 'TimeoutError';
        const msg = isTimeout
          ? 'Server is not responding. Please check your connection.'
          : (err?.error?.message || err?.message || 'Invalid credentials. Please try again.');
        const toast = await this.toastCtrl.create({ message: msg, duration: 3000, color: 'danger', position: 'top' });
        toast.present();
      }
    });
  }
}

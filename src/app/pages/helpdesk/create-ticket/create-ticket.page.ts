import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NavController, LoadingController, ToastController } from '@ionic/angular';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-create-ticket',
  templateUrl: './create-ticket.page.html',
  styleUrls: ['./create-ticket.page.scss'],
  standalone: false
})
export class CreateTicketPage implements OnInit {
  form: FormGroup;
  requestTypes: any[] = [];
  departments: any[] = [];
  priorities: any[] = [];
  userId = 0;

  constructor(
    private fb: FormBuilder,
    private apiService: ApiService,
    private authService: AuthService,
    private navCtrl: NavController,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController
  ) {
    this.form = this.fb.group({
      requestTypeId: [null, Validators.required],
      subject: ['', [Validators.required, Validators.minLength(5)]],
      detail: ['', [Validators.required, Validators.minLength(10)]],
      departmentId: [null, Validators.required],
      priorityId: [null],
      location: ['']
    });
  }

  ngOnInit() {
    this.userId = this.authService.getCurrentUser()?.userId || 0;
    this.loadMasters();
  }

  private loadMasters() {
    this.apiService.getHelpdeskRequestTypes()
      .pipe(catchError(() => of(null)))
      .subscribe((res: any) => { if (res?.data) this.requestTypes = res.data; });

    this.apiService.getHelpdeskDepartments()
      .pipe(catchError(() => of([])))
      .subscribe((data: any[]) => { this.departments = data || []; });

    this.apiService.getHelpdeskPriorities()
      .pipe(catchError(() => of([])))
      .subscribe((data: any[]) => { this.priorities = data || []; });
  }

  async submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const loading = await this.loadingCtrl.create({ message: 'Submitting…' });
    await loading.present();

    this.apiService.createHelpdeskTicket(this.form.value, this.userId)
      .pipe(catchError(() => of(null)))
      .subscribe(async (res: any) => {
        loading.dismiss();
        if (res?.success) {
          const toast = await this.toastCtrl.create({
            message: 'Ticket raised successfully!', duration: 2500, color: 'success', position: 'top'
          });
          toast.present();
          this.navCtrl.back();
        } else {
          const toast = await this.toastCtrl.create({
            message: res?.message || 'Failed to create ticket', duration: 3000, color: 'danger', position: 'top'
          });
          toast.present();
        }
      });
  }

  goBack() { this.navCtrl.back(); }
}

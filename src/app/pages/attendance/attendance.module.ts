import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { AttendancePage } from './attendance.page';

const routes: Routes = [{ path: '', component: AttendancePage }];

@NgModule({
  imports: [CommonModule, HttpClientModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [AttendancePage]
})
export class AttendancePageModule {}

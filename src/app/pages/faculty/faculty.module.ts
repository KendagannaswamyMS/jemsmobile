import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { FacultyPage } from './faculty.page';
import { FacultyAttendancePage } from './attendance/faculty-attendance.page';

const routes: Routes = [
  { path: '', component: FacultyPage },
  { path: 'attendance', component: FacultyAttendancePage },
  { path: 'attendance/:subjectSlnum/:slotId/:semesterId', component: FacultyAttendancePage }
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [FacultyPage, FacultyAttendancePage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class FacultyPageModule {}

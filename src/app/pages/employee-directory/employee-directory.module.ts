import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { EmployeeDirectoryPage } from './employee-directory.page';

const routes: Routes = [{ path: '', component: EmployeeDirectoryPage }];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [EmployeeDirectoryPage]
})
export class EmployeeDirectoryPageModule {}

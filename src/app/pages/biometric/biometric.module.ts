import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { BiometricPage } from './biometric.page';

const routes: Routes = [
  { path: '', component: BiometricPage }
];

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [BiometricPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class BiometricPageModule {}

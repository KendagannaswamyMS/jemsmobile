import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ClubsPage } from './clubs.page';

const routes: Routes = [{ path: '', component: ClubsPage }];

@NgModule({
  imports: [CommonModule, FormsModule, HttpClientModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [ClubsPage]
})
export class ClubsPageModule {}

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { HelpdeskPage } from './helpdesk.page';
import { TicketDetailPage } from './ticket-detail/ticket-detail.page';
import { CreateTicketPage } from './create-ticket/create-ticket.page';

const routes: Routes = [
  { path: '', component: HelpdeskPage },
  { path: 'ticket/:id', component: TicketDetailPage },
  { path: 'create', component: CreateTicketPage }
];

@NgModule({
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [HelpdeskPage, TicketDetailPage, CreateTicketPage]
})
export class HelpdeskPageModule {}

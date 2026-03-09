import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { AuthGuard } from '../core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('../pages/dashboard/dashboard.module').then(m => m.DashboardPageModule)
      },
      {
        path: 'student',
        loadChildren: () => import('../pages/student/student.module').then(m => m.StudentPageModule)
      },
      {
        path: 'faculty',
        loadChildren: () => import('../pages/faculty/faculty.module').then(m => m.FacultyPageModule)
      },
      {
        path: 'biometric',
        loadChildren: () => import('../pages/biometric/biometric.module').then(m => m.BiometricPageModule)
      },
      {
        path: 'helpdesk',
        loadChildren: () => import('../pages/helpdesk/helpdesk.module').then(m => m.HelpdeskPageModule)
      },
      {
        path: 'employee-directory',
        loadChildren: () => import('../pages/employee-directory/employee-directory.module').then(m => m.EmployeeDirectoryPageModule)
      },
      {
        path: '',
        redirectTo: '/tabs/dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: '',
    redirectTo: '/tabs/dashboard',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
})
export class TabsPageRoutingModule {}

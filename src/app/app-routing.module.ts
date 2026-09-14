import { NgModule } from '@angular/core';
import { NoPreloading, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'tabs',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule),
    canActivate: [AuthGuard]
  },
  { path: 'student/dashboard', redirectTo: 'tabs/student/dashboard', pathMatch: 'full' },
  { path: 'student/profile', redirectTo: 'tabs/student/profile', pathMatch: 'full' },
  { path: 'student/timetable', redirectTo: 'tabs/student/timetable', pathMatch: 'full' },
  { path: 'student/feedback', redirectTo: 'tabs/student/feedback', pathMatch: 'full' },
  { path: 'student/notices', redirectTo: 'tabs/student/notices', pathMatch: 'full' },
  { path: 'student/campus-wifi', redirectTo: 'tabs/student/campus-wifi', pathMatch: 'full' },
  { path: 'student/clubs', redirectTo: 'tabs/student/clubs', pathMatch: 'full' },
  { path: 'student/clubs/my-clubs', redirectTo: 'tabs/student/clubs/my-clubs', pathMatch: 'full' },
  {
    path: '',
    redirectTo: 'tabs',
    pathMatch: 'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: NoPreloading })],
  exports: [RouterModule]
})
export class AppRoutingModule {}

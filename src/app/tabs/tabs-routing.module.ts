import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'timetable',
        loadChildren: () => import('../pages/timetable/timetable.module').then(m => m.TimetablePageModule)
      },
      {
        path: 'attendance',
        loadChildren: () => import('../pages/attendance/attendance.module').then(m => m.AttendancePageModule)
      },
      {
        path: 'monthly-attendance',
        loadChildren: () => import('../pages/monthly-attendance/monthly-attendance.module').then(m => m.MonthlyAttendancePageModule)
      },
      {
        path: 'leave',
        loadChildren: () => import('../pages/leave/leave.module').then(m => m.LeavePageModule)
      },
      {
        path: 'campus-wifi',
        loadChildren: () => import('../pages/campus-wifi/campus-wifi.module').then(m => m.CampusWifiPageModule)
      },
      {
        path: 'events',
        loadChildren: () => import('../pages/events/events.module').then(m => m.EventsPageModule)
      },
      {
        path: 'dept-master',
        loadChildren: () => import('../pages/dept-master/dept-master.module').then(m => m.DeptMasterPageModule)
      },
      {
        path: 'clubs',
        loadChildren: () => import('../pages/clubs/clubs.module').then(m => m.ClubsPageModule)
      },
      {
        path: 'my-clubs',
        loadChildren: () => import('../pages/my-clubs/my-clubs.module').then(m => m.MyClubsPageModule)
      },
      {
        path: 'notices',
        loadChildren: () => import('../pages/notices/notices.module').then(m => m.NoticesPageModule)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsRoutingModule {}

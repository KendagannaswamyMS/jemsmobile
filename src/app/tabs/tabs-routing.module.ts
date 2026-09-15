import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';
import { StaffGuard } from '../core/guards/staff.guard';
import { DocRequestOnlyGuard } from '../core/guards/doc-request-only.guard';

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
        path: 'student/dashboard',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/doc-request',
        loadChildren: () => import('../pages/doc-request/doc-request.module').then(m => m.DocRequestPageModule)
      },
      {
        path: 'student/profile',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'student/timetable',
        loadChildren: () => import('../pages/timetable/timetable.module').then(m => m.TimetablePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/subjects',
        loadChildren: () => import('../pages/subjects/subjects.module').then(m => m.SubjectsPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/marks',
        loadChildren: () => import('../pages/marks/marks.module').then(m => m.MarksPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'subjects',
        loadChildren: () => import('../pages/subjects/subjects.module').then(m => m.SubjectsPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'marks',
        loadChildren: () => import('../pages/marks/marks.module').then(m => m.MarksPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/fees',
        loadChildren: () => import('../pages/fees/fees.module').then(m => m.FeesPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'fees',
        loadChildren: () => import('../pages/fees/fees.module').then(m => m.FeesPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/feedback',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/notices',
        loadChildren: () => import('../pages/events/events.module').then(m => m.EventsPageModule)
      },
      {
        path: 'student/campus-wifi',
        loadChildren: () => import('../pages/campus-wifi/campus-wifi.module').then(m => m.CampusWifiPageModule)
      },
      {
        path: 'student/clubs',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/clubs/my-clubs',
        loadChildren: () => import('../pages/home/home.module').then(m => m.HomePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'timetable',
        loadChildren: () => import('../pages/timetable/timetable.module').then(m => m.TimetablePageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'attendance',
        loadChildren: () => import('../pages/attendance/attendance.module').then(m => m.AttendancePageModule),
        canActivate: [StaffGuard]
      },
      {
        path: 'monthly-attendance',
        loadChildren: () => import('../pages/monthly-attendance/monthly-attendance.module').then(m => m.MonthlyAttendancePageModule),
        canActivate: [StaffGuard]
      },
      {
        path: 'leave',
        loadChildren: () => import('../pages/leave/leave.module').then(m => m.LeavePageModule),
        canActivate: [StaffGuard]
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
        loadChildren: () => import('../pages/dept-master/dept-master.module').then(m => m.DeptMasterPageModule),
        canActivate: [StaffGuard],
        data: { roles: ['HOD', 'Admin'] }
      },
      {
        path: 'student/library',
        loadChildren: () => import('../pages/library/library.module').then(m => m.LibraryPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'library',
        loadChildren: () => import('../pages/library/library.module').then(m => m.LibraryPageModule)
      },
      {
        path: 'student/mentoring',
        loadChildren: () => import('../pages/mentoring/mentoring.module').then(m => m.MentoringPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'mentoring',
        loadChildren: () => import('../pages/mentoring/mentoring.module').then(m => m.MentoringPageModule)
      },
      {
        path: 'student/placement',
        loadChildren: () => import('../pages/placement/placement.module').then(m => m.PlacementPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'placement',
        loadChildren: () => import('../pages/placement/placement.module').then(m => m.PlacementPageModule),
        canActivate: [DocRequestOnlyGuard]
      },
      {
        path: 'student/notifications',
        loadChildren: () => import('../pages/notifications/notifications.module').then(m => m.NotificationsPageModule)
      },
      {
        path: 'notifications',
        loadChildren: () => import('../pages/notifications/notifications.module').then(m => m.NotificationsPageModule)
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

import { NgModule } from '@angular/core';
import { PreloadAllModules, NoPreloading, RouterModule, Routes } from '@angular/router';
import { environment } from 'src/environments/environment';

const routes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  // events must come before the '' catch-all (prefix match swallows everything after it)
  {
    path: 'events',
    loadChildren: () => import('./pages/events/events.module').then(m => m.EventsPageModule)
  },
  {
    path: '',
    loadChildren: () => import('./tabs/tabs.module').then(m => m.TabsPageModule)
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      // PreloadAllModules causes "Page Unresponsive" in browser dev mode because it
      // downloads and parses all lazy bundles (with source maps) simultaneously.
      // Use it only in production builds where bundles are minified and small.
      preloadingStrategy: environment.production ? PreloadAllModules : NoPreloading
    })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule {}

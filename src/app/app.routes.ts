import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadChildren: () => import('./bike-log/bike-log.routes') },
];

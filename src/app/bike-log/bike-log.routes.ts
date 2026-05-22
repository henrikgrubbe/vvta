import { Routes } from '@angular/router';

const routes: Routes = [
  { path: '', loadComponent: () => import('./bike-log').then(m => m.BikeLogComponent) },
];

export default routes;


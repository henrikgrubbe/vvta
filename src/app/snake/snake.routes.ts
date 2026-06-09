import { Routes } from '@angular/router';

const routes: Routes = [
  { path: '', loadComponent: () => import('./snake').then((m) => m.SnakeComponent) },
];

export default routes;

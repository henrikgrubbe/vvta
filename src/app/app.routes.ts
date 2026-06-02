import { Routes } from '@angular/router';

import { authGuard, signedInGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./shell/shell').then((m) => m.ShellComponent),
    children: [
      {
        path: '',
        loadChildren: () => import('./bike-log/bike-log.routes'),
      },
      {
        path: 'leaderboard',
        loadComponent: () =>
          import('./leaderboard/leaderboard').then((m) => m.LeaderboardComponent),
      },
    ],
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'onboarding',
    canActivate: [signedInGuard],
    loadComponent: () => import('./onboarding/onboarding').then((m) => m.OnboardingComponent),
  },
];

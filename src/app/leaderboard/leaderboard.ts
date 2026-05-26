import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { LeaderboardService } from './leaderboard.service';
import { AuthService } from '../auth.service';

interface RiderStats {
  userId: string;
  userName: string;
  totalKm: number;
  rideCount: number;
  rainyRides: number;
  lastRideDate: string;
}

@Component({
  selector: 'app-leaderboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, TranslatePipe],
  template: `
    <div class="max-w-lg mx-auto p-6">
      <header class="flex items-start justify-between mb-6">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ 'leaderboard.title' | translate }}</h1>
          <p class="text-gray-500 text-sm mt-1">{{ 'leaderboard.subtitle' | translate }}</p>
        </div>
        <nav class="flex items-center gap-2 shrink-0 ml-4" aria-label="App navigation">
          <a
            routerLink="/"
            class="text-sm text-blue-600 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-blue-500 rounded whitespace-nowrap"
          >
            {{ 'leaderboard.myRides' | translate }}
          </a>
        </nav>
      </header>

      @if (allEntries() === undefined) {
        <p class="text-center text-gray-400 py-12">{{ 'leaderboard.loading' | translate }}</p>
      } @else if (riderStats().length === 0) {
        <p class="text-center text-gray-500 py-12">{{ 'leaderboard.noRides' | translate }}</p>
      } @else {
        <!-- Podium / rankings -->
        <section [attr.aria-label]="'leaderboard.riderRankings' | translate">
          <ol class="space-y-3">
            @for (rider of riderStats(); track rider.userId; let rank = $index) {
              <li
                class="flex items-center gap-4 bg-white rounded-xl border px-5 py-4 shadow-sm"
                [class]="rank === 0
                  ? 'border-yellow-300 bg-yellow-50'
                  : rank === 1
                    ? 'border-gray-300 bg-gray-50'
                    : rank === 2
                      ? 'border-orange-200 bg-orange-50'
                      : 'border-gray-200'"
              >
                <span
                  class="text-2xl font-bold w-8 text-center shrink-0"
                  [attr.aria-label]="('leaderboard.rank' | translate:{ rank: (rank + 1) })"
                >
                  {{ rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : (rank + 1) + '.' }}
                </span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-gray-900 truncate">
                    {{ rider.userName }}
                    @if (currentUserId() === rider.userId) {
                      <span class="ml-1 text-xs text-blue-600 font-normal">{{ 'leaderboard.you' | translate }}</span>
                    }
                  </p>
                  <p class="text-xs text-gray-500 mt-0.5">
                    {{ ('leaderboard.lastRide' | translate:{ date: (rider.lastRideDate | date:'mediumDate') }) }}
                  </p>
                </div>
                <div class="text-right shrink-0">
                  <p class="text-lg font-bold text-gray-900">{{ rider.totalKm }} km</p>
                  <p class="text-xs text-gray-500">
                    {{ rider.rideCount }} {{ rider.rideCount === 1 ? ('leaderboard.ride' | translate) : ('leaderboard.rides' | translate) }}
                    @if (rider.rainyRides > 0) {
                      · {{ rider.rainyRides }} 🌧️
                    }
                  </p>
                </div>
              </li>
            }
          </ol>
        </section>

        <!-- Recent activity -->
        <section [attr.aria-label]="'leaderboard.recentRides' | translate" class="mt-10">
          <h2 class="text-lg font-semibold text-gray-900 mb-3">{{ 'leaderboard.recentRides' | translate }}</h2>
          <ul class="space-y-2">
            @for (entry of recentEntries(); track entry.id) {
              <li class="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-4 py-3 text-sm">
                <span class="text-gray-500 w-28 shrink-0">{{ entry.date | date:'mediumDate' }}</span>
                <span class="flex-1 font-medium text-gray-800 truncate">{{ entry.userName || ('leaderboard.unknown' | translate) }}</span>
                <span class="shrink-0 text-gray-400 w-5 text-center">
                  @if (entry.raining) {<span aria-label="raining">🌧️</span>}
                </span>
                <span class="text-gray-900 font-semibold shrink-0 w-16 text-right">
                  {{ entry.kilometers }} km
                </span>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
})
export class LeaderboardComponent {
  private readonly leaderboardService = inject(LeaderboardService);
  private readonly authService = inject(AuthService);

  readonly allEntries = toSignal(this.leaderboardService.allEntries$);
  readonly currentUserId = computed(() => this.authService.user()?.uid ?? null);

  readonly riderStats = computed<RiderStats[]>(() => {
    const entries = this.allEntries() ?? [];
    const map = new Map<string, RiderStats>();

    for (const entry of entries) {
      if (!entry.userId) continue; // skip legacy entries without userId
      if (!map.has(entry.userId)) {
        map.set(entry.userId, {
          userId: entry.userId,
          userName: entry.userName ?? 'Unknown',
          totalKm: 0,
          rideCount: 0,
          rainyRides: 0,
          lastRideDate: entry.date,
        });
      }
      const stats = map.get(entry.userId)!;
      stats.totalKm = Math.round((stats.totalKm + entry.kilometers) * 10) / 10;
      stats.rideCount += 1;
      if (entry.raining) stats.rainyRides += 1;
      if (entry.date > stats.lastRideDate) stats.lastRideDate = entry.date;
    }

    return [...map.values()].sort((a, b) => b.totalKm - a.totalKm);
  });

  readonly recentEntries = computed(() =>
    (this.allEntries() ?? []).filter(e => !!e.userId).slice(0, 10)
  );
}


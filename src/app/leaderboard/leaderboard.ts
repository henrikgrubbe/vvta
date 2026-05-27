import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AuthService } from '../auth.service';
import { LeaderboardService } from './leaderboard.service';

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
  imports: [RouterLink, DatePipe],
  template: `
    <div class="mx-auto max-w-lg p-6">
      <header class="mb-6 flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">🏆 Leaderboard</h1>
          <p class="mt-1 text-sm text-gray-500">Who's been riding the most?</p>
        </div>
        <nav class="ml-4 flex shrink-0 items-center gap-2" aria-label="App navigation">
          <a
            routerLink="/"
            class="rounded text-sm whitespace-nowrap text-blue-600 hover:underline focus:outline-2 focus:outline-offset-2 focus:outline-blue-500"
          >
            ← Mine ture
          </a>
        </nav>
      </header>

      @if (allEntries() === undefined) {
        <p class="py-12 text-center text-gray-400">Loading…</p>
      } @else if (riderStats().length === 0) {
        <p class="py-12 text-center text-gray-500">No rides logged yet. Be the first!</p>
      } @else {
        <!-- Podium / rankings -->
        <section aria-label="Rider rankings">
          <ol class="space-y-3">
            @for (rider of riderStats(); track rider.userId; let rank = $index) {
              <li
                class="flex items-center gap-4 rounded-xl border bg-white px-5 py-4 shadow-sm"
                [class]="
                  rank === 0
                    ? 'border-yellow-300 bg-yellow-50'
                    : rank === 1
                      ? 'border-gray-300 bg-gray-50'
                      : rank === 2
                        ? 'border-orange-200 bg-orange-50'
                        : 'border-gray-200'
                "
              >
                <span
                  class="w-8 shrink-0 text-center text-2xl font-bold"
                  aria-label="Rank {{ rank + 1 }}"
                >
                  {{ rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : rank + 1 + '.' }}
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-semibold text-gray-900">
                    {{ rider.userName }}
                    @if (currentUserId() === rider.userId) {
                      <span class="ml-1 text-xs font-normal text-blue-600">(you)</span>
                    }
                  </p>
                  <p class="mt-0.5 text-xs text-gray-500">
                    Last ride: {{ rider.lastRideDate | date: 'mediumDate' }}
                  </p>
                </div>
                <div class="shrink-0 text-right">
                  <p class="text-lg font-bold text-gray-900">{{ rider.totalKm }} km</p>
                  <p class="text-xs text-gray-500">
                    {{ rider.rideCount }} {{ rider.rideCount === 1 ? 'ride' : 'rides' }}
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
        <section aria-label="Recent rides" class="mt-10">
          <h2 class="mb-3 text-lg font-semibold text-gray-900">Recent rides</h2>
          <ul class="space-y-2">
            @for (entry of recentEntries(); track entry.id) {
              <li
                class="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm"
              >
                <span class="w-28 shrink-0 text-gray-500">{{
                  entry.date | date: 'mediumDate'
                }}</span>
                <span class="flex-1 truncate font-medium text-gray-800">{{
                  entry.userName || 'Unknown'
                }}</span>
                <span class="w-5 shrink-0 text-center text-gray-400">
                  @if (entry.raining) {
                    <span aria-label="raining">🌧️</span>
                  }
                </span>
                <span class="w-16 shrink-0 text-right font-semibold text-gray-900">
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
    (this.allEntries() ?? []).filter((e) => !!e.userId).slice(0, 10),
  );
}

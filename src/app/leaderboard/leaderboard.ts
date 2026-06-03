import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../auth.service';
import { PageLayoutComponent } from '../page-layout';
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
  imports: [DatePipe, TranslateModule, PageLayoutComponent],
  templateUrl: './leaderboard.html',
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
      if (!entry.userId) continue;
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

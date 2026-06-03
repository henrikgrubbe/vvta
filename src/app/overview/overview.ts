import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { BikeLogService } from '../bike-log/bike-log.service';
import { PageLayoutComponent } from '../page-layout';
import { UserProfileService } from '../user-profile.service';

@Component({
  selector: 'app-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslateModule, PageLayoutComponent],
  templateUrl: './overview.html',
})
export class OverviewComponent {
  private readonly bikeLogService = inject(BikeLogService);
  private readonly profileService = inject(UserProfileService);

  readonly entries = toSignal(this.bikeLogService.entries$);
  readonly firstName = computed(() => this.profileService.currentProfile()?.firstName ?? null);

  /** ISO year-month prefix for the current month, e.g. "2026-06". */
  private readonly currentMonthPrefix = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  readonly stats = computed(() => {
    const all = this.entries() ?? [];
    const totalKm = Math.round(all.reduce((sum, e) => sum + e.kilometers, 0) * 10) / 10;
    const totalRides = all.length;
    const rainyRides = all.filter((e) => e.raining).length;

    const thisMonth = all.filter((e) => e.date.startsWith(this.currentMonthPrefix));
    const monthKm = Math.round(thisMonth.reduce((sum, e) => sum + e.kilometers, 0) * 10) / 10;
    const monthRides = thisMonth.length;

    return { totalKm, totalRides, rainyRides, monthKm, monthRides };
  });
}

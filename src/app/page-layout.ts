import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Shared page-level layout wrapper. Provides the standard max-width container,
 * a semantic <header> with h1 title and optional subtitle, and a content slot.
 *
 * Usage:
 *   <app-page-layout [title]="'MY_KEY' | translate" [subtitle]="'SUB_KEY' | translate">
 *     <!-- page content -->
 *   </app-page-layout>
 */
@Component({
  selector: 'app-page-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-lg p-6">
      <header class="mb-6">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">{{ subtitle() }}</p>
        }
      </header>
      <ng-content />
    </div>
  `,
})
export class PageLayoutComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string | null | undefined>();
}

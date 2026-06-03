import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Animated SVG rain icon for use in rain-status indicators.
 * When `animated` is true, rain drops fall continuously.
 * When false, drops animate on group-hover (requires a `.group` ancestor).
 */
@Component({
  selector: 'app-rain-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      class="inline-block h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <!-- cloud body -->
      <path
        class="text-slate-400 dark:text-slate-500"
        d="M6 16a4 4 0 0 1 0-8 5 5 0 0 1 9.9-1A3.5 3.5 0 0 1 19.5 16H6Z"
        fill="currentColor"
      />
      <!-- rain drops: always-animated or group-hover animated -->
      <line
        [class]="
          animated()
            ? 'animate-[rain-drop_1s_ease-in_0.0s_infinite] text-blue-400'
            : 'text-blue-400 opacity-70 group-hover:animate-[rain-drop_1s_ease-in_0.0s_infinite]'
        "
        x1="8"
        y1="18"
        x2="7"
        y2="21"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        [class]="
          animated()
            ? 'animate-[rain-drop_1s_ease-in_0.2s_infinite] text-blue-400'
            : 'text-blue-400 opacity-70 group-hover:animate-[rain-drop_1s_ease-in_0.2s_infinite]'
        "
        x1="12"
        y1="18"
        x2="11"
        y2="21"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <line
        [class]="
          animated()
            ? 'animate-[rain-drop_1s_ease-in_0.4s_infinite] text-blue-400'
            : 'text-blue-400 opacity-70 group-hover:animate-[rain-drop_1s_ease-in_0.4s_infinite]'
        "
        x1="16"
        y1="18"
        x2="15"
        y2="21"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
      />
    </svg>
  `,
})
export class RainIconComponent {
  /** When true, rain drops animate continuously. When false, drops animate on group-hover. */
  readonly animated = input(false);
}

import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ThemeService } from '../theme.service';
import { BOARD_SIZE, DIR_DELTA, Direction, SnakeEngine } from './snake-engine';

export { BOARD_SIZE } from './snake-engine';
export type { Direction, GameState, Position } from './snake-engine';

function headlightGradient(engine: SnakeEngine, cellPx: number): string | null {
  const head = engine.snake()[0];
  const dir = engine.direction();
  const offset = DIR_DELTA[dir];
  const cx = (head.x + 0.5 + offset.x * 0.6) * cellPx;
  const cy = (head.y + 0.5 + offset.y * 0.6) * cellPx;
  return `radial-gradient(ellipse 120px 120px at ${cx}px ${cy}px, rgba(255, 255, 180, 0.25) 0%, rgba(255, 255, 100, 0.10) 40%, transparent 100%)`;
}

@Component({
  selector: 'app-snake',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './snake.html',
  host: {
    class: 'block',
    '(document:keydown)': 'onKeyDown($event)',
  },
})
export class SnakeComponent implements OnDestroy {
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly boardSize = BOARD_SIZE;
  readonly p1 = new SnakeEngine();
  readonly p2 = new SnakeEngine();

  readonly isDark = computed(() => this.themeService.isDark());

  /** Headlight overlay gradient for Player 1 (dark mode only) */
  readonly p1Headlight = computed(() => (this.isDark() ? headlightGradient(this.p1, 16) : null));

  /** Headlight overlay gradient for Player 2 (dark mode only) */
  readonly p2Headlight = computed(() => (this.isDark() ? headlightGradient(this.p2, 16) : null));

  /** True when both engines are idle or game-over (to show combined overlay) */
  readonly bothStopped = computed(() => {
    const s1 = this.p1.gameState();
    const s2 = this.p2.gameState();
    return (s1 === 'idle' || s1 === 'game-over') && (s2 === 'idle' || s2 === 'game-over');
  });

  /** True when at least one game ended (to show scores) */
  readonly anyGameOver = computed(
    () => this.p1.gameState() === 'game-over' || this.p2.gameState() === 'game-over',
  );

  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;

    if (
      [
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'w',
        'a',
        's',
        'd',
        'W',
        'A',
        'S',
        'D',
        ' ',
      ].includes(key)
    ) {
      event.preventDefault();
    }

    if (key === 'Escape') {
      this.exitGame();
      return;
    }

    // Start both games on any key when both are stopped
    if (this.bothStopped()) {
      if (key !== 'Escape') {
        this.startGame();
      }
      return;
    }

    // Space pauses/resumes both
    if (key === ' ') {
      const s1 = this.p1.gameState();
      const s2 = this.p2.gameState();
      if (s1 === 'playing' || s2 === 'playing') {
        if (s1 === 'playing') this.p1.pauseGame();
        if (s2 === 'playing') this.p2.pauseGame();
      } else {
        if (s1 === 'paused') this.p1.resumeGame();
        if (s2 === 'paused') this.p2.resumeGame();
      }
      return;
    }

    // WASD → Player 1
    const wasdMap: Record<string, Direction> = {
      w: 'up',
      W: 'up',
      a: 'left',
      A: 'left',
      s: 'down',
      S: 'down',
      d: 'right',
      D: 'right',
    };
    const p1Dir = wasdMap[key];
    if (p1Dir && this.p1.gameState() === 'playing') {
      this.p1.setDirection(p1Dir);
      return;
    }

    // Arrow keys → Player 2
    const arrowMap: Record<string, Direction> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    };
    const p2Dir = arrowMap[key];
    if (p2Dir && this.p2.gameState() === 'playing') {
      this.p2.setDirection(p2Dir);
    }
  }

  startGame(): void {
    this.p1.startGame();
    this.p2.startGame();
  }

  protected exitGame(): void {
    this.p1.destroy();
    this.p2.destroy();
    this.router.navigateByUrl('/');
  }

  ngOnDestroy(): void {
    this.p1.destroy();
    this.p2.destroy();
  }
}

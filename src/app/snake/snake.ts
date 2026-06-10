import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { ThemeService } from '../theme.service';

export type GameState = 'idle' | 'playing' | 'paused' | 'game-over';
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Position {
  x: number;
  y: number;
}

export const BOARD_SIZE = 20;
const INITIAL_SPEED_MS = 150;
const MIN_SPEED_MS = 80;
const SPEED_DECREMENT_MS = 5;

const OPPOSITE_DIR: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const DIR_DELTA: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const HEAD_ROTATION: Record<Direction, string> = {
  right: '0deg',
  down: '90deg',
  left: '180deg',
  up: '-90deg',
};

@Component({
  selector: 'app-snake',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslateModule],
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
  readonly boardIndices = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => i);

  readonly snake = signal<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  readonly food = signal<Position>({ x: 15, y: 10 });
  readonly direction = signal<Direction>('right');
  readonly gameState = signal<GameState>('idle');
  readonly score = signal(0);
  readonly highScore = signal(0);

  private pendingDir: Direction = 'right';
  private gameInterval: ReturnType<typeof setInterval> | null = null;
  private speedMs = INITIAL_SPEED_MS;

  readonly headRotation = computed(() => HEAD_ROTATION[this.direction()]);
  readonly isDark = computed(() => this.themeService.isDark());

  /** CSS for the headlight radial gradient overlay, positioned ahead of the head */
  readonly headlightStyle = computed(() => {
    if (!this.isDark()) return null;
    const head = this.snake()[0];
    const dir = this.direction();
    const cellPx = 24;
    // Offset the light center slightly ahead of the head
    const offset = DIR_DELTA[dir];
    const cx = (head.x + 0.5 + offset.x * 0.6) * cellPx;
    const cy = (head.y + 0.5 + offset.y * 0.6) * cellPx;
    return `radial-gradient(ellipse 120px 120px at ${cx}px ${cy}px, rgba(255, 255, 180, 0.25) 0%, rgba(255, 255, 100, 0.10) 40%, transparent 100%)`;
  });

  readonly boardFlat = computed((): ('head' | 'body' | 'food' | 'empty')[] => {
    const snake = this.snake();
    const food = this.food();
    const head = snake[0];
    const bodySet = new Set(snake.slice(1).map((p) => `${p.x},${p.y}`));
    return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => {
      const x = i % BOARD_SIZE;
      const y = Math.floor(i / BOARD_SIZE);
      if (x === head.x && y === head.y) return 'head';
      if (bodySet.has(`${x},${y}`)) return 'body';
      if (x === food.x && y === food.y) return 'food';
      return 'empty';
    });
  });

  onKeyDown(event: KeyboardEvent): void {
    const key = event.key;
    const state = this.gameState();

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      event.preventDefault();
    }

    if (key === 'Escape') {
      this.exitGame();
      return;
    }

    if (state === 'idle' || state === 'game-over') {
      if (key !== 'Escape') {
        this.startGame();
      }
      return;
    }

    if (key === ' ') {
      if (state === 'playing') this.pauseGame();
      else if (state === 'paused') this.resumeGame();
      return;
    }

    if (state !== 'playing') return;

    const dirMap: Record<string, Direction> = {
      ArrowUp: 'up',
      w: 'up',
      W: 'up',
      ArrowDown: 'down',
      s: 'down',
      S: 'down',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
    };
    const newDir = dirMap[key];
    if (newDir && newDir !== OPPOSITE_DIR[this.direction()]) {
      this.pendingDir = newDir;
    }
  }

  startGame(): void {
    this.stopInterval();
    this.score.set(0);
    this.speedMs = INITIAL_SPEED_MS;
    const initialSnake: Position[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];
    this.snake.set(initialSnake);
    this.direction.set('right');
    this.pendingDir = 'right';
    this.spawnFood(initialSnake);
    this.gameState.set('playing');
    this.startInterval();
  }

  pauseGame(): void {
    this.stopInterval();
    this.gameState.set('paused');
  }

  resumeGame(): void {
    this.gameState.set('playing');
    this.startInterval();
  }

  protected exitGame(): void {
    this.stopInterval();
    this.router.navigateByUrl('/');
  }

  tick(): void {
    const newDir = this.pendingDir;
    this.direction.set(newDir);

    const snake = this.snake();
    const head = snake[0];
    const delta = DIR_DELTA[newDir];
    const newHead: Position = { x: head.x + delta.x, y: head.y + delta.y };

    if (
      newHead.x < 0 ||
      newHead.x >= BOARD_SIZE ||
      newHead.y < 0 ||
      newHead.y >= BOARD_SIZE ||
      snake.some((s) => s.x === newHead.x && s.y === newHead.y)
    ) {
      this.endGame();
      return;
    }

    const food = this.food();
    const ateFood = newHead.x === food.x && newHead.y === food.y;

    if (ateFood) {
      const newSnake = [newHead, ...snake];
      this.snake.set(newSnake);
      this.score.update((s) => s + 1);
      this.speedMs = Math.max(MIN_SPEED_MS, this.speedMs - SPEED_DECREMENT_MS);
      this.stopInterval();
      this.startInterval();
      this.spawnFood(newSnake);
    } else {
      this.snake.set([newHead, ...snake.slice(0, -1)]);
    }
  }

  private endGame(): void {
    this.stopInterval();
    const s = this.score();
    if (s > this.highScore()) this.highScore.set(s);
    this.gameState.set('game-over');
  }

  private spawnFood(occupied: Position[]): void {
    const occupiedSet = new Set(occupied.map((p) => `${p.x},${p.y}`));
    const empty: Position[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        if (!occupiedSet.has(`${x},${y}`)) empty.push({ x, y });
      }
    }
    if (empty.length === 0) return;
    this.food.set(empty[Math.floor(Math.random() * empty.length)]);
  }

  private startInterval(): void {
    this.gameInterval = setInterval(() => this.tick(), this.speedMs);
  }

  private stopInterval(): void {
    if (this.gameInterval !== null) {
      clearInterval(this.gameInterval);
      this.gameInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.stopInterval();
  }
}

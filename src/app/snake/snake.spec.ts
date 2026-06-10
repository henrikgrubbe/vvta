import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslateTesting } from '../testing/translate-testing';
import { ThemeService } from '../theme.service';
import { BOARD_SIZE, SnakeComponent } from './snake';
import { SnakeEngine } from './snake-engine';

describe('SnakeEngine', () => {
  let engine: SnakeEngine;

  beforeEach(() => {
    engine = new SnakeEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  it('starts in idle state', () => {
    expect(engine.gameState()).toBe('idle');
  });

  it('starts game correctly', () => {
    engine.startGame();
    expect(engine.gameState()).toBe('playing');
    expect(engine.score()).toBe(0);
  });

  it('pauses and resumes', () => {
    engine.startGame();
    engine.pauseGame();
    expect(engine.gameState()).toBe('paused');
    engine.resumeGame();
    expect(engine.gameState()).toBe('playing');
  });

  it('ignores direction reversal (right → left)', () => {
    engine.startGame();
    engine.setDirection('left');
    engine.tick();
    expect(engine.direction()).toBe('right');
  });

  it('accepts valid direction change', () => {
    engine.startGame();
    engine.setDirection('up');
    engine.tick();
    expect(engine.direction()).toBe('up');
  });

  it('increments score when snake eats food', () => {
    engine.startGame();
    const head = engine.snake()[0];
    engine.food.set({ x: head.x + 1, y: head.y });
    engine.tick();
    expect(engine.score()).toBe(1);
  });

  it('triggers game-over on wall collision', () => {
    engine.startGame();
    const snake = engine.snake().map((_, i) => ({ x: BOARD_SIZE - 1 - i, y: 10 }));
    engine.snake.set(snake);
    engine.tick();
    expect(engine.gameState()).toBe('game-over');
  });

  it('triggers game-over on self collision', () => {
    engine.startGame();
    engine.snake.set([
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ]);
    engine.tick();
    expect(engine.gameState()).toBe('game-over');
  });

  it('updates high score when current score exceeds it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    engine.startGame();
    const head = engine.snake()[0];
    engine.food.set({ x: head.x + 1, y: head.y });
    engine.tick();
    engine.snake.set([
      { x: BOARD_SIZE - 1, y: 10 },
      { x: BOARD_SIZE - 2, y: 10 },
    ]);
    engine.tick();
    expect(engine.highScore()).toBe(1);
    vi.restoreAllMocks();
  });

  it('boardFlat returns correct cell types', () => {
    engine.snake.set([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    engine.food.set({ x: 2, y: 0 });
    const flat = engine.boardFlat();
    expect(flat[0]).toBe('head');
    expect(flat[1]).toBe('body');
    expect(flat[2]).toBe('food');
    expect(flat[3]).toBe('empty');
  });

  it('boardFlat has correct length', () => {
    expect(engine.boardFlat().length).toBe(BOARD_SIZE * BOARD_SIZE);
  });
});

describe('SnakeComponent', () => {
  let fixture: ComponentFixture<SnakeComponent>;
  let component: SnakeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SnakeComponent],
      providers: [provideRouter([]), ...provideTranslateTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(SnakeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('has two engines in idle state', () => {
    expect(component.p1.gameState()).toBe('idle');
    expect(component.p2.gameState()).toBe('idle');
  });

  it('starts both games on any key press when both idle', () => {
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(component.p1.gameState()).toBe('playing');
    expect(component.p2.gameState()).toBe('playing');
  });

  it('does not start games on Escape', () => {
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.p1.gameState()).toBe('idle');
    expect(component.p2.gameState()).toBe('idle');
  });

  it('Space pauses both games', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.p1.gameState()).toBe('paused');
    expect(component.p2.gameState()).toBe('paused');
  });

  it('Space resumes both paused games', () => {
    component.startGame();
    component.p1.pauseGame();
    component.p2.pauseGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.p1.gameState()).toBe('playing');
    expect(component.p2.gameState()).toBe('playing');
  });

  it('WASD controls player 1 only', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'w' }));
    component.p1.tick();
    expect(component.p1.direction()).toBe('up');
    // P2 still going right
    expect(component.p2.direction()).toBe('right');
  });

  it('Arrow keys control player 2 only', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    component.p2.tick();
    expect(component.p2.direction()).toBe('up');
    // P1 still going right
    expect(component.p1.direction()).toBe('right');
  });

  it('bothStopped is true when both idle', () => {
    expect(component.bothStopped()).toBe(true);
  });

  it('bothStopped is false when playing', () => {
    component.startGame();
    expect(component.bothStopped()).toBe(false);
  });

  it('p1Headlight returns null when not in dark mode', () => {
    const themeService = TestBed.inject(ThemeService);
    themeService.theme.set('light');
    expect(component.p1Headlight()).toBeNull();
    expect(component.p2Headlight()).toBeNull();
  });

  it('p1Headlight returns a gradient string in dark mode', () => {
    const themeService = TestBed.inject(ThemeService);
    themeService.theme.set('dark');
    expect(component.p1Headlight()).toContain('radial-gradient');
    expect(component.p2Headlight()).toContain('radial-gradient');
  });
});

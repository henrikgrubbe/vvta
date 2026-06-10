import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { provideTranslateTesting } from '../testing/translate-testing';
import { ThemeService } from '../theme.service';
import { BOARD_SIZE, SnakeComponent } from './snake';

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

  it('renders in idle state', () => {
    expect(component.gameState()).toBe('idle');
  });

  it('starts game on any key press when idle', () => {
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(component.gameState()).toBe('playing');
  });

  it('does not start game on Escape from idle', () => {
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.gameState()).toBe('idle');
  });

  it('pauses game on Space', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.gameState()).toBe('paused');
  });

  it('resumes game on Space when paused', () => {
    component.startGame();
    component.pauseGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: ' ' }));
    expect(component.gameState()).toBe('playing');
  });

  it('ignores direction reversal (right → left)', () => {
    component.startGame();
    // direction is right, pressing left should be ignored
    const before = component.direction();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    // pendingDir is private but tick() should not reverse
    component.tick();
    expect(component.direction()).toBe(before); // still right
  });

  it('accepts valid direction change', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    component.tick();
    expect(component.direction()).toBe('up');
  });

  it('WASD keys change direction', () => {
    component.startGame();
    component.onKeyDown(new KeyboardEvent('keydown', { key: 'w' }));
    component.tick();
    expect(component.direction()).toBe('up');
  });

  it('increments score when snake eats food', () => {
    component.startGame();
    const head = component.snake()[0];
    // Place food directly in front of the head (one step right)
    component.food.set({ x: head.x + 1, y: head.y });
    component.tick();
    expect(component.score()).toBe(1);
  });

  it('triggers game-over on wall collision', () => {
    component.startGame();
    // Move snake to the right wall
    const snake = component.snake().map((p, i) => ({ x: BOARD_SIZE - 1 - i, y: 10 }));
    component.snake.set(snake);
    component.tick(); // head at BOARD_SIZE-1, steps right → hits wall
    expect(component.gameState()).toBe('game-over');
  });

  it('triggers game-over on self collision', () => {
    component.startGame();
    // Build a snake that loops into itself
    component.snake.set([
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 3, y: 6 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ]);
    // going right → head at (5,5) moves to (6,5) — hits body
    component.tick();
    expect(component.gameState()).toBe('game-over');
  });

  it('updates high score when current score exceeds it', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    component.startGame();
    const head = component.snake()[0];
    component.food.set({ x: head.x + 1, y: head.y });
    component.tick(); // score = 1
    // force game over
    component.snake.set([
      { x: BOARD_SIZE - 1, y: 10 },
      { x: BOARD_SIZE - 2, y: 10 },
    ]);
    component.tick(); // hits wall → game-over, highScore = 1
    expect(component.highScore()).toBe(1);
    vi.restoreAllMocks();
  });

  it('boardFlat returns correct cell types', () => {
    component.snake.set([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]);
    component.food.set({ x: 2, y: 0 });
    fixture.detectChanges();
    const flat = component.boardFlat();
    expect(flat[0]).toBe('head'); // (0,0)
    expect(flat[1]).toBe('body'); // (1,0)
    expect(flat[2]).toBe('food'); // (2,0)
    expect(flat[3]).toBe('empty'); // (3,0)
  });

  it('boardFlat has correct length', () => {
    expect(component.boardFlat().length).toBe(BOARD_SIZE * BOARD_SIZE);
  });

  it('headlightStyle returns null when not in dark mode', () => {
    const themeService = TestBed.inject(ThemeService);
    themeService.theme.set('light');
    expect(component.headlightStyle()).toBeNull();
  });

  it('headlightStyle returns a gradient string in dark mode', () => {
    const themeService = TestBed.inject(ThemeService);
    themeService.theme.set('dark');
    const style = component.headlightStyle();
    expect(style).toContain('radial-gradient');
  });
});

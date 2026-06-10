import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: 'snake', children: [] }])],
    }).compileComponents();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('navigates to /snake after 20s idle', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigateByUrl');
    vi.advanceTimersByTime(20_000);
    expect(spy).toHaveBeenCalledWith('/snake');
  });

  it('resets idle timer on keydown', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const spy = vi.spyOn(router, 'navigateByUrl');
    vi.advanceTimersByTime(15_000);
    fixture.componentInstance.onGlobalKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
    vi.advanceTimersByTime(15_000);
    // Should NOT have navigated (timer was reset)
    expect(spy).not.toHaveBeenCalled();
    // But after full 20s from last activity...
    vi.advanceTimersByTime(5_000);
    expect(spy).toHaveBeenCalledWith('/snake');
  });
});

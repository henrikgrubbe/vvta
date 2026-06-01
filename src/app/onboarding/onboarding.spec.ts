import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { getAuth } from 'firebase/auth';
import { vi } from 'vitest';

import { provideTranslateTesting } from '../testing/translate-testing';
import { UserProfileService } from '../user-profile.service';
import { OnboardingComponent } from './onboarding';

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('firebase/auth')>();
  return {
    ...actual,
    getAuth: vi.fn(() => ({ currentUser: null })),
    onAuthStateChanged: vi.fn((_auth, callback) => {
      (callback as (u: null) => void)(null);
      return vi.fn();
    }),
  };
});

describe('OnboardingComponent', () => {
  let fixture: ComponentFixture<OnboardingComponent>;
  let component: OnboardingComponent;
  const mockSaveProfile = vi.fn().mockResolvedValue(undefined);

  const setupComponent = async (displayName: string | null = null) => {
    vi.mocked(getAuth).mockReturnValue({
      currentUser: displayName ? { displayName } : null,
    } as ReturnType<typeof getAuth>);

    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [OnboardingComponent],
      providers: [
        provideRouter([]),
        ...provideTranslateTesting(),
        {
          provide: UserProfileService,
          useValue: {
            currentProfile: signal(null),
            saveProfile: mockSaveProfile,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OnboardingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should create', async () => {
    await setupComponent();
    expect(component).toBeTruthy();
  });

  it('should default firstName to empty string when no Google user', async () => {
    await setupComponent(null);
    expect(component.firstName()).toBe('');
  });

  it('should prefill firstName with first word of Google displayName', async () => {
    await setupComponent('Anna Schmidt');
    expect(component.firstName()).toBe('Anna');
  });

  it('should prefill firstName when displayName is single word', async () => {
    await setupComponent('Max');
    expect(component.firstName()).toBe('Max');
  });
});

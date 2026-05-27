import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { WeatherService } from './weather.service';

describe('WeatherService', () => {
  let service: WeatherService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WeatherService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return true when precipitation > 0', () => {
    let result: boolean | null = null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('archive-api.open-meteo.com'));
    req.flush({ daily: { precipitation_sum: [5.2] } });

    expect(result).toBe(true);
  });

  it('should return false when precipitation is 0', () => {
    let result: boolean | null = null;
    service.wasRaining('2025-06-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.flush({ daily: { precipitation_sum: [0] } });

    expect(result).toBe(false);
  });

  it('should return null when response has no precipitation data', () => {
    let result: boolean | null = 'untouched' as unknown as null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.flush({ daily: {} });

    expect(result).toBeNull();
  });

  it('should return null on HTTP error', () => {
    let result: boolean | null = 'untouched' as unknown as null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.error(new ProgressEvent('Network error'));

    expect(result).toBeNull();
  });

  it('should use archive API for past dates', () => {
    service.wasRaining('2020-01-01').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('archive-api.open-meteo.com'));
    expect(req.request.url).toContain('archive');
    req.flush({ daily: { precipitation_sum: [0] } });
  });

  it('should include Aarhus coordinates in request', () => {
    service.wasRaining('2025-01-15').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    expect(req.request.url).toContain('latitude=56.1572');
    expect(req.request.url).toContain('longitude=10.2107');
    req.flush({ daily: { precipitation_sum: [0] } });
  });

  it('should include the requested date in the URL', () => {
    service.wasRaining('2025-03-20').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    expect(req.request.url).toContain('start_date=2025-03-20');
    expect(req.request.url).toContain('end_date=2025-03-20');
    req.flush({ daily: { precipitation_sum: [0] } });
  });

  // --- Edge cases ---

  it('should return true for very small precipitation amounts', () => {
    let result: boolean | null = null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.flush({ daily: { precipitation_sum: [0.01] } });

    expect(result).toBe(true);
  });

  it('should return null when precipitation_sum array is empty', () => {
    let result: boolean | null = 'untouched' as unknown as null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.flush({ daily: { precipitation_sum: [] } });

    expect(result).toBeNull();
  });

  it('should return null when daily is null', () => {
    let result: boolean | null = 'untouched' as unknown as null;
    service.wasRaining('2025-01-15').subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    req.flush({ daily: null });

    expect(result).toBeNull();
  });

  it('should use forecast API for today', () => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    service.wasRaining(todayStr).subscribe();

    const req = httpMock.expectOne(
      (r) => r.url.includes('api.open-meteo.com') && !r.url.includes('archive'),
    );
    req.flush({ daily: { precipitation_sum: [0] } });
  });

  it('should include timezone in the URL', () => {
    service.wasRaining('2025-01-15').subscribe();

    const req = httpMock.expectOne((r) => r.url.includes('open-meteo.com'));
    expect(req.request.url).toContain('timezone=Europe/Copenhagen');
    req.flush({ daily: { precipitation_sum: [0] } });
  });
});

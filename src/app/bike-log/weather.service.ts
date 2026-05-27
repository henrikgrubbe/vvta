import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, of } from 'rxjs';

interface OpenMeteoResponse {
  daily?: {
    precipitation_sum?: number[];
  } | null;
}

@Injectable({ providedIn: 'root' })
export class WeatherService {
  private readonly http = inject(HttpClient);

  private readonly AARHUS_LAT = 56.1572;
  private readonly AARHUS_LON = 10.2107;

  /**
   * Checks if it rained in Aarhus on a given date.
   * Uses Open-Meteo historical or forecast API depending on the date.
   * Returns an Observable<boolean | null> (null if lookup fails).
   */
  wasRaining(date: string) {
    const target = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isHistorical = target < today;

    const baseUrl = isHistorical
      ? 'https://archive-api.open-meteo.com/v1/archive'
      : 'https://api.open-meteo.com/v1/forecast';

    const url = `${baseUrl}?latitude=${this.AARHUS_LAT}&longitude=${this.AARHUS_LON}&start_date=${date}&end_date=${date}&daily=precipitation_sum&timezone=Europe/Copenhagen`;

    return this.http.get<OpenMeteoResponse>(url).pipe(
      map((res) => {
        const precip = res.daily?.precipitation_sum?.[0];
        return precip != null ? precip > 0 : null;
      }),
      catchError(() => of(null)),
    );
  }
}

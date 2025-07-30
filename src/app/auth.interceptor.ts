import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AuthService } from './services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private http: HttpClient, private router: Router,
    private authService: AuthService
  ) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    // Skip interceptor for firebase-login to avoid adding Bearer token
    if (req.url.includes('/api/auth/firebase-login/')) {
      return next.handle(req);
    }

    const accessToken = localStorage.getItem('access_token');
    let modifiedReq = req;
    if (accessToken) {
      modifiedReq = req.clone({
        setHeaders: { Authorization: `Bearer ${accessToken}` },
      });
    } else {
      // If no token, redirect to login
      this.router.navigate(['']);
      return throwError(() => new Error('No access token found'));
    }

    return next.handle(modifiedReq).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          const refreshToken = localStorage.getItem('refresh_token');
          if (refreshToken) {
            return this.http.post(`${environment.apiUrl}/api/token/refresh/`, { refresh: refreshToken }).pipe(
              switchMap((response: any) => {
                localStorage.setItem('access_token', response.access);
                console.log('Token refreshed successfully:', response.access);
                modifiedReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${response.access}` },
                });
                return next.handle(modifiedReq);
              }),
              catchError(() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                this.router.navigate(['/user-page']);
                return throwError(() => new Error('Session expired'));
              })
            );
          } else {
            localStorage.removeItem('access_token');
            this.router.navigate(['/user-page']);
            return throwError(() => new Error('Session expired'));
          }
        }
        return throwError(() => error);
      })
    );
  }
  
}
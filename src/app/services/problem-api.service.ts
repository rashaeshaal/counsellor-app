import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

// Interfaces for Problem and UserProblem models
export interface Problem {
  id: number;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by_id: number;
  image: string | null;
}

export interface UserProblem {
  id: number;
  user_profile: number;
  problem: Problem;
  selected_at: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProblemApiService {
  private apiUrl = 'http://localhost:8000/api/dashboard'; // Replace with your actual backend API URL

  constructor(private http: HttpClient, private authService: AuthService) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    });
  }

  getProblems(): Observable<Problem[]> {
    return this.http.get<Problem[]>(`${this.apiUrl}/problems/`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  selectProblem(problemId: number): Observable<UserProblem> {
    const payload = { problem_id: problemId };
    return this.http.post<UserProblem>(`${this.apiUrl}/user-problems/`, payload, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserSelectedProblems(): Observable<UserProblem[]> {
    return this.http.get<UserProblem[]>(`${this.apiUrl}/user-problems/`, { headers: this.getAuthHeaders() })
      .pipe(
        catchError(this.handleError)
      );
  }

  private handleError(error: any): Observable<never> {
    console.error('API Error:', error);
    let errorMessage = 'An error occurred while communicating with the server.';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      errorMessage = `Server error: ${error.status} - ${error.message || error.error?.detail || 'Unknown error'}`;
    }
    return throwError(() => new Error(errorMessage));
  }
}
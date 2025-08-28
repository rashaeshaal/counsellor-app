import { Component, OnInit } from '@angular/core';
import { ProblemApiService, Problem, UserProblem } from '../services/problem-api.service';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular'; // Import IonicModule for Ionic components
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-problem-selection',
  templateUrl: './problem-selection.component.html',
  styleUrls: ['./problem-selection.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule]
})
export class ProblemSelectionComponent implements OnInit {
  problems: Problem[] = [];
  userProblems: UserProblem[] = [];
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isLoading: boolean = false; // Added for loading state

  constructor(private problemApiService: ProblemApiService,
              private  router: Router
  ) {}

  ngOnInit(): void {
    this.loadProblems();
    this.loadUserProblems();
  }

  loadProblems(): void {
    this.isLoading = true;
    this.problemApiService.getProblems().pipe(
      catchError((error) => {
        this.errorMessage = error.message;
        this.isLoading = false;
        return throwError(() => error);
      })
    ).subscribe((problems) => {
      this.problems = problems || [];
      this.errorMessage = null;
      this.isLoading = false;
    });
  }

  loadUserProblems(): void {
    this.isLoading = true;
    this.problemApiService.getUserSelectedProblems().pipe(
      catchError((error) => {
        this.errorMessage = error.message;
        this.isLoading = false;
        return throwError(() => error);
      })
    ).subscribe((userProblems) => {
      this.userProblems = userProblems || [];
      this.errorMessage = null;
      this.isLoading = false;
    });
  }

  selectProblem(problemId: number): void {
    this.isLoading = true;
    this.problemApiService.selectProblem(problemId).pipe(
      catchError((error) => {
        this.errorMessage = error.message;
        this.isLoading = false;
        return throwError(() => error);
      })
    ).subscribe(() => {
      this.successMessage = 'Problem selected successfully!';
      this.errorMessage = null;
      this.isLoading = false;
      this.loadUserProblems();
      setTimeout(() => {
         this.successMessage = null;
         this.router.navigate(['/user-dashboard']);
       }, 3000);
        
    });
  }

  isSelected(problemId: number): boolean {
    return this.userProblems.some(up => up.problem?.id === problemId);
  }
  goBack() {
  this.router.navigate(['/']);
}

goToDashboard() {
  this.router.navigate(['/user-dashboard']);
}
}
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { MatDatepickerInputEvent } from '@angular/material/datepicker';

@Component({
  selector: 'app-user-registration',
  templateUrl: './user-registration.component.html',
  styleUrls: ['./user-registration.component.scss'],
  standalone: false,
})
export class UserRegistrationComponent {
  name: string = '';
  dob: Date | null = null; // Change to Date type for better compatibility
  gender: string = '';
  minDate: Date = new Date(new Date().setFullYear(new Date().getFullYear() - 100));
  maxDate: Date = new Date();

  constructor(private authService: AuthService, private router: Router) {}

  onDateChange(event: MatDatepickerInputEvent<Date>) {
    this.dob = event.value;
  }

  register() {
    if (!this.dob) {
      console.error('Date of birth is required');
      return;
    }

    const userDetails = {
      name: this.name,
      age: this.calculateAge(this.dob),
      gender: this.gender,
    };
    
    this.authService.updateUserProfile(userDetails).subscribe(() => {
      this.router.navigate(['/problem-selection']);
    });
  }

  calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDifference = today.getMonth() - dob.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }
  goBack() {
    this.router.navigate(['/user-page']);
  }
}

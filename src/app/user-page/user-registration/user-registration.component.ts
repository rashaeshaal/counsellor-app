import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';

@Component({
  selector: 'app-user-registration',
  templateUrl: './user-registration.component.html',
  styleUrls: ['./user-registration.component.scss'],
  standalone: false,
 
})
export class UserRegistrationComponent {
  name: string = '';
  dob: string = '';
  gender: string = '';

  constructor(private authService: AuthService, private router: Router) {}

  register() {
    const userDetails = {
      name: this.name,
      age: this.calculateAge(this.dob),
      gender: this.gender,
    };
    this.authService.updateUserProfile(userDetails).subscribe(() => {
      this.router.navigate(['/problem-selection']);
    });
  }

  calculateAge(dob: string): number {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }
}
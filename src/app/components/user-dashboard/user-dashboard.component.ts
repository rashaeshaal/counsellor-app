import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
  standalone: false,
})
export class UserDashboardComponent  implements OnInit {
 user: any = { name: 'Guest' };
  counsellors: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadUserProfile();
    this.loadCounsellors();
  }

  async loadUserProfile() {
    this.http.get(`${environment.apiUrl}/api/user/profile/`).subscribe({
      next: (response: any) => {
        console.log('UserDashboard profile response:', response);
        this.user = response.user;
      },
      error: (error) => {
        console.error('UserDashboard profile error:', error);
        this.showToast('Failed to load profile.', 'danger');
      },
    });
  }

  async loadCounsellors() {
    this.http.get(`${environment.apiUrl}/api/dashboard/counsellors/`).subscribe({
      next: (response: any) => {
        console.log('UserDashboard counsellors response:', response);
        this.counsellors = response;
        console.log('Counsellors array:', this.counsellors);
      },
      error: (error) => {
        console.error('UserDashboard counsellors error:', error);
        this.showToast('Failed to load counsellors.', 'danger');
      },
    });
  }

  bookCounsellor(counsellor: any) {
    console.log('Booking counsellor:', counsellor);
    if (!counsellor.id) {
      console.error('Counsellor ID missing:', counsellor);
      this.showToast('Invalid counsellor data.', 'danger');
      return;
    }
    this.router.navigate(['/checkout'], { state: { counsellor } });
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
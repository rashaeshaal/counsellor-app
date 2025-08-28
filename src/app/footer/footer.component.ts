import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NavController, ToastController, IonicModule } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class FooterComponent implements OnInit {
  isActive = true;
  activeBookingId: number | null = null;
  counsellorId: string | null = null;
  notificationCount = 0;

  constructor(
    private http: HttpClient,
    private navCtrl: NavController,
    private router: Router,
    private toastCtrl: ToastController
  ) {
    this.checkCounsellorStatus();
  }

  ngOnInit(): void {
    this.fetchActiveBooking();
    
  }

 


  async showNotification(request: any) {
    const toast = await this.toastCtrl.create({
      header: 'New Call Request',
      message: `From: ${request.user.phone_number}`,
      duration: 5000,
      position: 'top',
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.navigateTo('/counsellor-notifications');
          }
        }
      ]
    });
    toast.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  private fetchActiveBooking() {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      this.http
        .get(`${environment.apiUrl}/api/counsellor/active-booking/`, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        })
        .subscribe({
          next: (response: any) => {
            this.activeBookingId = response.booking_id || null;
            console.log('FooterComponent: Active booking ID:', this.activeBookingId);
            if (!this.activeBookingId) {
              this.showToast('No active bookings found', 'warning');
            }
          },
          error: (error) => {
            console.error('FooterComponent: Failed to fetch active booking:', error);
            this.activeBookingId = null;
            this.showToast('Failed to fetch active booking', 'danger');
          }
        });
    } else {
      console.warn('FooterComponent: No access token found');
      this.showToast('Please log in to view active bookings', 'danger');
    }
  }

  checkCounsellorStatus() {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      console.log('FooterComponent: Found access token:', accessToken);
      this.http
        .get(`${environment.apiUrl}/api/counsellor/profile/`, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        })
        .subscribe({
          next: (response: any) => {
            console.log('FooterComponent profile response:', response);
            this.isActive = response.counsellor.is_active;
            this.counsellorId = response.counsellor.id;
          },
          error: (error) => {
            console.error('FooterComponent profile error:', error);
            this.isActive = false;
            this.showToast('Failed to fetch profile status', 'danger');
          }
        });
    } else {
      console.log('FooterComponent: No access token found');
      this.showToast('Please log in to view profile status', 'danger');
    }
  }

  navigateTo(page: string | any[]) {
    console.log('FooterComponent: Navigating to:', page);
    this.navCtrl.navigateForward(page).then(success => {
      console.log('FooterComponent: Navigation to', page, success ? 'Successful' : 'Failed');
      if (!success) {
     
      }
    }).catch(error => {
     
    });
  }

  toggleStatus() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('FooterComponent: No access token found for status toggle');
      this.showToast('Please log in to toggle status', 'danger');
      return;
    }

    this.http
      .post(`${environment.apiUrl}/api/counsellor/status/`, {}, {
        headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
      })
      .subscribe({
        next: (response: any) => {
          this.isActive = response.is_active;
          console.log('FooterComponent: Status toggled to:', this.isActive);
          this.showToast(`Status updated to ${this.isActive ? 'Active' : 'Inactive'}`, 'success');
        },
        error: (error) => {
          console.error('FooterComponent: Status toggle error:', error);
          this.showToast('Failed to toggle status', 'danger');
        }
      });
  }

  navigateToCall() {
    if (!this.activeBookingId) {
      console.warn('FooterComponent: No active booking ID, cannot navigate to call');
      this.showToast('No active booking available', 'warning');
      return;
    }
    console.log('FooterComponent: Navigating to: /counsellor-call', { bookingId: this.activeBookingId });
    this.router.navigate(['/counsellor-call'], { queryParams: { bookingId: this.activeBookingId } }).then(success => {
      if (!success) {
        console.error('FooterComponent: Navigation to /counsellor-call Failed', { bookingId: this.activeBookingId });
     
      }
    });
  }
}
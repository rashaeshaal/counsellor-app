import { Component, OnInit } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/services/auth.service';
import { FooterComponent } from '../../footer/footer.component';
import { IonicModule, ToastController, ToastOptions } from '@ionic/angular';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-counsellor-dashboard',
  templateUrl: './counsellor-dashboard.component.html',
  styleUrls: ['./counsellor-dashboard.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, RouterModule, FooterComponent]
})
export class CounsellorDashboardComponent implements OnInit {
  counsellor: any;
  status: boolean = false;
  upcomingSessions: any[] = [];
  recentActivity: any[] = [];

  constructor(
    public router: Router,
    private authService: AuthService,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.loadCounsellorData();
    this.loadUpcomingSessions();
    this.loadRecentActivity();
    this.authService.setLastDashboard('counsellor');

    this.notificationService.newMessage$.subscribe(message => {
      this.showToast(message, 'primary'); // Pass the whole message object
    });
  }

  loadCounsellorData() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.router.navigate(['/counsellor-login']);
      return;
    }

    this.http.get(`${environment.apiUrl}/api/counsellor/profile/`, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
    }).subscribe({
      next: (response: any) => {
        this.counsellor = response.counsellor;
        this.status = this.counsellor.status; // Assuming status comes from backend
      },
      error: (error) => {
        console.error('Error loading counsellor data:', error);
        this.showToast({ message: 'Failed to load dashboard data.', title: 'Error' }, 'danger');
        if (error.status === 401 || error.status === 403) {
          this.router.navigate(['/counsellor-login']);
        }
      }
    });
  }

  loadUpcomingSessions() {
    const accessToken = localStorage.getItem('access_token');
    this.http.get(`${environment.apiUrl}/api/counsellor/upcoming-sessions`, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
    }).subscribe({
      next: (response: any) => {
        this.upcomingSessions = response;
      },
      error: (error) => {
        console.error('Error loading upcoming sessions:', error);
      }
    });
  }

  loadRecentActivity() {
    const accessToken = localStorage.getItem('access_token');
    this.http.get(`${environment.apiUrl}/api/counsellor/recent-activity`, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
    }).subscribe({
      next: (response: any) => {
        this.recentActivity = response;
      },
      error: (error) => {
        console.error('Error loading recent activity:', error);
      }
    });
  }

  toggleStatus() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.router.navigate(['/counsellor-login']);
      return;
    }

    const newStatus = !this.status;
    this.http.post(`${environment.apiUrl}/api/counsellor/update-status`, { status: newStatus }, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
    }).subscribe({
      next: (response: any) => {
        this.status = newStatus;
        this.showToast({ message: 'Status updated successfully!', title: 'Success' }, 'success');
        console.log('Counsellor status toggled to:', this.status);
      },
      error: (error) => {
        console.error('Error updating status:', error);
        this.showToast({ message: 'Failed to update status.', title: 'Error' }, 'danger');
      }
    });
  }

  private async showToast(notification: { message: string; title?: string; type?: string; bookingId?: number }, color: 'success' | 'danger' | 'warning' | 'primary' = 'danger') {
    const toastOptions: ToastOptions = {
      header: notification.title,
      message: notification.message,
      duration: 3000,
      color: color,
      position: 'top'
    };

    if (notification.type === 'incoming_call' && notification.bookingId) {
      toastOptions.buttons = [
        {
          text: 'Answer',
          handler: () => {
            this.router.navigate(['/counsellor-call'], { queryParams: { bookingId: notification.bookingId } });
          }
        }
      ];
      toastOptions.duration = 0; // Make it persistent until action is taken
    }

    const toast = await this.toastCtrl.create(toastOptions);
    toast.present();
  }

  logout() {
    this.authService.logout(); // Use the AuthService logout method
    this.router.navigate(['/counsellor-login']); // Redirect to login page
  }
}

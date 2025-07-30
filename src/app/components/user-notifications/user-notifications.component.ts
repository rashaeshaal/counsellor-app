import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user-notifications',
  templateUrl: './user-notifications.component.html',
  styleUrls: ['./user-notifications.component.scss'],
  standalone: false,
})
export class UserNotificationsComponent  implements OnInit {

  notifications: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadNotifications();
  }

  loadNotifications() {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      console.log('UserNotifications: Found access token:', accessToken);
      this.http
        .get(`${environment.apiUrl}/api/user/notifications/`, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        })
        .subscribe({
          next: (response: any) => {
            console.log('UserNotifications response:', response);
            this.notifications = response;
          },
          error: (error) => {
            console.error('UserNotifications error:', error);
          }
        });
    } else {
      console.error('UserNotifications: No access token found');
    }
  }
}
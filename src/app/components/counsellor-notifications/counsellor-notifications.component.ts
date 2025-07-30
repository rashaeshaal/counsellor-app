import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-notifications',
  templateUrl: './counsellor-notifications.component.html',
  styleUrls: ['./counsellor-notifications.component.scss'],
  standalone: false,
})
export class CounsellorNotificationsComponent  implements OnInit {

  callRequests: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      this.http
        .get(`${environment.apiUrl}/api/counsellor/notifications/`, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        })
        .subscribe({
          next: (response: any) => {
            this.callRequests = response.call_requests;
          },
          error: (error) => {
            console.error('Error fetching notifications:', error);
          }
        });
    }
  }
}
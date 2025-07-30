import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
  standalone: false,
})
export class UserProfileComponent  implements OnInit {

  user: any;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  loadUserProfile() {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      console.log('UserProfile: Found access token:', accessToken);
      this.http
        .get(`${environment.apiUrl}/api/user/profile/`, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        })
        .subscribe({
          next: (response: any) => {
            console.log('UserProfile response:', response);
            this.user = response.user;
          },
          error: (error) => {
            console.error('UserProfile error:', error);
          }
        });
    } else {
      console.error('UserProfile: No access token found');
    }
  }
}
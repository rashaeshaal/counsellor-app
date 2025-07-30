import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-dashboard',
  templateUrl: './counsellor-dashboard.component.html',
  styleUrls: ['./counsellor-dashboard.component.scss'],
  standalone: false,

})
export class CounsellorDashboardComponent  implements OnInit {

  user: any;
  counsellor: any;

  constructor(private http: HttpClient, private router: Router) {}

 ngOnInit() {
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    console.log('Dashboard: Found access token:', accessToken);
    this.http.get(`${environment.apiUrl}/api/counsellor/profile/`, {
      headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
    }).subscribe({
      next: (response: any) => {
        console.log('Dashboard profile response:', response);
        this.user = response.user;
        this.counsellor = response.counsellor;
      },
      error: (error) => {
        console.error('Dashboard profile error:', error);
        if (error.status === 401) {
          this.router.navigate(['/counsellor-login']);
        }
      }
    });
  } else {
    console.error('Dashboard: No access token found');
    this.router.navigate(['/counsellor-login']);
  }
}
  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    this.router.navigate(['/counsellor-login']);
  }
}
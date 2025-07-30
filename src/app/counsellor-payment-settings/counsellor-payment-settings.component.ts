
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-payment-settings',
  templateUrl: './counsellor-payment-settings.component.html',
  styleUrls: ['./counsellor-payment-settings.component.scss'],
  standalone: false,
})
export class CounsellorPaymentSettingsComponent  implements OnInit {

 paymentSettings: any = { session_fee: 50.00, session_duration: 20 };

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadPaymentSettings();
  }

  async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.error('No refresh token found');
      return null;
    }
    try {
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/token/refresh/`, { refresh: refreshToken })
        .toPromise();
      const newAccessToken = response.access;
      localStorage.setItem('access_token', newAccessToken);
      console.log('Token refreshed:', newAccessToken);
      return newAccessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  async loadPaymentSettings() {
  let accessToken = localStorage.getItem('access_token');
  if (!accessToken) {
    console.error('No access token found');
    alert('Please log in to view payment settings.');
    return;
  }
  try {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-CSRFToken': this.getCsrfToken()
    });
    const response: any = await this.http
      .get(`${environment.apiUrl}/api/counsellor/payment-settings/`, { headers })
      .toPromise();
    console.log('Payment settings response:', response);
    this.paymentSettings = response;
  } catch (error: any) {
    // Token refresh logic
  }
}

  async savePaymentSettings() {
    let accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      alert('Please log in to save payment settings.');
      return;
    }

    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-CSRFToken': this.getCsrfToken()
      });
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/counsellor/payment-settings/`, this.paymentSettings, { headers })
        .toPromise();
      console.log('Payment settings saved:', response);
      alert('Payment settings updated successfully.');
    } catch (error: any) {
      if (error.status === 401) {
        accessToken = await this.refreshToken();
        if (accessToken) {
          const headers = new HttpHeaders({
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-CSRFToken': this.getCsrfToken()
          });
          try {
            const response: any = await this.http
              .post(`${environment.apiUrl}/api/counsellor/payment-settings/`, this.paymentSettings, { headers })
              .toPromise();
            console.log('Payment settings saved:', response);
            alert('Payment settings updated successfully.');
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            alert('Session expired. Please log in again.');
          }
        } else {
          alert('Session expired. Please log in again.');
        }
      } else {
        console.error('Save payment settings error:', error);
        alert('Failed to update payment settings.');
      }
    }
  }

  private getCsrfToken(): string {
    const name = 'csrftoken';
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(name))
      ?.split('=')[1];
    return cookieValue || '';
  }
}
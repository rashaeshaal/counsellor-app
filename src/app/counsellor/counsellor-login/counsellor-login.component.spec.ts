import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { Auth } from '@angular/fire/auth';

@Component({
  selector: 'app-counsellor-login',
  templateUrl: './counsellor-login.component.html',
  styleUrls: ['./counsellor-login.component.scss'],
})
export class CounsellorLoginComponent implements OnInit {
  loginForm: FormGroup;
  googlePhotoUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private router: Router,
    private auth: Auth
  ) {
    this.loginForm = this.fb.group({
      phoneNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
    });
  }

  ngOnInit(): void {
    this.auth.onAuthStateChanged(user => {
      this.googlePhotoUrl = user?.photoURL || null;
      console.log('Google photo URL:', this.googlePhotoUrl);
    });
  }

  async login() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showToast('Please enter a valid 10-digit phone number', 'danger');
      return;
    }

    const phoneNumber = `+91${this.loginForm.value.phoneNumber}`;
    try {
      const loader = await this.showLoader('Logging in...');
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/auth/counsellorlogin/`, { phone_number: phoneNumber })
        .toPromise();
      console.log('Login response:', response);

      if (response && response.access && response.refresh) {
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);
        console.log('Stored tokens:', { access: response.access, refresh: response.refresh });
        this.googlePhotoUrl = this.auth.currentUser?.photoURL || this.googlePhotoUrl;
        this.router.navigate(['/counsellor-dashboard']).then(success => {
          if (!success) {
            console.error('Navigation failed');
            this.showToast('Failed to navigate to dashboard', 'danger');
          }
        });
      } else {
        console.error('Invalid response:', response);
        this.showToast('Invalid response from server', 'danger');
      }
    } catch (error: any) {
      console.error('Login error:', error.response?.data || error.message);
      this.showToast(error.response?.data?.error || 'Login failed', 'danger');
    } finally {
      await this.loadingCtrl.dismiss();
    }
  }

  async showLoader(message: string) {
    const loader = await this.loadingCtrl.create({ message, spinner: 'bubbles' });
    await loader.present();
    return loader;
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  navigateToRegister() {
    this.router.navigate(['/counsellor-register']);
  }
}
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
  standalone: false
})
export class CounsellorLoginComponent  implements OnInit {

  phoneNumber: string = '';
  password: string = '';
  googlePhotoUrl: string | null = null;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private router: Router,
    private auth: Auth
  ) {}
  ngOnInit(): void {
    try {
      this.googlePhotoUrl = this.auth.currentUser?.photoURL || null;
    } catch {
      this.googlePhotoUrl = null;
    }
  }

async login() {
  if (!this.phoneNumber) {
    this.showToast('Please enter a phone number', 'danger');
    return;
  }
  const phoneNumber = this.phoneNumber.startsWith('+91') ? this.phoneNumber : `+91${this.phoneNumber}`;
  try {
    const response: any = await this.http
      .post(`${environment.apiUrl}/api/auth/counsellorlogin/`, { 
        phone_number: phoneNumber,
        password: this.password
       })
      .toPromise();
    console.log('Login response:', response);
    if (response && response.access && response.refresh) {
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      try {
        this.googlePhotoUrl = this.auth.currentUser?.photoURL || this.googlePhotoUrl;
      } catch {}
      this.router.navigate(['/counsellor-dashboard']);
    } else {
      this.showToast('Invalid response from server', 'danger');
    }
  } catch (error: any) {
    console.error('Login error:', error);
    const errorMsg = error.error?.error || 'Login failed. Please try again.';
    this.showToast(errorMsg, 'danger');
  }
}

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
  public navigateToRegister() {
    this.router.navigate(['/counsellor-register']);
  }
}
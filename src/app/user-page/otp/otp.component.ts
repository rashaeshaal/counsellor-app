import { Component, OnInit, Input } from '@angular/core';
import { LoadingController, ModalController, ToastController } from '@ionic/angular';

import { HttpClient } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
  standalone: false
  
})
export class OtpComponent  implements OnInit {
@Input() phone!: string;
  @Input() testOtp?: string;
  isLoading = false;
  otp: string = '';
  config = {
    length: 6,
    allowNumbersOnly: true,
    inputClass: 'otp-input-style',
  };
  isTestMode: boolean = !environment.production;

  constructor(
    public modalCtrl: ModalController,
    public loadingCtrl: LoadingController,
    public toastCtrl: ToastController,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    if (this.isTestMode && this.testOtp) {
      console.log('Test OTP expected:', this.testOtp);
    }
  }

  async showLoader(msg: string) {
    this.isLoading = true;
    const loader = await this.loadingCtrl.create({
      message: msg,
      spinner: 'bubbles',
    });
    await loader.present();
    return loader;
  }

  async hideLoader() {
    this.isLoading = false;
    await this.loadingCtrl.dismiss();
  }

  onOtpChange(event: string) {
    this.otp = event;
  }

  async resend() {
    try {
      await this.showLoader('Resending OTP...');
      await this.auth.signInWithPhoneNumber('+91' + this.phone);
      await this.hideLoader();
      this.showToast('OTP resent successfully');
    } catch (e: any) {
      await this.hideLoader();
      this.showToast(e.message || 'Failed to resend OTP', 'danger');
    }
  }

  async verifyOtp() {
    try {
      await this.showLoader('Verifying OTP...');
      let idToken: string;

      if (this.isTestMode && this.testOtp && this.otp === this.testOtp) {
        console.log('Test OTP verified:', this.otp);
        const result = await this.auth.verifyOtp(this.otp);
        idToken = result.idToken;
      } else {
        const result = await this.auth.verifyOtp(this.otp);
        idToken = result.idToken;
      }

      // Exchange Firebase ID token for Django JWT token
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/auth/firebase-login/`, { id_token: idToken })
        .toPromise();

      // Store JWT tokens (fix key names to match backend response)
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      console.log('JWT tokens stored:', { access: response.access, refresh: response.refresh });

      await this.hideLoader();
      this.showToast('Login successful');
      this.auth.clearVerificationId();
      await this.modalCtrl.dismiss({ success: true });
      this.router.navigate(['/user-dashboard']);
    } catch (e: any) {
      await this.hideLoader();
      this.showToast(e.message || 'Invalid OTP or server error', 'danger');
      console.error('OTP verification error:', e);
    }
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
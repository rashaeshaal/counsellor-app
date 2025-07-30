import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-login',
  templateUrl: './counsellor-login.component.html',
  styleUrls: ['./counsellor-login.component.scss'],
  standalone: false
})
export class CounsellorLoginComponent  implements OnInit {

  phoneNumber: string = '';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private router: Router
  ) {}
  ngOnInit(): void {
    
  }

  async login() {
    try {
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/auth/counsellorlogin/`, { phone_number: this.phoneNumber })
        .toPromise();
        console.log('Login response:', response);
      if (response && response.access && response.refresh) {
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);
      } else {
        console.error('Invalid response:', response);
        this.showToast('Invalid response', 'danger');
      }
      this.router.navigate(['/counsellor-dashboard']);
    } catch (error) {
      this.showToast('Login failed', 'danger');
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
import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ModalController, ModalOptions, ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { OtpComponent } from './otp/otp.component';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-page',
  templateUrl: './user-page.page.html',
  styleUrls: ['./user-page.page.scss'],
  standalone: false,
})
export class UserPagePage implements OnInit {
  form: FormGroup = new FormGroup({
    phone: new FormControl(null, {
      validators: [
        Validators.required,
        Validators.pattern('^[0-9]{10}$'),
      ],
    }),
  });

  isLoading: boolean = false;
  isTestMode: boolean = !environment.production;
  
  // Test phone numbers for development
  testPhoneNumbers: { [key: string]: string } = {
    '+917510780558': '789654',
    '+918547905362': '123456',
    '+917744778540': '123456',
    '+919988774455': '123456',
    '+918855221144': '123456',
    '+917878789696': '123456',
    '+919744002048': '123456',
    '+918129602048': '123456',
    '+913210456987': '123456',
  };

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private auth: AuthService,
    public router: Router
  ) {}

  ngOnInit() {
    // Remove all AngularFire and RecaptchaVerifier setup
    console.log('User page initialized');
  }

  async signIn() {
    try {
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }

      this.isLoading = true;
      const phoneNumber = '+91' + this.form.value.phone;

      console.log('Attempting sign-in with:', phoneNumber);

      // In test mode, validate test numbers
      if (this.isTestMode && !this.testPhoneNumbers[phoneNumber]) {
        this.showToast('Please use a valid test phone number', 'danger');
        this.isLoading = false;
        return;
      }

      // Send OTP using the simplified AuthService
      await this.auth.signInWithPhoneNumber(phoneNumber);

      // Present OTP modal
      const options: ModalOptions = {
        component: OtpComponent,
        componentProps: {
          phone: this.form.value.phone,
          testOtp: this.testPhoneNumbers[phoneNumber],
        },
      };
      
      const modal = await this.modalCtrl.create(options);
      await modal.present();
      const { data } = await modal.onWillDismiss();
      
      if (data?.success) {
        this.form.reset();
        console.log('Login successful, checking user type...');
        
        if (data.is_new_user) {
          this.router.navigate(['/user-registration']);
        } else {
          this.router.navigate(['/user-dashboard']);
        }
      }
      
    } catch (e: any) {
      console.error('Sign-in error:', e);
      this.showToast(`Failed to send OTP: ${e.message}`, 'danger');
    } finally {
      this.isLoading = false;
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
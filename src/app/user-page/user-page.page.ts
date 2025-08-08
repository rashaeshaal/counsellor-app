import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ModalController, ModalOptions, ToastController, IonicModule } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { OtpComponent } from './otp/otp.component';
import { Auth, RecaptchaVerifier } from '@angular/fire/auth';
import { environment } from 'src/environments/environment';
import { getFirestore, doc, getDoc, setDoc, increment } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

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
        Validators.pattern('^[0-9]{10}$'), // Enforce exactly 10 digits
      ],
    }),
  });

  isLoading: boolean = false; // Add isLoading property
  isTestMode: boolean = !environment.production;
  testPhoneNumbers: { [key: string]: string } = {
    '+917510780558': '789654',
    '+918547905362': '123456',
  };

  private recaptchaVerifier!: RecaptchaVerifier;

  constructor(
    private modalCtrl: ModalController,
    private toastCtrl: ToastController,
    private auth: AuthService,
    private angularFireAuth: Auth,
    private router: Router
  ) {}

  ngOnInit() {
    this.recaptchaVerifier = new RecaptchaVerifier(
      this.angularFireAuth,
      'recaptcha-container',
      {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA verified');
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          this.showToast('reCAPTCHA expired. Please try again.', 'danger');
        },
      }
    );
    (window as any).recaptchaVerifier = this.recaptchaVerifier;
  }

  async signIn() {
    try {
      if (!this.form.valid) {
        this.form.markAllAsTouched();
        return;
      }

      this.isLoading = true; // Set loading state
      const phoneNumber = '+91' + this.form.value.phone;

      // Check SMS limit in production mode or use test number
      if (!this.isTestMode) {
        const db = getFirestore(getApp());
        const usageRef = doc(db, 'sms_usage', phoneNumber);
        const usageDoc = await getDoc(usageRef);
        if (usageDoc.exists() && usageDoc.data()?.['count'] >= 10) {
          this.showToast('Daily SMS limit reached.', 'danger');
          this.isLoading = false;
          return;
        }
        await this.auth.signInWithPhoneNumber(phoneNumber);
        await setDoc(
          usageRef,
          {
            count: increment(1),
            last_updated: new Date(),
          },
          { merge: true }
        );
      } else if (this.testPhoneNumbers[phoneNumber]) {
        console.log('Using test phone number:', phoneNumber);
        await this.auth.signInWithPhoneNumber(phoneNumber);
      } else {
        this.showToast('Invalid test phone number.', 'danger');
        this.isLoading = false;
        return;
      }

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
        console.log('Login successful, navigating to user-dashboard');
        this.router.navigate(['/problem-selection']);
      }
    } catch (e: any) {
      console.error('Sign-in error:', e);
      this.showToast(`Failed to send OTP: ${e.message || 'Unknown error'}`, 'danger');
      if (e.code === 'auth/operation-not-allowed') {
        this.showToast('Phone authentication not enabled or billing issue. Use test numbers.', 'danger');
      }
    } finally {
      this.isLoading = false; // Reset loading state
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
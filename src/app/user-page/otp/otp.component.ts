import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { LoadingController, ModalController, ToastController } from '@ionic/angular';
import { HttpClient } from '@angular/common/http';
import { AuthService } from 'src/app/services/auth.service';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-otp',
  templateUrl: './otp.component.html',
  styleUrls: ['./otp.component.scss'],
  standalone: false
})
export class OtpComponent implements OnInit, OnDestroy {
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

  // Array to store OTP digits
  otpDigits: string[] = ['', '', '', '', '', ''];

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

  ngOnDestroy() {
    // Clean up verification ID and listeners when component is destroyed
    this.auth.clearVerificationId();
  }

  // Handle input in OTP fields
  onInput(currentInput: HTMLInputElement, nextInput: HTMLInputElement | null) {
    const value = currentInput.value;
    
    // Only allow numbers
    if (!/^\d*$/.test(value)) {
      currentInput.value = '';
      return;
    }
  
    // Get all OTP inputs and update the digits array
    const inputs = document.querySelectorAll('input[maxlength="1"]') as NodeListOf<HTMLInputElement>;
    this.otpDigits = Array.from(inputs).map(input => input.value);
    this.updateOtpString();
  
    // Move to next input if value is entered and next input exists
    if (value && nextInput) {
      nextInput.focus();
    }
    
    console.log('OTP Digits:', this.otpDigits, 'Complete OTP:', this.otp, 'Is Complete:', this.isOtpComplete());
  }
  // Handle backspace in OTP fields
  onBackspace(currentInput: HTMLInputElement, prevInput: HTMLInputElement | null) {
    // If current input is empty and backspace is pressed, move to previous input
    if (!currentInput.value && prevInput) {
      prevInput.focus();
      // Clear the previous input as well
      prevInput.value = '';
    }
    
    // Update digits array from all inputs
    const inputs = document.querySelectorAll('input[maxlength="1"]') as NodeListOf<HTMLInputElement>;
    this.otpDigits = Array.from(inputs).map(input => input.value);
    this.updateOtpString();
    
    console.log('After backspace - OTP Digits:', this.otpDigits, 'Complete OTP:', this.otp);
  }

  // Get the index of the input field
  private getInputIndex(input: HTMLInputElement): number {
    const inputs = document.querySelectorAll('.otp-input');
    return Array.from(inputs).indexOf(input);
  }

  // Update the OTP string from digits array
  private updateOtpString() {
    this.otp = this.otpDigits.join('');
  }

  // Check if OTP is complete (all 6 digits entered)
  isOtpComplete(): boolean {
    const isComplete = this.otp.length === 6 && /^\d{6}$/.test(this.otp);
    console.log('Checking if OTP complete:', this.otp, 'Length:', this.otp.length, 'IsComplete:', isComplete);
    return isComplete;
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
    
    // Clear existing verification data
    this.auth.clearVerificationId();
    
    // Resend OTP
    await this.auth.signInWithPhoneNumber('+91' + this.phone);
    
    await this.hideLoader();
    this.showToast('OTP resent successfully');
    
    // Clear current OTP input - improved
    this.otp = '';
    this.otpDigits = ['', '', '', '', '', ''];
    
    // Clear the actual input elements
    const inputs = document.querySelectorAll('input[maxlength="1"]') as NodeListOf<HTMLInputElement>;
    inputs.forEach(input => {
      input.value = '';
    });
    
    // Focus on first input
    if (inputs.length > 0) {
      inputs[0].focus();
    }
    
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
        // For test mode, we still need to go through Firebase verification
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

      // Store JWT tokens
      localStorage.setItem('access_token', response.access);
      localStorage.setItem('refresh_token', response.refresh);
      console.log('JWT tokens stored:', { access: response.access, refresh: response.refresh });

      await this.hideLoader();
      this.showToast('Login successful');
      this.auth.clearVerificationId();
      
      // Pass is_new_user in modal dismiss
      await this.modalCtrl.dismiss({ success: true, is_new_user: response.is_new_user });
      
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
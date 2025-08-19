import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { getAuth, signInWithPhoneNumber as angularFireSignInWithPhoneNumber, Auth, ConfirmationResult } from '@angular/fire/auth';
import { RecaptchaVerifier } from '@angular/fire/auth';
import { getApp } from 'firebase/app';
import { Capacitor } from '@capacitor/core';

declare global {
  interface Window {
    cordova: any;
    Capacitor: any;
    recaptchaVerifier: RecaptchaVerifier;
  }
}
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private verificationId: string | null = null; // Stores the verification ID received from Firebase
  private confirmationResult: ConfirmationResult | null = null; 
  private bpiUrl = 'http://localhost:8000'; 

  constructor(private auth: Auth, private http: HttpClient) {
    // Ensure Firebase app is initialized before attempting any auth operations
    try {
      getApp(); // This will throw an error if no Firebase app has been initialized
      console.log('Firebase app is initialized');
    } catch (e) {
      console.error('Firebase app not initialized:', e);
      // Re-throw to prevent the service from being used in an uninitialized state
      throw new Error('Firebase app not initialized. Check AppModule configuration.');
    }
  }
  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Initiates the phone number sign-in process.
   * It handles both native (Capacitor) and web environments.
   * @param phoneNumber The phone number to sign in with (e.g., '+911234567890').
   */
  async signInWithPhoneNumber(phoneNumber: string): Promise<void> {
    try {
      // Use Capacitor.isNativePlatform() for accurate platform detection
      const isNative = Capacitor.isNativePlatform();
      console.log('Platform:', isNative ? 'Native' : 'Web');
      console.log('Phone number:', phoneNumber);

      if (isNative) {
        // Use the Capacitor Firebase Authentication plugin for native platforms
        // This plugin abstracts away the reCAPTCHA for native environments.
        const result = await FirebaseAuthentication.signInWithPhoneNumber({ phoneNumber });
        // The result from Capacitor plugin might need a type assertion to access verificationId
        this.verificationId = (result as any).verificationId;
        console.log('Native verification ID:', this.verificationId);
      } else {
        // For web environments, use the standard AngularFire `signInWithPhoneNumber`
        // This requires a reCAPTCHA verifier to prevent abuse.
        if (!(window.recaptchaVerifier)) {
          // If reCAPTCHA verifier is not initialized (e.g., component not loaded yet), throw an error
          throw new Error('reCAPTCHA verifier not initialized');
        }
        // Perform sign-in using AngularFire's method with the global reCAPTCHA verifier
        this.confirmationResult = await angularFireSignInWithPhoneNumber(this.auth, phoneNumber, window.recaptchaVerifier);
        this.verificationId = this.confirmationResult.verificationId;
        console.log('Web verification ID:', this.verificationId);
      }
    } catch (e: any) {
      console.error('signInWithPhoneNumber error:', e);
      // Throw a more user-friendly error message
      throw new Error(e.message || 'Failed to send OTP');
    }
  }

  /**
   * Verifies the OTP entered by the user.
   * @param otp The One-Time Password entered by the user.
   * @returns A Promise that resolves with an object containing the Firebase ID token.
   */
  async verifyOtp(otp: string): Promise<{ idToken: string }> {
    try {
      if (!this.verificationId) {
        throw new Error('No verification ID available. Please request OTP first.');
      }

      const isNative = Capacitor.isNativePlatform();
      let idToken: string;

      if (isNative) {
        // For native, confirm the verification code using the Capacitor plugin
        await FirebaseAuthentication.confirmVerificationCode({
          verificationId: this.verificationId,
          verificationCode: otp
        });
        // Get the ID token after successful confirmation
        const tokenResult = await FirebaseAuthentication.getIdToken();
        idToken = tokenResult.token;
      } else {
        // For web, confirm using the ConfirmationResult object
        if (!this.confirmationResult) {
          throw new Error('No confirmation result available.');
        }
        const credential = await this.confirmationResult.confirm(otp);
        // Get the ID token from the authenticated user credential
        idToken = await credential.user.getIdToken();
      }

      return { idToken };
    } catch (e: any) {
      console.error('verifyOtp error:', e);
      // Throw a more user-friendly error message for invalid OTP
      throw new Error(e.message || 'Invalid OTP');
    }
  }

  /**
   * Clears the stored verification ID and confirmation result.
   * This should be called after successful verification or if the process needs to be restarted.
   */
  clearVerificationId(): void {
    this.verificationId = null;
    this.confirmationResult = null;
  }

  updateUserProfile(userDetails: any): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.bpiUrl}/api/auth/register-user/`, userDetails, { headers });
  }
}
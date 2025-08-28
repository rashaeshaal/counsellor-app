import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private verificationId: string | null = null;
  private bpiUrl = 'https://counsellor-backend-13.onrender.com';
  private phoneVerificationPromise: Promise<string> | null = null;

  constructor(private http: HttpClient) {}

/*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Returns the stored access token from local storage.
   * @returns {string | null} The access token if stored, otherwise null.
   */
/*******  f9510e40-53ec-4730-b67a-e28efe617edd  *******/  getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Initiates phone number sign-in using Capacitor Firebase Authentication plugin
   * Uses event listeners for phone verification flow
   */
  async signInWithPhoneNumber(phoneNumber: string): Promise<void> {
    try {
      console.log('[DEBUG] signInWithPhoneNumber called with:', phoneNumber);
      
      // Create a promise that resolves when verification ID is received
      this.phoneVerificationPromise = new Promise((resolve, reject) => {
        // Set up listeners before starting the sign-in process
        const setupListeners = async () => {
          // Listen for phone code sent (gives us the verification ID)
          await FirebaseAuthentication.addListener('phoneCodeSent', (event) => {
            console.log('[DEBUG] Phone code sent, verification ID:', event.verificationId);
            this.verificationId = event.verificationId;
            resolve(event.verificationId);
          });

          // Listen for phone verification failure
          await FirebaseAuthentication.addListener('phoneVerificationFailed', (event) => {
            console.error('[DEBUG] Phone verification failed:', event.message);
            reject(new Error(event.message || 'Phone verification failed'));
          });

          // Listen for phone verification completed (auto-verification)
          await FirebaseAuthentication.addListener('phoneVerificationCompleted', (event) => {
            console.log('[DEBUG] Phone verification completed automatically');
            // This means verification was completed automatically (instant verification)
            resolve('auto-verified');
          });
        };

        // Setup listeners first, then start sign-in
        setupListeners().then(() => {
          // Start the phone number sign-in process
          FirebaseAuthentication.signInWithPhoneNumber({
            phoneNumber: phoneNumber
          }).catch((error) => {
            console.error('[DEBUG] signInWithPhoneNumber error:', error);
            reject(this.handleFirebaseError(error));
          });
        }).catch(reject);
      });

      // Wait for the verification process to start
      await this.phoneVerificationPromise;
      
    } catch (e: any) {
      console.error('[DEBUG] signInWithPhoneNumber error:', e);
      throw this.handleFirebaseError(e);
    }
  }

  /**
   * Verifies the OTP using Capacitor Firebase Authentication plugin
   */
  async verifyOtp(otp: string): Promise<{ idToken: string }> {
    try {
      if (!this.verificationId) {
        throw new Error('No verification ID available. Please request OTP first.');
      }

      console.log('[DEBUG] Verifying OTP:', otp, 'with verification ID:', this.verificationId);

      // Use Capacitor plugin for verification
      const result = await FirebaseAuthentication.confirmVerificationCode({
        verificationId: this.verificationId,
        verificationCode: otp
      });

      console.log('[DEBUG] Verification successful:', result);

      // Get the ID token
      const tokenResult = await FirebaseAuthentication.getIdToken();
      return { idToken: tokenResult.token };

    } catch (e: any) {
      console.error('[DEBUG] verifyOtp error:', e);
      throw this.handleFirebaseError(e);
    }
  }

  /**
   * Handle Firebase-specific errors with user-friendly messages
   */
  private handleFirebaseError(error: any): Error {
    if (error.code) {
      switch (error.code) {
        case 'auth/operation-not-allowed':
          return new Error('Phone authentication not enabled in Firebase Console');
        case 'auth/quota-exceeded':
          return new Error('SMS quota exceeded. Try again later or use test numbers.');
        case 'auth/invalid-phone-number':
          return new Error('Invalid phone number format. Use international format (+91xxxxxxxxxx)');
        case 'auth/invalid-verification-code':
          return new Error('Invalid OTP. Please check and try again.');
        case 'auth/code-expired':
          return new Error('OTP has expired. Please request a new one.');
        case 'auth/too-many-requests':
          return new Error('Too many requests. Please try again later.');
        default:
          if (error.message?.includes('insufficient') || error.message?.includes('permission')) {
            return new Error('Firebase configuration error. Check package name and SHA-256 fingerprint in Firebase Console.');
          }
          return new Error(error.message || 'Authentication failed');
      }
    }
    return new Error(error.message || 'Authentication failed');
  }

  /**
   * Clears the stored verification ID and removes listeners
   */
  clearVerificationId(): void {
    this.verificationId = null;
    this.phoneVerificationPromise = null;
    // Remove all listeners to prevent memory leaks
    FirebaseAuthentication.removeAllListeners();
  }

  updateUserProfile(userDetails: any): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);
    return this.http.post(`${this.bpiUrl}/api/auth/register-user/`, userDetails, { headers });
  }

  setLastDashboard(dashboardType: 'user' | 'counsellor'): void {
    localStorage.setItem('lastDashboard', dashboardType);
  }

  getLastDashboard(): 'user' | 'counsellor' | null {
    return localStorage.getItem('lastDashboard') as 'user' | 'counsellor' | null;
  }

  clearLastDashboard(): void {
    localStorage.removeItem('lastDashboard');
  }

  logout(): void {
    localStorage.removeItem('access_token'); // Assuming this is how token is stored
    this.clearLastDashboard();
    // You might want to add router.navigate(['/login']) here
  }
}
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ToastController } from '@ionic/angular';
import { WebrtcService } from '../webrtc.service';
import { Subscription } from 'rxjs';
import { VoiceRecorder } from 'capacitor-voice-recorder';

// Define interfaces for type safety
interface User {
  name: string;
  email: string;
  phone_number: string;
}

interface Counsellor {
  id?: number;
  user_id?: number;
  name?: string;
  specialization?: string;
  session_date?: string;
  session_time?: string;
  duration?: number | string;
  price?: number | string;
  profile_photo?: string;
}

interface Order {
  order_id: string;
  amount: number;
  currency: string;
  key: string;
  name?: string;
  description?: string;
  image?: string;
  booking_id?: number;
}

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  standalone: false,
})
export class CheckoutComponent implements OnInit {
  counsellor: Counsellor = {};
  user: User = { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };
  paymentSettings: any = null;
  sessionDate: string = '';
  sessionTime: string = '';
  sessionDuration: number | null = null;
  sessionPrice: number | null = null;
  apiUrl: string = environment.apiUrl;
  private subscriptions: Subscription[] = [];
  private webrtcService: WebrtcService | null = null;
  private userProfileLoaded: boolean = false; // Track if user profile is loaded
  userExtraMinutes: number | null = null;

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController,
    private injector: Injector
  ) {}

  ngOnInit() {
    this.counsellor = history.state.counsellor || {};
    console.log('Booking counsellor:', this.counsellor);

    if (!this.counsellor.id || !this.counsellor.name) {
      console.error('Invalid counsellor data:', this.counsellor);
      this.showToast('Invalid counsellor selection. Please try again.', 'danger');
      this.router.navigate(['/user-dashboard']);
      return;
    }

    console.log('Checkout: Valid counsellor data:', this.counsellor);
    // Initialize session date/time to now by default
    const now = new Date();
    this.sessionDate = now.toLocaleDateString();
    this.sessionTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // If counsellor object already contains details, prefer them
    if (this.counsellor.session_date) {
      this.sessionDate = this.counsellor.session_date;
    }
    if (this.counsellor.session_time) {
      this.sessionTime = this.counsellor.session_time;
    }
    if (this.counsellor.duration) {
      this.sessionDuration = Number(this.counsellor.duration) || null;
    }
    if (this.counsellor.price) {
      const parsed = Number(this.counsellor.price);
      this.sessionPrice = isNaN(parsed) ? null : parsed;
    }
    this.loadUserProfile();
    this.loadCounsellorPaymentSettings();
    this.initializeWebRTCService();
    this.loadUserExtraMinutes();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadCounsellorPaymentSettings() {
    const userId = this.counsellor?.user_id || this.counsellor?.id;
    if (!userId) {
      console.warn('No user_id found on counsellor for fetching payment settings');
      return;
    }

    const url = `${environment.apiUrl}/api/counsellor/payment-settings/${userId}/`;
    console.log('Fetching counsellor payment settings from:', url);
    const sub = this.http.get(url).subscribe({
      next: (response: any) => {
        console.log('Counsellor payment settings:', response);
        this.paymentSettings = response;
        // Map settings to session fields
        if (response?.session_duration) {
          this.sessionDuration = response.session_duration;
        }
        if (response?.session_fee) {
          const fee = parseFloat(response.session_fee);
          this.sessionPrice = isNaN(fee) ? null : fee;
        }
      },
      error: (error) => {
        
    
      }
    });
    this.subscriptions.push(sub);
  }

  private initializeWebRTCService() {
    try {
      this.webrtcService = this.injector.get(WebrtcService);
    } catch (error) {
      console.error('Error initializing WebRTC service:', error);
    }
  }

  async loadUserProfile() {
    const profileSub = this.http.get(`${environment.apiUrl}/api/dashboard/profile/`).subscribe({
      next: (response: any) => {
        console.log('Checkout: User profile response:', response);
        // Validate response.user and ensure it has required fields
        if (response.user && response.user.name && response.user.email && response.user.phone_number) {
          this.user = response.user;
        } else {
          console.warn('Invalid user profile data:', response.user);
          this.user = { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };
        }
        this.userProfileLoaded = true;
      },
      error: (error) => {
   

        this.user = { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };
        this.userProfileLoaded = true;
      },
    });

    this.subscriptions.push(profileSub);
  }

  private loadUserExtraMinutes() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    const extraMinutesSub = this.http.get(`${environment.apiUrl}/api/user/wallet/extra_minutes/`, { headers }).subscribe({
      next: (response: any) => {
        console.log('User extra minutes response:', response);
        if (response.extra_minutes !== undefined) {
          this.userExtraMinutes = response.extra_minutes;
        }
      },
      error: (error) => {
    
     
      }
    });
    this.subscriptions.push(extraMinutesSub);
  }

  async initiatePayment() {
    if (!this.counsellor.id) {
      console.error('Counsellor ID missing:', this.counsellor);
      this.showToast('Invalid counsellor data.', 'danger');
      return;
    }

    // Use default user values if profile not loaded
    if (!this.userProfileLoaded) {
      console.warn('User profile not loaded yet. Using default user values.');
      this.user = { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };
    }

    const payload = { counsellor_id: this.counsellor.user_id };
    console.log('Checkout: Initiating payment with payload:', payload);

    const paymentSub = this.http
      .post(`${environment.apiUrl}/api/dashboard/payment/create-order/`, payload)
      .subscribe({
        next: (response: any) => {
          console.log('Razorpay order response:', response);
          this.loadRazorpayScript().then(() => {
            this.openRazorpayCheckout(response);
          }).catch((error) => {
            console.error('Failed to load Razorpay script:', error);
            this.showToast('Failed to load payment gateway. Please try again.', 'danger');
          });
        },
        error: (error) => {
          console.error('Order creation error:', error);
          this.showToast('Failed to initiate payment: ' + (error.error?.detail || 'Unknown error'), 'danger');
        },
      });

    this.subscriptions.push(paymentSub);
  }

  private loadRazorpayScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ((window as any).Razorpay) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Razorpay script'));
      document.body.appendChild(script);
    });
  }

  openRazorpayCheckout(order: Order) {
    console.log('openRazorpayCheckout: order object:', order);
    console.log('openRazorpayCheckout: this.user object:', this.user);

    if (!(window as any).Razorpay) {
      console.error('Razorpay not loaded');
      this.showToast('Payment gateway not loaded. Please try again.', 'danger');
      return;
    }

    // Ensure user object has fallback values
    const user: User = this.user || { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };

    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: order.name ?? 'Counselling Session',
      description: order.description ?? 'Online Counselling Session',
      image: order.image ?? 'https://example.com/your_logo.png',
      order_id: order.order_id,
      handler: (response: any) => {
        this.verifyPayment(response, order.booking_id);
      },
      prefill: {
        name: user.name || 'Guest',
        email: user.email || 'guest@example.com',
        contact: user.phone_number || '9999999999',
      },
      theme: {
        color: '#3399cc',
      },
    };

    try {
      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (response: any) => {
        this.showToast('Payment failed: ' + (response.error.description || 'Unknown error'), 'danger');
      });
      rzp.open();
    } catch (error) {
      console.error('Error initializing Razorpay:', error);
      this.showToast('Failed to initialize payment. Please try again.', 'danger');
    }
  }

  verifyPayment(paymentResponse: any, bookingId?: number) {
    const payload = new URLSearchParams({
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_signature: paymentResponse.razorpay_signature,
    }).toString();

    const verifySub = this.http
      .post(`${environment.apiUrl}/api/dashboard/payment/verify-payment/`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
        next: (response: any) => {
          console.log('Payment verification response:', response);
          console.log('Payment verification response status:', response.status);
          if (response.status === 'Payment Successful') {
            this.showToast('Payment Successful!', 'success');
            this.initiateCall(response.booking_id || bookingId);
          } else {
            this.showToast('Status from backend: ' + response.status, 'primary');
            console.log('Payment verification response:', response);
            console.log('Payment verification response status:', response.status);

// 👇 Temporary debugging
          
            
          }
        },
        error: (error) => {
          console.error('Payment verification error:', error);
          this.showToast('Payment verification failed.', 'danger');
        },
      });

    this.subscriptions.push(verifySub);
  }

  async initiateCall(bookingId?: number) {
    try {
      const accessToken = localStorage.getItem('access_token');
      console.log('Access token in initiateCall:', accessToken);
      if (!accessToken) {
        this.showToast('No authentication token found. Please log in again.', 'danger');
        this.router.navigate(['/login']);
        return;
      }

      const callInitSub = this.http
        .post(`${environment.apiUrl}/api/dashboard/call/initiate/`, { booking_id: bookingId })
        .subscribe({
          next: async (response: any) => {
            console.log('Call initiation response:', response);
            
            // Request microphone permission
            const hasPermission = await this.requestMicrophonePermission();
            if (!hasPermission) {
              return; // Stop if permission not granted
            }

            if (this.webrtcService) {
              try {
                await this.webrtcService.startCall(bookingId ?? 0, { audio: true }, accessToken, this.userExtraMinutes ?? this.sessionDuration ?? undefined);
                
                const messageSub = this.webrtcService.getMessageObservable().subscribe((message: any) => {
                  console.log('Received WebRTC message in checkout:', message);
                  if (this.webrtcService) {
                    this.webrtcService.handleMessage(message);
                  }
                });

                const stateSub = this.webrtcService.getCallStateObservable().subscribe((state: string) => {
                  console.log('Call state changed in checkout:', state);
                  if (state === 'failed') {
                    this.showToast('Failed to connect to the call. Please check your network or try again.', 'danger');
                  } else if (state === 'connected') {
                    this.showToast('Call connected successfully!', 'success');
                  } else if (state === 'ringing') { // Changed from 'calling' to 'ringing'
                    this.showToast('Ringing...', 'primary');
                  }
                });

                this.subscriptions.push(messageSub, stateSub);

                this.showToast('Call initiated! Waiting for counsellor...', 'success');
                
                this.router.navigate(['/call'], {
                  state: { bookingId, counsellor: this.counsellor },
                });
              } catch (webrtcError) {
                console.error('WebRTC error:', webrtcError);
                this.showToast('Failed to initialize call. Please check your network or try again.', 'danger');
              }
            } else {
              console.error('WebRTC service not available');
              this.showToast('Call service not available.', 'danger');
            }
          },
          error: (error) => {
            console.error('Call initiation error:', error);
            this.showToast('Failed to initiate call. Please try again.', 'danger');
          },
        });

      this.subscriptions.push(callInitSub);
    } catch (error) {
      console.error('Call initiation error:', error);
      this.showToast('Failed to initiate call. Please try again.', 'danger');
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

  goToDashboard(): void {
    this.router.navigate(['/user-dashboard']);
  }

  async requestMicrophonePermission(): Promise<boolean> {
    const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
    if (hasPermission.value) {
      return true;
    }

    const requestResult = await VoiceRecorder.requestAudioRecordingPermission();
    if (requestResult.value) {
      return true;
    } else {
      this.showToast('Microphone permission is required for calls.', 'danger');
      return false;
    }
  }
}
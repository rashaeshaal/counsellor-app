// checkout.component.ts - Fixed version
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Injector, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { ToastController } from '@ionic/angular';
import { WebrtcService } from '../webrtc.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  standalone: false,
})
export class CheckoutComponent implements OnInit {
  counsellor: any = {};
  user: any = { name: 'Guest', email: 'guest@example.com', phone_number: '9999999999' };
  private subscriptions: Subscription[] = [];
  private webrtcService: WebrtcService | null = null;

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
    this.loadUserProfile();
    this.initializeWebRTCService();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private initializeWebRTCService() {
    try {
      this.webrtcService = this.injector.get(WebrtcService);
    } catch (error) {
      console.error('Error initializing WebRTC service:', error);
    }
  }

  async loadUserProfile() {
    const profileSub = this.http.get(`${environment.apiUrl}/api/user/profile/`).subscribe({
      next: (response: any) => {
        console.log('Checkout: User profile response:', response);
        this.user = response.user;
      },
      error: (error) => {
        console.error('Checkout: User profile error:', error);
        this.showToast('Failed to load user profile.', 'danger');
      },
    });

    this.subscriptions.push(profileSub);
  }

  async initiatePayment() {
    if (!this.counsellor.id) {
      console.error('Counsellor ID missing:', this.counsellor);
      this.showToast('Invalid counsellor data.', 'danger');
      return;
    }

    const payload = { counsellor_id: this.counsellor.id };
    console.log('Checkout: Initiating payment with payload:', payload);

    const paymentSub = this.http
      .post(`${environment.apiUrl}/api/payment/create-order/`, payload)
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

  // Dynamically load Razorpay script
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

  openRazorpayCheckout(order: any) {
    if (!(window as any).Razorpay) {
      console.error('Razorpay not loaded');
      this.showToast('Payment gateway not loaded. Please try again.', 'danger');
      return;
    }

    const options = {
      key: order.key,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      image: order.image,
      order_id: order.order_id,
      handler: (response: any) => {
        this.verifyPayment(response, order.booking_id);
      },
      prefill: {
        name: this.user.name,
        email: this.user.email,
        contact: this.user.phone_number,
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

  verifyPayment(paymentResponse: any, bookingId: number) {
    const payload = new URLSearchParams({
      razorpay_payment_id: paymentResponse.razorpay_payment_id,
      razorpay_order_id: paymentResponse.razorpay_order_id,
      razorpay_signature: paymentResponse.razorpay_signature,
    }).toString();

    const verifySub = this.http
      .post(`${environment.apiUrl}/api/payment/verify-payment/`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .subscribe({
          next: (response: any) => {
              console.log('Payment verification response:', response);
              if (response.status === 'Payment credited to wallet') {
                  this.showToast('Payment credited to wallet!', 'success');
                  // Add delay to ensure payment processing is complete
                  setTimeout(() => {
                      this.initiateCall(response.booking_id || bookingId);
                  }, 1000);
              } else {
                  this.showToast('Unexpected payment status.', 'danger');
              }
          },
        error: (error) => {
          console.error('Payment verification error:', error);
          this.showToast('Payment verification failed.', 'danger');
        },
      });

    this.subscriptions.push(verifySub);
  }

  async initiateCall(bookingId: number) {
    try {
      const accessToken = localStorage.getItem('access_token');
      console.log('Access token in initiateCall:', accessToken);
      if (!accessToken) {
        this.showToast('No authentication token found. Please log in again.', 'danger');
        this.router.navigate(['/login']);
        return;
      }

      // First initiate call via API to create CallRequest and notify counsellor
      const callInitSub = this.http
        .post(`${environment.apiUrl}/api/call/initiate/`, { booking_id: bookingId })
        .subscribe({
          next: async (response: any) => {
            console.log('Call initiation response:', response);
            
            // Add delay to ensure call request is created
            setTimeout(async () => {
              if (this.webrtcService) {
                try {
                  // Start the WebRTC call
                  await this.webrtcService.startCall(bookingId, { audio: true, video: false }, accessToken);
                  
                  // Subscribe to WebRTC service observables
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
                    } else if (state === 'calling') {
                      this.showToast('Calling counsellor...', 'primary');
                    }
                  });

                  this.subscriptions.push(messageSub, stateSub);

                  this.showToast('Call initiated! Waiting for counsellor...', 'success');
                  
                  // Navigate to call component
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
            }, 1500); // Delay to ensure backend processing is complete
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
}
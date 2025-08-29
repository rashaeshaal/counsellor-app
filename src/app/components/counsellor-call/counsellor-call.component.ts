import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, timeout } from 'rxjs';
import { environment } from 'src/environments/environment';
import { WebrtcService } from 'src/app/webrtc.service';
import { ToastController } from '@ionic/angular';
import { NotificationService } from 'src/app/services/notification.service';

@Component({
  selector: 'app-counsellor-call',
  templateUrl: './counsellor-call.component.html',
  styleUrls: ['./counsellor-call.component.scss'],
  standalone: false,
})
export class CounsellorCallComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('localAudio', { static: false }) localAudio?: ElementRef<HTMLAudioElement>;
  @ViewChild('remoteAudio', { static: false }) remoteAudio?: ElementRef<HTMLAudioElement>;
  
  bookingId?: number;
  clientInfo: any = {};
  private subscriptions: Subscription[] = [];
  incomingCallMessage: string = '';
  callState: string = 'idle';
  isAudioEnabled: boolean = true;
  
  isMuted: boolean = false;
  callDuration: string = '00:00';
  hasIncomingCall: boolean = false;
  private isDestroyed = false;
  private sessionDuration: number | null = null;
  
  private callStartTime?: Date;
  private timerInterval?: any;
  
  // Performance flags
  private isProcessingAction = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private webrtcService: WebrtcService,
    private toastCtrl: ToastController,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.initializeBookingId();
    this.setupCallStateSubscription();
    this.setupMessageSubscription();
  }

  ngAfterViewInit() {
    this.setupMediaElements();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearTimer();
    this.webrtcService.endCall();
  }

  private initializeBookingId() {
    // Check query params first
    this.route.queryParams.subscribe(params => {
      const bookingIdFromParams = params['bookingId'] ? parseInt(params['bookingId'], 10) : undefined;
      if (bookingIdFromParams && !isNaN(bookingIdFromParams)) {
        this.bookingId = bookingIdFromParams;
        this.initializeCall();
        return;
      }
      
      // Check navigation state
      if (history.state.bookingId) {
        const bookingIdFromState = parseInt(history.state.bookingId, 10);
        if (!isNaN(bookingIdFromState)) {
          this.bookingId = bookingIdFromState;
          this.clientInfo = history.state.clientInfo || {};
          this.initializeCall();
          return;
        }
      }
      
      // Fallback to active booking
      this.fetchActiveBooking();
    });
  }

  private initializeCall() {
    if (this.bookingId) {
      this.loadBookingDetails();
      this.initializeWebSocket(this.bookingId);
    }
  }

  private fetchActiveBooking() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    const activeBookingSub = this.http.get(`${environment.apiUrl}/api/counsellor/active-booking/`, { headers })
      .subscribe({
        next: (response: any) => {
          if (response.booking_id && !isNaN(response.booking_id)) {
            this.bookingId = response.booking_id;
            this.clientInfo = { name: response.user_name || 'Client' };
            this.initializeCall();
          } else {
            this.showToast('No active bookings found', 'warning');
          }
        },
        error: (error) => {
          console.error('Failed to fetch active booking:', error);
          this.showToast('Failed to fetch active booking', 'danger');
        }
      });

    this.subscriptions.push(activeBookingSub);
  }

  private initializeWebSocket(bookingId: number) {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.showToast('Please log in to join the call', 'danger');
      this.router.navigate(['/counsellor-dashboard']);
      return;
    }

    this.webrtcService.connectWebSocket(bookingId, token)
      .catch(error => {
        console.error('Failed to connect WebSocket:', error);
        this.showToast('Failed to connect to call server', 'danger');
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.router.navigate(['/counsellor-dashboard']);
          }
        }, 2000);
      });
  }

  private loadBookingDetails() {
    if (!this.bookingId) return;

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    this.http.get(`${environment.apiUrl}/api/counsellor/bookings/${this.bookingId}/`, { headers })
      .subscribe({
        next: (response: any) => {
          this.clientInfo = response.user_details || response.client || {};
          if (!this.clientInfo.name) {
            this.clientInfo.name = response.user_name || 'Client';
          }
          this.sessionDuration = response.session_duration;
        },
        error: (error) => {
          console.error('Failed to load booking details:', error);
          this.showToast('Failed to load booking information', 'danger');
        }
      });
  }

  private setupCallStateSubscription() {
    const callStateSub = this.webrtcService.getCallStateObservable().subscribe((state: string) => {
      this.ngZone.run(() => {
        this.callState = state;

        switch (state) {
          case 'incoming':
            this.hasIncomingCall = true;
            this.incomingCallMessage = `Incoming call from ${this.clientInfo.name || 'Client'}`;
            this.showToast(this.incomingCallMessage, 'primary');
            this.cdr.detectChanges(); // Force UI update
            break;
          case 'accepting':
            this.callState = 'connecting';
            this.hasIncomingCall = false;
            this.isProcessingAction = false;
            this.showToast('Accepting call...', 'primary');
            break;
          case 'connecting':
            this.hasIncomingCall = false;
            this.showToast('Connecting to call...', 'primary');
            break;
          case 'connected':
            this.startCallTimer(); 
            this.hasIncomingCall = false;
            this.incomingCallMessage = '';
            this.isProcessingAction = false;
            this.showToast('Call connected successfully!', 'success');
            this.setupMediaElements();
            break;
          case 'disconnected':
          case 'failed':
          case 'ended':
            this.clearTimer();
            this.hasIncomingCall = false;
            this.incomingCallMessage = '';
            this.isProcessingAction = false;
            const message = state === 'failed' ? 'Call connection failed' : 'Call ended';
            this.showToast(message, state === 'failed' ? 'danger' : 'warning');
            setTimeout(() => {
              if (!this.isDestroyed) {
                this.router.navigate(['/counsellor-dashboard']);
              }
            }, 1500);
            break;
        }
        this.cdr.detectChanges();
      });
    });

    this.subscriptions.push(callStateSub);
  }

  private setupMessageSubscription() {
    const messageSub = this.webrtcService.getMessageObservable().subscribe((message: any) => {
      this.ngZone.run(() => {
        if (message.type === 'call_initiated') {
          const bookingIdFromMessage = parseInt(message.booking_id, 10);
          if (bookingIdFromMessage && !isNaN(bookingIdFromMessage)) {
            this.bookingId = bookingIdFromMessage;
            this.loadBookingDetails();
            this.hasIncomingCall = true;
            this.incomingCallMessage = `Incoming call from ${this.clientInfo.name || 'Client'}`;
            this.notificationService.notifyIncomingCall(this.bookingId!, this.clientInfo.name || 'Client');
            this.cdr.detectChanges();
          }
        } else if (message.type === 'call_accepted') {
          this.hasIncomingCall = false;
          this.incomingCallMessage = '';
          this.callState = 'connecting';
          this.showToast('Call accepted by counsellor', 'success');
        } else if (message.type === 'call_ended' || message.type === 'call_rejected') {
          this.hasIncomingCall = false;
          this.incomingCallMessage = '';
          this.isProcessingAction = false;
          this.clearTimer();
          const message_text = message.type === 'call_rejected' ? 'Call was rejected' : 'Call ended';
          this.showToast(message_text, 'warning');
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.router.navigate(['/counsellor-dashboard']);
            }
          }, 1500);
        }
        this.cdr.detectChanges();
      });
    });

    this.subscriptions.push(messageSub);
  }

  private setupMediaElements(retryCount = 0, maxRetries = 3) {
    if (this.isDestroyed || retryCount >= maxRetries) return;

    if (!this.localAudio || !this.remoteAudio) {
      setTimeout(() => this.setupMediaElements(retryCount + 1, maxRetries), 300);
      return;
    }

    const localStreamSub = this.webrtcService.getLocalStreamObservable().subscribe((stream: MediaStream | null) => {
      if (stream && this.localAudio?.nativeElement) {
        this.localAudio.nativeElement.srcObject = stream;
        this.localAudio.nativeElement.muted = true;
        this.localAudio.nativeElement.play().catch(error => console.warn('Local audio play error:', error));
      }
    });

    const remoteStreamSub = this.webrtcService.getRemoteStreamObservable().subscribe((stream: MediaStream | null) => {
      if (stream && this.remoteAudio?.nativeElement) {
        this.remoteAudio.nativeElement.srcObject = stream;
        this.remoteAudio.nativeElement.play().catch(error => console.warn('Remote audio play error:', error));
      }
    });

    this.subscriptions.push(localStreamSub, remoteStreamSub);
  }

  // Optimized accept call with debouncing
  async acceptCall() {
    if (this.isProcessingAction || !this.bookingId) {
      console.warn('Action already in progress or invalid booking ID');
      return;
    }

    this.isProcessingAction = true;
    this.cdr.detectChanges();

    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
      });

      // API call with shorter timeout for mobile
      const acceptRequest = this.http.post(`${environment.apiUrl}/api/counsellor/accept/`,
        { booking_id: this.bookingId },
        { 
          headers
        }
      ).pipe(timeout(5000)) // 5 second timeout
      .subscribe({
        next: (response: any) => {
          this.hasIncomingCall = false;
          this.incomingCallMessage = '';
          this.callState = 'connecting';
          this.showToast('Call accepted, connecting...', 'success');
          
          // Accept the call immediately without waiting
          this.webrtcService.acceptIncomingCall(
            this.bookingId!,
            { audio: true },
            undefined,
            this.sessionDuration ?? undefined
          );
        },
        error: (error) => {
          console.error('Accept call API error:', error);
          this.isProcessingAction = false;
          this.showToast('Failed to accept call', 'danger');
          this.cdr.detectChanges();
        }
      });

      this.subscriptions.push(acceptRequest);
    } catch (error) {
      console.error('Error in acceptCall:', error);
      this.isProcessingAction = false;
      this.showToast('Failed to accept call', 'danger');
      this.cdr.detectChanges();
    }
  }

  // Optimized reject call
  rejectCall() {
    if (this.isProcessingAction) return;
    
    this.isProcessingAction = true;
    this.webrtcService.rejectCall();
    this.hasIncomingCall = false;
    this.showToast('Call rejected', 'warning');
    
    setTimeout(() => {
      this.router.navigate(['/counsellor-dashboard']);
    }, 500);
  }

  async startCall() {
    if (!this.bookingId || this.isProcessingAction) return;

    this.isProcessingAction = true;
    this.cdr.detectChanges();

    try {
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
      });

      const initSub = this.http.post(`${environment.apiUrl}/api/call/counsellor-initiate/`, 
        { booking_id: this.bookingId }, 
        { headers }
      ).pipe(timeout(5000))
      .subscribe({
        next: async (response: any) => {
          await this.webrtcService.startCall(this.bookingId!, { audio: true }, undefined, this.sessionDuration ?? undefined);
          this.showToast('Call initiated', 'success');
        },
        error: (error) => {
          console.error('Failed to initiate call:', error);
          this.isProcessingAction = false;
          this.showToast('Failed to start call', 'danger');
          this.cdr.detectChanges();
        }
      });

      this.subscriptions.push(initSub);
    } catch (error) {
      console.error('Error starting call:', error);
      this.isProcessingAction = false;
      this.showToast('Failed to start call', 'danger');
      this.cdr.detectChanges();
    }
  }

  async endCall() {
    if (!this.bookingId) {
      this.router.navigate(['/counsellor-dashboard']);
      return;
    }

    this.webrtcService.endCall();
    this.clearTimer();
    this.hasIncomingCall = false;

    let actualDurationMinutes = 0;
    if (this.callStartTime) {
      const now = new Date();
      const diff = now.getTime() - this.callStartTime.getTime();
      actualDurationMinutes = Math.floor(diff / 60000);
    }

    let remainingMinutes = 0;
    if (this.sessionDuration !== null && actualDurationMinutes < this.sessionDuration) {
      remainingMinutes = this.sessionDuration - actualDurationMinutes;
    }

    if (remainingMinutes > 0) {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        this.http.post(`${environment.apiUrl}/api/call/credit_minutes/`, {
          booking_id: this.bookingId,
          booked_duration: this.sessionDuration,
          actual_duration: actualDurationMinutes,
          remaining_minutes: remainingMinutes
        }, {
          headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
        }).subscribe({
          next: (response) => {
            this.showToast(`Credited ${remainingMinutes} minutes to wallet.`, 'success');
          },
          error: (error) => {
            console.error('Failed to credit minutes:', error);
            this.showToast('Failed to credit remaining minutes.', 'danger');
          }
        });
      }
    }

    this.router.navigate(['/counsellor-dashboard']);
  }

  async toggleAudio() {
    try {
      this.isAudioEnabled = await this.webrtcService.toggleAudio();
      this.isMuted = !this.isAudioEnabled;
      const message = this.isAudioEnabled ? 'Microphone enabled' : 'Microphone disabled';
      this.showToast(message, 'primary');
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      this.showToast('Failed to toggle microphone', 'danger');
    }
  }

  private startCallTimer() {
    this.callStartTime = new Date();
    this.timerInterval = setInterval(() => {
      this.updateCallDuration();
    }, 1000);
  }

  private updateCallDuration() {
    if (this.callStartTime) {
      const now = new Date();
      const diff = now.getTime() - this.callStartTime.getTime();
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      this.callDuration = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = undefined;
    }
    this.callStartTime = undefined;
    this.callDuration = '00:00';
  }

  private async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  // Getters
  get isConnected(): boolean {
    return this.callState === 'connected';
  }

  get isConnecting(): boolean {
    return ['calling', 'connecting'].includes(this.callState);
  }

  get callStateText(): string {
    switch (this.callState) {
      case 'idle': return 'Ready to start call';
      case 'calling': return 'Calling client...';
      case 'connecting': return 'Connecting...';
      case 'connected': return `Connected - ${this.callDuration}`;
      case 'disconnected': return 'Disconnected';
      case 'ended': return 'Call Ended';
      case 'failed': return 'Connection Failed';
      case 'incoming': return 'Incoming Call';
      default: return this.callState;
    }
  }

  get clientName(): string {
    return this.clientInfo?.name || this.clientInfo?.username || 'Client';
  }

  get isActionInProgress(): boolean {
    return this.isProcessingAction;
  }
}

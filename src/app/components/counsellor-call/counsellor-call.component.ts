import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval, of, Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
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
  @ViewChild('localVideo', { static: false }) localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo', { static: false }) remoteVideo?: ElementRef<HTMLVideoElement>;

  bookingId?: number;
  clientInfo: any = {};
  private subscriptions: Subscription[] = [];
  incomingCallMessage: string = '';
  callState: string = 'idle';
  isAudioEnabled: boolean = true;
  isVideoEnabled: boolean = false;
  isMuted: boolean = false;
  callDuration: string = '00:00';
  hasIncomingCall: boolean = false;
  private isDestroyed = false;
  private sessionDuration: number | null = null;
  
  private callStartTime?: Date;
  private timerInterval?: any;

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private webrtcService: WebrtcService,
    private toastCtrl: ToastController,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    // Check query params for bookingId
    this.route.queryParams.subscribe(params => {
      const bookingIdFromParams = params['bookingId'] ? parseInt(params['bookingId'], 10) : undefined;
      if (bookingIdFromParams && !isNaN(bookingIdFromParams)) {
        this.bookingId = bookingIdFromParams;
        this.loadBookingDetails().subscribe();
        this.initializeWebSocket(this.bookingId);
      } else if (history.state.bookingId) {
        const bookingIdFromState = parseInt(history.state.bookingId, 10);
        if (!isNaN(bookingIdFromState)) {
          this.bookingId = bookingIdFromState;
          this.clientInfo = history.state.clientInfo || {};
          this.loadBookingDetails().subscribe();
          this.initializeWebSocket(this.bookingId);
        } else {
          this.fetchActiveBooking();
        }
      } else {
        this.fetchActiveBooking();
      }
    });


    // Check navigation state as a fallback
    if (!this.bookingId && history.state.bookingId) {
      const bookingIdFromState = parseInt(history.state.bookingId, 10);
      if (!isNaN(bookingIdFromState)) {
        this.bookingId = bookingIdFromState;
        this.clientInfo = history.state.clientInfo || {};
        console.log('CounsellorCallComponent: Navigation state bookingId:', this.bookingId);
        if (this.bookingId !== undefined) {
          this.initializeWebSocket(this.bookingId);
          this.loadBookingDetails().subscribe();
        }
      } else {
        this.fetchActiveBooking();
      }
    }

    // Fetch active booking if no bookingId
    if (!this.bookingId) {
      this.fetchActiveBooking();
    }

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
    console.log('CounsellorCallComponent destroyed, WebSocket closed');
  }

  private fetchActiveBooking() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    const activeBookingSub = this.http.get(`${environment.apiUrl}/api/counsellor/active-booking/`, { headers }).subscribe({
      next: (response: any) => {
        console.log('Active booking response:', response);
        if (response.booking_id && !isNaN(response.booking_id)) {
          this.bookingId = response.booking_id;
          this.clientInfo = { name: response.user_name || 'Client' };
          console.log(`Fetched active booking ID: ${this.bookingId}`);
          if (this.bookingId !== undefined) {
            this.initializeWebSocket(this.bookingId);
            this.loadBookingDetails().subscribe();
          }
        } else {
          console.log('No active bookings found');
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
    const accessToken: string | undefined = token ?? undefined;

    if (!accessToken) {
      console.warn('No access token found');
      this.showToast('Please log in to join the call', 'danger');
      this.router.navigate(['/counsellor-dashboard']);
      return;
    }

    this.webrtcService.connectWebSocket(bookingId, accessToken).then(() => {
      console.log(`WebSocket initialized for booking ${bookingId}`);
    }).catch(error => {
      console.error('Failed to connect WebSocket:', error);
      this.showToast('Failed to connect to call server', 'danger');
      this.callState = 'failed';
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.router.navigate(['/counsellor-dashboard']);
        }
      }, 2000);
    });
  }

  private loadBookingDetails(): Observable<any> {
    if (this.bookingId === undefined) {
      console.warn('No booking ID for loading details');
      return of(null);
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    return this.http.get(`${environment.apiUrl}/api/counsellor/bookings/${this.bookingId}/`, { headers })
      .pipe(
        tap((response: any) => {
          console.log('Booking details loaded:', response);
          this.clientInfo = response.user_details || response.client || {};
          if (!this.clientInfo.name) {
            this.clientInfo.name = response.user_name || 'Client';
          }
          this.sessionDuration = response.session_duration;
        }),
        catchError((error) => {
          console.error('Failed to load booking details:', error);
          this.showToast('Failed to load booking information', 'danger');
          return of(null);
        })
      );
  }

  

  private setupCallStateSubscription() {
    const callStateSub = this.webrtcService.getCallStateObservable().subscribe((state: string) => {
        console.log('Call state in CounsellorCallComponent:', state);
        this.callState = state;

        switch (state) {
            case 'incoming':
                this.hasIncomingCall = true;
                this.incomingCallMessage = `Incoming call from ${this.clientInfo.name || 'Client'}`;
                this.showToast(this.incomingCallMessage, 'primary');
                break;
            case 'accepting':
                this.callState = 'connecting';
                this.hasIncomingCall = false;
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
                this.showToast('Call connected successfully!', 'success');
                this.setupMediaElements();
                break;
            case 'disconnected':
            case 'failed':
            case 'ended':
                this.clearTimer();
                this.hasIncomingCall = false;
                this.incomingCallMessage = '';
                const message = state === 'failed' ? 'Call connection failed' : 'Call ended';
                this.showToast(message, state === 'failed' ? 'danger' : 'warning');
                setTimeout(() => {
                    if (!this.isDestroyed) {
                        this.router.navigate(['/counsellor-dashboard']);
                    }
                }, 1500);
                break;
        }
    });

    this.subscriptions.push(callStateSub);
}

  private setupMessageSubscription() {
    const messageSub = this.webrtcService.getMessageObservable().subscribe((message: any) => {
        console.log('Received message in CounsellorCallComponent:', message);
        
        if (message.type === 'call_initiated') {
            const bookingIdFromMessage = parseInt(message.booking_id, 10);
            if (bookingIdFromMessage && !isNaN(bookingIdFromMessage)) {
                this.bookingId = bookingIdFromMessage;
                this.loadBookingDetails().subscribe(() => {
                    this.hasIncomingCall = true;
                    this.incomingCallMessage = `Incoming call from ${this.clientInfo.name || 'Client'}`;
                    // Use NotificationService to show toast on dashboard
                    this.notificationService.notifyIncomingCall(this.bookingId!, this.clientInfo.name || 'Client');
                });
            }
        } else if (message.type === 'call_accepted') {
            // This is received by the user when counsellor accepts
            this.hasIncomingCall = false;
            this.incomingCallMessage = '';
            this.callState = 'connecting';
            this.showToast('Call accepted by counsellor', 'success');
        } else if (message.type === 'call_ended' || message.type === 'call_rejected') {
            this.hasIncomingCall = false;
            this.incomingCallMessage = '';
            this.clearTimer();
            const message_text = message.type === 'call_rejected' ? 'Call was rejected' : 'Call ended';
            this.showToast(message_text, 'warning');
            setTimeout(() => {
                if (!this.isDestroyed) {
                    this.router.navigate(['/counsellor-dashboard']);
                }
            }, 1500);
        }
        
        // Always let WebRTC service handle the message
        this.webrtcService.handleMessage(message);
    });

    this.subscriptions.push(messageSub);
}

  private setupMediaElements(retryCount = 0, maxRetries = 5) {
    if (this.isDestroyed || retryCount >= maxRetries) {
      console.warn(`Stopped retrying setupMediaElements after ${retryCount} attempts or component destruction`);
      return;
    }

    if (!this.localAudio || !this.remoteAudio || !this.localVideo || !this.remoteVideo) {
      console.warn(`Media elements not yet available, retrying (${retryCount + 1}/${maxRetries})...`, {
        localAudio: !!this.localAudio,
        remoteAudio: !!this.remoteAudio,
        localVideo: !!this.localVideo,
        remoteVideo: !!this.remoteVideo
      });
      setTimeout(() => this.setupMediaElements(retryCount + 1, maxRetries), 500);
      return;
    }

    console.log('Media elements available, setting up streams...');
    const localStreamSub = this.webrtcService.getLocalStreamObservable().subscribe((stream: MediaStream | null) => {
      if (stream && this.localAudio?.nativeElement && this.localVideo?.nativeElement) {
        this.localAudio.nativeElement.srcObject = stream;
        this.localVideo.nativeElement.srcObject = stream;
        this.localAudio.nativeElement.muted = true;
        this.localVideo.nativeElement.muted = true;
        this.localAudio.nativeElement.play().catch(error => console.error('Local audio play error:', error));
        this.localVideo.nativeElement.play().catch(error => console.error('Local video play error:', error));
      }
    });

    const remoteStreamSub = this.webrtcService.getRemoteStreamObservable().subscribe((stream: MediaStream | null) => {
      if (stream && this.remoteAudio?.nativeElement && this.remoteVideo?.nativeElement) {
        this.remoteAudio.nativeElement.srcObject = stream;
        this.remoteVideo.nativeElement.srcObject = stream;
        this.remoteAudio.nativeElement.play().catch(error => console.error('Remote audio play error:', error));
        this.remoteVideo.nativeElement.play().catch(error => console.error('Remote video play error:', error));
      }
    });

    this.subscriptions.push(localStreamSub, remoteStreamSub);
  }

  async startCall() {
  if (this.bookingId === undefined) {
    this.showToast('Invalid booking ID', 'danger');
    return;
  }

  const bookingId = this.bookingId; // Capture bookingId locally to satisfy TypeScript

  try {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    const initSub = this.http.post(`${environment.apiUrl}/api/call/counsellor-initiate/`, 
      { booking_id: bookingId }, 
      { headers }
    ).subscribe({
      next: async (response: any) => {
        console.log('Call initiation response:', response);
        await this.webrtcService.startCall(bookingId, { audio: true, video: false }, undefined, this.sessionDuration ?? undefined);
        this.showToast('Call initiated', 'success');
      },
      error: (error) => {
        console.error('Failed to initiate call:', error);
        this.showToast('Failed to start call', 'danger');
      }
    });

    this.subscriptions.push(initSub);
  } catch (error) {
    console.error('Error starting call:', error);
    this.showToast('Failed to start call', 'danger');
  }
}

  async acceptCall() {
    if (this.bookingId === undefined) {
        console.error('Booking ID is undefined in acceptCall');
        this.showToast('Invalid booking ID', 'danger');
        return;
    }

    console.log('Accepting call for bookingId:', this.bookingId);

    try {
        const headers = new HttpHeaders({
            'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
        });

        // First, call the API to accept the call
        const acceptSub = this.http.post(`${environment.apiUrl}/api/counsellor/accept/`,
            { booking_id: this.bookingId },
            { headers }
        ).subscribe({
            next: (response: any) => {
                console.log('Accept call API response:', response);

                // Clear the incoming call state immediately
                this.hasIncomingCall = false;
                this.incomingCallMessage = '';
                this.callState = 'connecting';
                this.showToast('Call accepted, connecting...', 'success');

                console.log('Call accepted via API, now setting up WebRTC...');
                // Call immediately
                this.webrtcService.acceptIncomingCall(
                    this.bookingId!,
                    { audio: true, video: false },
                    undefined,
                    this.sessionDuration ?? undefined
                );
            },
            error: (error) => {
                console.error('Accept call API error:', error);
                this.showToast('Failed to accept call: ' + (error.error?.error || 'Unknown error'), 'danger');
                this.callState = 'failed';
            }
        });

        this.subscriptions.push(acceptSub);
    } catch (error) {
        console.error('Error in acceptCall:', error);
        this.showToast('Failed to accept call', 'danger');
        this.callState = 'failed';
    }
}


  rejectCall() {
    this.webrtcService.rejectCall();
    this.hasIncomingCall = false;
    this.showToast('Call rejected', 'warning');
    this.router.navigate(['/counsellor-dashboard']);
  }

  async endCall() {
    if (this.bookingId === undefined) {
        this.showToast('Invalid booking ID', 'danger');
        this.router.navigate(['/counsellor-dashboard']);
        return;
    }

    console.log('Counsellor ending call');
    this.webrtcService.endCall();
    this.clearTimer();
    this.hasIncomingCall = false;

    // Calculate actual duration
    let actualDurationMinutes = 0;
    if (this.callStartTime) {
      const now = new Date();
      const diff = now.getTime() - this.callStartTime.getTime();
      actualDurationMinutes = Math.floor(diff / 60000); // Convert milliseconds to minutes
    }

    // Calculate remaining minutes
    let remainingMinutes = 0;
    if (this.sessionDuration !== null && actualDurationMinutes < this.sessionDuration) {
      remainingMinutes = this.sessionDuration - actualDurationMinutes;
    }

    // Send data to backend to credit remaining minutes
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
            console.log('Minutes credited successfully:', response);
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

  async toggleVideo() {
    try {
      this.isVideoEnabled = await this.webrtcService.toggleVideo();
      const message = this.isVideoEnabled ? 'Camera enabled' : 'Camera disabled';
      this.showToast(message, 'primary');
      this.setupMediaElements();
    } catch (error) {
      console.error('Failed to toggle video:', error);
      this.showToast('Failed to toggle camera', 'danger');
    }
  }

  async switchToVideoCall() {
    try {
      if (!this.isVideoEnabled) {
        await this.webrtcService.enableVideo();
        this.isVideoEnabled = true;
        this.showToast('Switched to video call', 'success');
        this.setupMediaElements();
      }
    } catch (error) {
      console.error('Failed to switch to video:', error);
      this.showToast('Failed to enable video', 'danger');
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

  get isConnected(): boolean {
    return this.callState === 'connected';
  }

  get isConnecting(): boolean {
    return ['calling', 'connecting'].includes(this.callState);
  }

  get showVideoElements(): boolean {
    return this.isVideoEnabled && this.isConnected;
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

  // get clientAvatar(): string {
  //   return this.clientInfo?.profile_picture || this.clientInfo?.avatar || 'assets/images/default-avatar.png';
  // }
  // onImageError(event: Event) {
  //   (event.target as HTMLImageElement).src = 'assets/images/default-avatar.png';
  // }
}
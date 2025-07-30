
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { WebrtcService } from 'src/app/webrtc.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-call',
  templateUrl: './call.component.html',
  styleUrls: ['./call.component.scss'],
  standalone: false,
})
export class CallComponent implements OnInit, OnDestroy, AfterViewInit {

  bookingId?: number;
  counsellor: any;
  callStateText: string = 'Connecting...';
  callState: string = 'initiating';
  isRinging: boolean = false;
  private subscriptions: Subscription[] = [];
  private isDestroyed = false;

  // Properties for template binding
  isConnecting: boolean = false;
  isConnected: boolean = false;
  callDuration: string = '00:00';
  showVideoElements: boolean = false;
  isMuted: boolean = false;
  isAudioEnabled: boolean = true;
  isVideoEnabled: boolean = false;

  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('localAudio') localAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;

  private startTime?: number;
  private timerInterval?: any;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private webrtcService: WebrtcService,
    private toastCtrl: ToastController,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.bookingId = history.state.bookingId;
    this.counsellor = history.state.counsellor;

    console.log('CallComponent initialized with:', { bookingId: this.bookingId, counsellor: this.counsellor });

    if (!this.bookingId || !this.counsellor) {
      console.error('Missing booking ID or counsellor data, redirecting to dashboard');
      this.router.navigate(['/user-dashboard']);
      return;
    }

    // Initial state
    this.callState = 'ringing';
    this.callStateText = 'Calling counsellor...';
    this.isRinging = true;
    this.isConnecting = true;

    this.setupSubscriptions();
  }

  ngAfterViewInit() {
    // Setup media elements after view initialization
    setTimeout(() => {
      this.initializeStreams();
    }, 100);
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearTimer();
    
    // Only end call if we're still connected/connecting
    if (['connecting', 'connected', 'ringing'].includes(this.callState)) {
      this.webrtcService.endCall();
    }
  }

  private setupSubscriptions() {
    // Subscribe to call state changes
    const callStateSub = this.webrtcService.getCallStateObservable().subscribe((state: string) => {
      console.log('Call state in CallComponent:', state);
      this.updateCallState(state);
      
      if (state === 'disconnected' || state === 'ended') {
        this.clearTimer();
        this.showToast('Call ended', 'warning');
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.router.navigate(['/user-dashboard']);
          }
        }, 1500);
      } else if (state === 'connected') {
        this.startTimer();
        this.isRinging = false;
        this.showToast('Call connected!', 'success');
      } else if (state === 'failed') {
        this.showToast('Call failed to connect', 'danger');
        setTimeout(() => {
          if (!this.isDestroyed) {
            this.router.navigate(['/user-dashboard']);
          }
        }, 2000);
      }
    });

    // Subscribe to messages
    const messageSub = this.webrtcService.getMessageObservable().subscribe((message: any) => {
      console.log('Received WebRTC message in CallComponent:', message);
      
      switch (message.type) {
        case 'call_accepted':
          this.isRinging = false;
          this.callState = 'connecting';
          this.callStateText = 'Connecting...';
          this.showToast(`Call accepted by ${message.counsellor_name || 'Counsellor'}`, 'success');
          break;
          
        case 'call_rejected':
          this.showToast('Call was rejected by the counsellor', 'danger');
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.router.navigate(['/user-dashboard']);
            }
          }, 2000);
          break;
          
        case 'call_ended':
          this.showToast('Call ended by counsellor', 'warning');
          this.endCall();
          break;
      }
    }); 

    this.subscriptions.push(callStateSub, messageSub);
  }

  private updateCallState(state: string) {
    this.callState = state;
    this.isConnecting = ['connecting', 'initiating', 'ringing'].includes(state);
    this.isConnected = state === 'connected';
    this.callStateText = this.getCallStateText(state);
    this.showVideoElements = this.isVideoEnabled && this.isConnected;
    
    if (state === 'ringing') {
      this.isRinging = true;
      this.callStateText = 'Calling counsellor...';
    } else if (state === 'connecting') {
      this.isRinging = false;
      this.callStateText = 'Connecting...';
    }
  }

  private getCallStateText(state: string): string {
    switch (state) {
      case 'initiating':
        return 'Initiating call...';
      case 'ringing':
        return 'Calling counsellor...';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return `Connected - ${this.callDuration}`;
      case 'disconnected':
        return 'Disconnected';
      case 'ended':
        return 'Call Ended';
      case 'failed':
        return 'Connection Failed';
      default:
        return 'Unknown State';
    }
  }

  private startTimer() {
    this.startTime = Date.now();
    this.timerInterval = setInterval(() => {
      if (this.startTime) {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        this.callDuration = `${minutes}:${seconds}`;
        this.callStateText = `Connected - ${this.callDuration}`;
      }
    }, 1000);
  }

  private clearTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async initializeStreams() {
    try {
      // Subscribe to stream observables for real-time updates
      const localStreamSub = this.webrtcService.getLocalStreamObservable().subscribe((stream: MediaStream | null) => {
        if (stream && this.localVideo?.nativeElement && this.localAudio?.nativeElement) {
          this.localVideo.nativeElement.srcObject = stream;
          this.localAudio.nativeElement.srcObject = stream;
          this.localAudio.nativeElement.muted = true; // Prevent feedback
          this.localVideo.nativeElement.muted = true;
          this.localAudio.nativeElement.play().catch(e => console.error('Local audio play error:', e));
          this.localVideo.nativeElement.play().catch(e => console.error('Local video play error:', e));
        }
      });

      const remoteStreamSub = this.webrtcService.getRemoteStreamObservable().subscribe((stream: MediaStream | null) => {
        if (stream && this.remoteVideo?.nativeElement && this.remoteAudio?.nativeElement) {
          this.remoteVideo.nativeElement.srcObject = stream;
          this.remoteAudio.nativeElement.srcObject = stream;
          this.remoteAudio.nativeElement.play().catch(e => console.error('Remote audio play error:', e));
          this.remoteVideo.nativeElement.play().catch(e => console.error('Remote video play error:', e));
        }
      });

      this.subscriptions.push(localStreamSub, remoteStreamSub);

      // Also set current streams if available
      const localStream = this.webrtcService.getLocalStream();
      const remoteStream = this.webrtcService.getRemoteStream();

      if (localStream && this.localVideo?.nativeElement && this.localAudio?.nativeElement) {
        this.localVideo.nativeElement.srcObject = localStream;
        this.localAudio.nativeElement.srcObject = localStream;
        this.localAudio.nativeElement.muted = true;
        this.localVideo.nativeElement.muted = true;
      }

      if (remoteStream && this.remoteVideo?.nativeElement && this.remoteAudio?.nativeElement) {
        this.remoteVideo.nativeElement.srcObject = remoteStream;
        this.remoteAudio.nativeElement.srcObject = remoteStream;
      }
    } catch (error) {
      console.error('Error initializing streams:', error);
    }
  }

  // call.component.ts
async endCall() {
    console.log('User ending call');
    this.clearTimer();

    if (this.bookingId) {
        try {
            const headers = new HttpHeaders({
                'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
            });

            const endCallSub = this.http
                .post(`${environment.apiUrl}/api/call/end/`, { booking_id: this.bookingId }, { headers })
                .subscribe({
                    next: (response: any) => {
                        console.log('End call response:', response);
                        this.showToast('Call ended and funds transferred', 'success');
                        this.webrtcService.endCall();
                        this.router.navigate(['/user-dashboard']);
                    },
                    error: (error) => {
                        console.error('Failed to end call and transfer funds:', error);
                        this.showToast('Failed to end call and transfer funds', 'danger');
                        this.webrtcService.endCall();
                        this.router.navigate(['/user-dashboard']);
                    }
                });

            this.subscriptions.push(endCallSub);
        } catch (error) {
            console.error('Error ending call:', error);
            this.showToast('Failed to end call', 'danger');
            this.webrtcService.endCall();
            this.router.navigate(['/user-dashboard']);
        }
    } else {
        this.webrtcService.endCall();
        this.showToast('Call ended', 'warning');
        this.router.navigate(['/user-dashboard']);
    }
}

  async toggleAudio() {
    try {
      this.isAudioEnabled = await this.webrtcService.toggleAudio();
      this.isMuted = !this.isAudioEnabled;
      const message = this.isAudioEnabled ? 'Microphone enabled' : 'Microphone disabled';
      this.showToast(message, 'primary');
      return this.isAudioEnabled;
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      this.showToast('Failed to toggle microphone', 'danger');
      return this.isAudioEnabled;
    }
  }

  async toggleVideo() {
    try {
      this.isVideoEnabled = await this.webrtcService.toggleVideo();
      this.showVideoElements = this.isVideoEnabled && this.isConnected;
      const message = this.isVideoEnabled ? 'Camera enabled' : 'Camera disabled';
      this.showToast(message, 'primary');
      await this.initializeStreams();
      return this.isVideoEnabled;
    } catch (error) {
      console.error('Failed to toggle video:', error);
      this.showToast('Failed to toggle camera', 'danger');
      return this.isVideoEnabled;
    }
  }

  async switchToVideoCall() {
    try {
      this.isVideoEnabled = await this.webrtcService.enableVideo();
      this.showVideoElements = this.isConnected;
      this.showToast('Switched to video call', 'success');
      await this.initializeStreams();
    } catch (error) {
      console.error('Failed to switch to video:', error);
      this.showToast('Failed to enable video', 'danger');
    }
  }

  getLocalStream() {
    return this.webrtcService.getLocalStream();
  }

  getRemoteStream() {
    return this.webrtcService.getRemoteStream();
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'top',
    });
    await toast.present();
  }

  // Getter for counsellor name display
  get counsellorName(): string {
    return this.counsellor?.name || this.counsellor?.username || 'Counsellor';
  }

  get counsellorAvatar(): string {
    return this.counsellor?.profile_picture || this.counsellor?.avatar || 'assets/images/default-avatar.png';
  }
  onImageError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/images/default-avatar.png';
  }
} 
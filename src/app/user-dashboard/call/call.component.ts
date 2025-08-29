import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { WebrtcService } from 'src/app/webrtc.service';
import { environment } from 'src/environments/environment';
import { MiniCallService } from 'src/app/mini-call.service';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-call',
  templateUrl: './call.component.html',
  styleUrls: ['./call.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
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
  isMuted: boolean = false;
  isAudioEnabled: boolean = true;
  
  @ViewChild('localAudio') localAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;

  private startTime?: number;
  private timerInterval?: any;
  private isProcessingAction = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private webrtcService: WebrtcService,
    private toastCtrl: ToastController,
    private http: HttpClient,
    private miniCallService: MiniCallService,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit() {
    this.miniCallService.hideMiniUi();
    this.bookingId = history.state.bookingId;
    this.counsellor = history.state.counsellor;

    if (!this.bookingId || !this.counsellor) {
      console.error('Missing booking ID or counsellor data');
      this.router.navigate(['/user-dashboard']);
      return;
    }

    // Initial state
    this.callState = 'ringing';
    this.callStateText = 'Calling counsellor...';
    this.isRinging = true;
    this.isConnecting = true;

    this.setupSubscriptions();
    this.initiateCall();
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initializeStreams();
    }, 100);
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.clearTimer();
    
    if (['connecting', 'connected', 'ringing'].includes(this.webrtcService.getCurrentCallState())) {
      this.miniCallService.showMiniUi({
        bookingId: this.bookingId,
        counsellorName: this.counsellorName,
        callState: this.webrtcService.getCurrentCallState()
      });
    } else {
      this.miniCallService.hideMiniUi();
    }
  }

  private async initiateCall() {
    if (this.isProcessingAction) return;
    
    this.isProcessingAction = true;
    try {
      await this.webrtcService.startCall(
        this.bookingId!,
        { audio: true },
        localStorage.getItem('access_token') || undefined,
        this.counsellor?.session_duration
      );
    } catch (error) {
      console.error('Failed to initiate call:', error);
      this.showToast('Failed to start call', 'danger');
      this.isProcessingAction = false;
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.router.navigate(['/user-dashboard']);
        }
      }, 2000);
    }
  }

  private setupSubscriptions() {
    const callStateSub = this.webrtcService.getCallStateObservable().subscribe((state: string) => {
      this.ngZone.run(() => {
        this.updateCallState(state);
        
        if (state === 'disconnected' || state === 'ended') {
          this.clearTimer();
          this.isProcessingAction = false;
          this.showToast('Call ended', 'warning');
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.router.navigate(['/user-dashboard']);
            }
          }, 1500);
        } else if (state === 'connected') {
          this.startTimer();
          this.isRinging = false;
          this.isProcessingAction = false;
          this.showToast('Call connected!', 'success');
        } else if (state === 'failed') {
          this.isProcessingAction = false;
          this.showToast('Call failed to connect', 'danger');
          setTimeout(() => {
            if (!this.isDestroyed) {
              this.router.navigate(['/user-dashboard']);
            }
          }, 2000);
        }
        this.cdr.detectChanges();
      });
    });

    const messageSub = this.webrtcService.getMessageObservable().subscribe((message: any) => {
      this.ngZone.run(() => {
        switch (message.type) {
          case 'call_accepted':
            this.isRinging = false;
            this.callState = 'connecting';
            this.callStateText = 'Connecting...';
            this.showToast(`Call accepted by ${message.counsellor_name || 'Counsellor'}`, 'success');
            break;
            
          case 'call_rejected':
            this.isProcessingAction = false;
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
        this.cdr.detectChanges();
      });
    }); 

    this.subscriptions.push(callStateSub, messageSub);
  }

  private updateCallState(state: string) {
    this.callState = state;
    this.isConnecting = ['connecting', 'initiating', 'ringing'].includes(state);
    this.isConnected = state === 'connected';
    this.callStateText = this.getCallStateText(state);
    
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
      const localStreamSub = this.webrtcService.getLocalStreamObservable().subscribe((stream: MediaStream | null) => {
        if (stream && this.localAudio?.nativeElement) {
          this.localAudio.nativeElement.srcObject = stream;
          this.localAudio.nativeElement.muted = true;
          this.localAudio.nativeElement.play().catch(e => console.warn('Local audio play error:', e));
        }
      });

      const remoteStreamSub = this.webrtcService.getRemoteStreamObservable().subscribe((stream: MediaStream | null) => {
        if (stream && this.remoteAudio?.nativeElement) {
          this.remoteAudio.nativeElement.srcObject = stream;
          this.remoteAudio.nativeElement.play().catch(e => console.warn('Remote audio play error:', e));
        }
      });

      this.subscriptions.push(localStreamSub, remoteStreamSub);

      const localStream = this.webrtcService.getLocalStream();
      const remoteStream = this.webrtcService.getRemoteStream();

      if (localStream && this.localAudio?.nativeElement) {
        this.localAudio.nativeElement.srcObject = localStream;
        this.localAudio.nativeElement.muted = true;
      }

      if (remoteStream && this.remoteAudio?.nativeElement) {
        this.remoteAudio.nativeElement.srcObject = remoteStream;
      }
    } catch (error) {
      console.error('Error initializing streams:', error);
    }
  }

  cancelCall() {
    if (this.isProcessingAction) return;
    
    this.isProcessingAction = true;
    this.webrtcService.rejectCall();
    
    setTimeout(() => {
      this.router.navigate(['/user-dashboard']);
    }, 500);
  }

  async endCall() {
    if (this.isProcessingAction) return;
    
    this.isProcessingAction = true;
    this.clearTimer();
    this.webrtcService.endCall();
    this.showToast('Call ended', 'warning');

    let actualDurationMinutes = 0;
    if (this.startTime) {
      const now = Date.now();
      const diff = now - this.startTime;
      actualDurationMinutes = Math.floor(diff / 60000);
    }

    let bookedSessionDuration = 0;
    if (this.counsellor && this.counsellor.session_duration) {
      bookedSessionDuration = this.counsellor.session_duration;
    }

    let remainingMinutes = 0;
    if (bookedSessionDuration > 0 && actualDurationMinutes < bookedSessionDuration) {
      remainingMinutes = bookedSessionDuration - actualDurationMinutes;
    }

    if (remainingMinutes > 0 && this.bookingId) {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        this.http.post(`${environment.apiUrl}/api/call/credit_minutes/`, {
          booking_id: this.bookingId,
          booked_duration: bookedSessionDuration,
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

    this.router.navigate(['/user-dashboard']);
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

  get counsellorName(): string {
    return this.counsellor?.name || this.counsellor?.username || 'Counsellor';
  }

  get isActionInProgress(): boolean {
    return this.isProcessingAction;
  }
}
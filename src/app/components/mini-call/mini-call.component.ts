import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { MiniCallService } from 'src/app/mini-call.service';
import { WebrtcService } from 'src/app/webrtc.service';

@Component({
  selector: 'app-mini-call',
  templateUrl: './mini-call.component.html',
  styleUrls: ['./mini-call.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule] // Add CommonModule and IonicModule
})
export class MiniCallComponent implements OnInit, OnDestroy {
  isVisible: boolean = false;
  callState: string = 'idle';
  counsellorName: string = '';
  bookingId: number | null = null;

  private subscriptions: Subscription[] = [];

  constructor(
    private miniCallService: MiniCallService,
    private webrtcService: WebrtcService,
    private router: Router
  ) { }

  ngOnInit() {
    this.subscriptions.push(
      this.miniCallService.isMiniUiVisible$.subscribe(visible => {
        this.isVisible = visible;
      }),
      this.miniCallService.callInfo$.subscribe(info => {
        if (info) {
          this.counsellorName = info.counsellorName;
          this.bookingId = info.bookingId;
        }
      }),
      this.webrtcService.getCallStateObservable().subscribe(state => {
        this.callState = state;
        if (state === 'ended' || state === 'failed' || state === 'disconnected') {
          this.miniCallService.hideMiniUi();
        } else if (this.isVisible) { // Only update if mini-UI is already visible
          this.miniCallService.updateCallInfo({
            counsellorName: this.counsellorName,
            bookingId: this.bookingId,
            callState: state // Pass the current call state
          });
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  goToCall() {
    // Navigate back to the full call page
    this.router.navigate(['/call'], { state: { bookingId: this.bookingId } });
    this.miniCallService.hideMiniUi();
  }

  endCall() {
    this.webrtcService.endCall();
    this.miniCallService.hideMiniUi();
  }

  get callStateText(): string {
    switch (this.callState) {
      case 'ringing': return 'Calling...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'In Call';
      case 'disconnected': return 'Disconnected';
      case 'ended': return 'Ended';
      case 'failed': return 'Failed';
      default: return 'Call';
    }
  }
}
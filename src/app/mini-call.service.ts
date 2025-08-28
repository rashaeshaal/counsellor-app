import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MiniCallService {
  private isMiniUiVisibleSubject = new BehaviorSubject<boolean>(false);
  private callInfoSubject = new BehaviorSubject<any>(null); // Holds bookingId, counsellorName, callState

  isMiniUiVisible$: Observable<boolean> = this.isMiniUiVisibleSubject.asObservable();
  callInfo$: Observable<any> = this.callInfoSubject.asObservable();

  constructor() { }

  showMiniUi(callInfo: any) {
    this.callInfoSubject.next(callInfo);
    this.isMiniUiVisibleSubject.next(true);
  }

  hideMiniUi() {
    this.isMiniUiVisibleSubject.next(false);
    this.callInfoSubject.next(null);
  }

  updateCallInfo(callInfo: any) {
    this.callInfoSubject.next(callInfo);
  }
}
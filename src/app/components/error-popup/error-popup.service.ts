import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ErrorPopupService {
  private showPopupSource = new Subject<string>();
  private hidePopupSource = new Subject<void>();

  showPopup$ = this.showPopupSource.asObservable();
  hidePopup$ = this.hidePopupSource.asObservable();

  show(message: string) {
    this.showPopupSource.next(message);
  }

  hide() {
    this.hidePopupSource.next();
  }
}

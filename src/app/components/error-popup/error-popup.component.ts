import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ErrorPopupService } from './error-popup.service';

@Component({
  selector: 'app-error-popup',
  templateUrl: './error-popup.component.html',
  styleUrls: ['./error-popup.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class ErrorPopupComponent {
  show = false;
  message = '';

  constructor(private errorPopupService: ErrorPopupService) {
    this.errorPopupService.showPopup$.subscribe((message) => {
      this.message = message;
      this.show = true;
    });

    this.errorPopupService.hidePopup$.subscribe(() => {
      this.show = false;
    });
  }

  hidePopup() {
    this.errorPopupService.hide();
  }
}

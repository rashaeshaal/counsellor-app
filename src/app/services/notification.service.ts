import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ToastController } from '@ionic/angular';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';

interface NotificationMessage {
  title: string;
  message: string;
  type?: 'incoming_call' | 'general'; // Add type to differentiate
  bookingId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notificationCount = new BehaviorSubject<number>(0);
  notificationCount$ = this.notificationCount.asObservable();
  private newMessageSubject = new Subject<NotificationMessage>();
  newMessage$ = this.newMessageSubject.asObservable();

  constructor(private http: HttpClient, private toastCtrl: ToastController) { }

  notifyIncomingCall(bookingId: number, userName: string) {
    this.newMessageSubject.next({
      title: 'Incoming Call',
      message: `Call from ${userName}`,
      type: 'incoming_call',
      bookingId: bookingId
    });
  }

  notifyGeneralMessage(title: string, message: string) {
    this.newMessageSubject.next({
      title: title,
      message: message,
      type: 'general'
    });
  }

  async showNotification(title: string, message: string) {
    const toast = await this.toastCtrl.create({
      header: title,
      message: message,
      duration: 5000,
      position: 'top',
      buttons: [
        {
          text: 'View',
          handler: () => {
            // Navigate to notifications page
            window.location.href = '/counsellor-notifications';
          }
        }
      ]
    });
    toast.present();
  }
}

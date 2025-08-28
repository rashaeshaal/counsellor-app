import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-home-footer',
  templateUrl: './home-footer.component.html',
  styleUrls: ['./home-footer.component.scss'],
  standalone: false,
})
export class HomeFooterComponent  implements OnInit {

  notificationCount = 0;

  constructor(private http: HttpClient, private router: Router, private toastCtrl: ToastController) {}

  ngOnInit() {
    
  }

  startPolling() {
    setInterval(() => {
      
    }, 5000); // Poll every 5 seconds
  }

 

  async showNotification(request: any) {
    const toast = await this.toastCtrl.create({
      header: 'New Call Request',
      message: `From: ${request.user.phone_number}`,
      duration: 5000,
      position: 'top',
      buttons: [
        {
          text: 'View',
          handler: () => {
            this.navigateTo('/counsellor-notifications');
          }
        }
      ]
    });
    toast.present();
  }

  navigateTo(page: string) {
    this.router.navigateByUrl(page);
  }
}

import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpHeaders, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';
import { IonicModule, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, HttpClientModule]
})
export class WalletComponent implements OnInit {

  wallet: { balance: number } = { balance: 0 };

  constructor(
    private http: HttpClient,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadWalletDetails();
  }

  loadWalletDetails() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    this.http.get(`${environment.apiUrl}/api/user/wallet/extra_minutes/`, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('Extra minutes response:', response);
          if (response.extra_minutes !== undefined) {
            this.wallet.balance = response.extra_minutes;
            this.showToast('Extra minutes loaded successfully', 'success');
          }
        },
        error: (error) => {
          console.error('Error fetching extra minutes:', error);
          this.showToast('Failed to load extra minutes', 'danger');
        }
      });
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
}

// Ensure you have a model for your wallet for better type safety
export interface Wallet {
  balance: number;
}
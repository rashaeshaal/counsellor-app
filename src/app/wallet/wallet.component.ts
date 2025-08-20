import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
  standalone: false,
})
export class WalletComponent implements OnInit, OnDestroy { // Added OnDestroy

  wallet: { balance: number } = { balance: 0 };
  transactions: any[] = [];
  private subscriptions: Subscription[] = [];

  constructor(
    private http: HttpClient,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadWalletDetails();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadWalletDetails() {
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`
    });

    const walletSub = this.http.get(`${environment.apiUrl}/api/dashboard/wallet/`, { headers })
      .subscribe({
        next: (response: any) => {
          console.log('Wallet details response:', response);
          this.wallet = response.wallet;
          this.transactions = response.transactions;
          this.showToast('Wallet details loaded successfully', 'success');
        },
        error: (error) => {
          console.error('Error fetching wallet details:', error);
          this.showToast('Failed to load wallet details', 'danger');
        }
      });

    this.subscriptions.push(walletSub);
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

  // Helper to format transaction date
  formatDate(date: string): string {
    return new Date(date).toLocaleString();
  }

  // Helper to get transaction type display
  getTransactionType(type: string): string {
    switch (type) {
      case 'DEPOSIT': return 'Deposit';
      case 'TRANSFER': return 'Transfer to Counsellor';
      case 'WITHDRAWAL': return 'Withdrawal';
      default: return type;
    }
  }
}
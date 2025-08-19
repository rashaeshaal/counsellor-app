import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-view-counsellor-profile',
  templateUrl: './view-counsellor-profile.component.html',
  styleUrls: ['./view-counsellor-profile.component.scss'],
  standalone: false,

})
export class ViewCounsellorProfileComponent  implements OnInit {
  counsellorId: string | null = null;
  counsellor: any;
  isLoading = false;
  apiUrl: string = environment.apiUrl;

  constructor(
    private activatedRoute: ActivatedRoute,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private router: Router
  ) { }

  ngOnInit() {
    this.counsellorId = this.activatedRoute.snapshot.paramMap.get('id');
    if (this.counsellorId) {
      this.loadCounsellorProfile(this.counsellorId);
    } else {
      this.showToast('Counsellor ID not provided.', 'danger');
      this.router.navigate(['/user-dashboard']);
    }
  }

  async loadCounsellorProfile(id: string) {
    try {
      await this.showLoader('Loading counsellor profile...');
      const response: any = await this.http
        .get(`${environment.apiUrl}/api/dashboard/counsellors/${id}/`)
        .toPromise();
      this.counsellor = response;
      await this.hideLoader();
    } catch (error) {
      await this.hideLoader();
      console.error('Error loading counsellor profile:', error);
      this.showToast('Failed to load counsellor profile.', 'danger');
      this.router.navigate(['/user-dashboard']);
    }
  }

  async showLoader(msg: string) {
    this.isLoading = true;
    const loader = await this.loadingCtrl.create({
      message: msg,
      spinner: 'bubbles',
    });
    await loader.present();
    return loader;
  }

  async hideLoader() {
    this.isLoading = false;
    await this.loadingCtrl.dismiss();
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
  goBack() {
  this.router.navigate(['/user-dashboard']);
}

  bookSession() {
    console.log('Booking counsellor:', this.counsellor);
    if (!this.counsellor || !this.counsellor.id) {
      console.error('Counsellor ID missing:', this.counsellor);
      this.showToast('Invalid counsellor data.', 'danger');
      return;
    }
    this.router.navigate(['/checkout'], { state: { counsellor: this.counsellor } });
  }
}
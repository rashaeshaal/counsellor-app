import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { NavController, Platform, ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { App } from '@capacitor/app';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  footerType: 'home' | 'counsellor' | 'none' = 'none';
  lastBackPressTime = 0;

  constructor(
    private platform: Platform,
    private router: Router,
    private toastCtrl: ToastController,
    private authService: AuthService
    ) {
    this.initializeApp();
  }

  ngOnInit() {
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      if (event.url === '/counsellor-dashboard' || event.url.startsWith('/counsellor-profile/') || event.url.startsWith('/counsellor-call')) {
        this.footerType = 'counsellor';
      } else if ([ '/counsellor-login', '/counsellor-register', '/', '/user-page'].includes(event.url)) {
        this.footerType = 'none';
      } else {
        this.footerType = 'home';
      }
    });
  }

  initializeApp() {
    this.platform.ready().then(() => {
      console.log('Platform ready');

      // Check for last dashboard and navigate
      const accessToken = this.authService.getToken();
      if (accessToken) { // Only try to redirect if user is logged in
        const lastDashboard = this.authService.getLastDashboard();
        if (lastDashboard === 'user') {
          this.router.navigateByUrl('/user-dashboard');
        } else if (lastDashboard === 'counsellor') {
          this.router.navigateByUrl('/counsellor-dashboard');
        }
      }

      this.platform.backButton.subscribeWithPriority(10, async () => {
        console.log('Back button pressed. Current URL:', this.router.url);
        if (this.router.url === '/counsellor-dashboard') {
          if (Date.now() - this.lastBackPressTime < 2000) {
            App.exitApp();
          } else {
            this.lastBackPressTime = Date.now();
            const toast = await this.toastCtrl.create({
              message: 'Press back again to exit.',
              duration: 2000,
              position: 'bottom'
            });
            toast.present();
          }
        } else {
          this.router.navigateByUrl('/counsellor-dashboard');
        }
      });
    });
  }
}
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component } from '@angular/core';
import { NavController, Platform } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  footerType: 'home' | 'counsellor' | 'none' = 'home';

  constructor(
    private platform: Platform,
    private router: Router
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
    });
  }
}
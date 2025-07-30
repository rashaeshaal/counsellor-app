import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-home-footer',
  templateUrl: './home-footer.component.html',
  styleUrls: ['./home-footer.component.scss'],
  standalone: false,
})
export class HomeFooterComponent  implements OnInit {

  constructor(private http: HttpClient, private navCtrl: NavController) {}

  ngOnInit() {
    console.log('HomeFooterComponent: Initialized');
  }

  navigateTo(page: string) {
    console.log('HomeFooterComponent: Navigating to:', page);
    this.navCtrl.navigateForward(page).then(success => {
      console.log('HomeFooterComponent: Navigation to', page, success ? 'Successful' : 'Failed');
    }).catch(error => {
      console.error('HomeFooterComponent: Navigation error:', error);
    });
  }
}

import { Component } from '@angular/core';
import { NavController } from '@ionic/angular';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {

  constructor(private navCtrl: NavController) {}

  goToUserHelp() {
    this.navCtrl.navigateForward('/user-page');
  }

  goToCounsellorRegister() {
    this.navCtrl.navigateForward('/counsellor-login');
  }
}
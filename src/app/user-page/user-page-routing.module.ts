import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserPagePage } from './user-page.page';
import { UserRegistrationComponent } from './user-registration/user-registration.component';
import { IonicModule } from '@ionic/angular';

const routes: Routes = [
  {
    path: '',
    component: UserPagePage
  },
  {
    path: 'user-registration',
    component: UserRegistrationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes),IonicModule],
  exports: [RouterModule],
})
export class UserPagePageRoutingModule {}

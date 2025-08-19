import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UserPagePage } from './user-page.page';
import { UserRegistrationComponent } from './user-registration/user-registration.component';
import { OtpComponent } from './otp/otp.component';
import { IonicModule } from '@ionic/angular';

const routes: Routes = [
  {
    path: '',
    component: UserPagePage,
    children: [
      
      {
        path: 'otp',
        component: OtpComponent,
        data: {
          canContinue: false
        }
      },
    
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes), IonicModule],
  exports: [RouterModule],
})
export class UserPagePageRoutingModule {}

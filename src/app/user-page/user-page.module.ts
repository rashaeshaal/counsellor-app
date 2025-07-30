import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserPagePageRoutingModule } from './user-page-routing.module';

import { UserPagePage } from './user-page.page';

import { NgOtpInputModule } from 'ng-otp-input';
import { OtpComponent } from './otp/otp.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserPagePageRoutingModule,
    NgOtpInputModule,
    ReactiveFormsModule
  ],
  declarations: [UserPagePage, OtpComponent]
})
export class UserPagePageModule {}

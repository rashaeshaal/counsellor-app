import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserPagePageRoutingModule } from './user-page-routing.module';

import { UserPagePage } from './user-page.page';
import { OtpComponent } from './otp/otp.component';
import { UserRegistrationComponent } from './user-registration/user-registration.component';
import { NgOtpInputModule } from 'ng-otp-input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UserPagePageRoutingModule,
    NgOtpInputModule,
    ReactiveFormsModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule

  ],
  exports: [
    IonicModule
  ],
  declarations: [UserPagePage, OtpComponent, UserRegistrationComponent]
})
export class UserPagePageModule {}

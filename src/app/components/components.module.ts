import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

import { CounsellorCallComponent } from './counsellor-call/counsellor-call.component';
import { CounsellorDashboardComponent } from './counsellor-dashboard/counsellor-dashboard.component';
import { CounsellorNotificationsComponent } from './counsellor-notifications/counsellor-notifications.component';
import { CounsellorProfileComponent } from './counsellor-profile/counsellor-profile.component';
import { UserDashboardComponent } from './user-dashboard/user-dashboard.component';
import { UserNotificationsComponent } from './user-notifications/user-notifications.component';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { ViewCounsellorProfileComponent } from './view-counsellor-profile/view-counsellor-profile.component';

const components = [
  CounsellorCallComponent,
  CounsellorDashboardComponent,
  CounsellorNotificationsComponent,
  CounsellorProfileComponent,
  UserDashboardComponent,
  UserNotificationsComponent,
  UserProfileComponent,
  ViewCounsellorProfileComponent,
];

@NgModule({
  declarations: [...components],
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ],
  exports: [...components]
})
export class ComponentsModule { }

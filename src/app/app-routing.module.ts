import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { HomePage } from './home/home.page';
import { CounsellorRegisterComponent } from './counsellor/counsellor-register/counsellor-register.component';
import { CounsellorDashboardComponent } from './components/counsellor-dashboard/counsellor-dashboard.component';
import { CounsellorProfileComponent } from './components/counsellor-profile/counsellor-profile.component';
import { CounsellorNotificationsComponent } from './components/counsellor-notifications/counsellor-notifications.component';
import { CounsellorCallComponent } from './components/counsellor-call/counsellor-call.component';
import { FooterComponent } from './footer/footer.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { UserNotificationsComponent } from './components/user-notifications/user-notifications.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { CounsellorPaymentSettingsComponent } from './counsellor-payment-settings/counsellor-payment-settings.component';
import { CounsellorLoginComponent } from './counsellor/counsellor-login/counsellor-login.component';
import { CallComponent } from './user-dashboard/call/call.component';
import { WalletComponent } from './wallet/wallet.component';
import { ProblemSelectionComponent } from './problem-selection/problem-selection.component';
import { UserRegistrationComponent } from './user-page/user-registration/user-registration.component';
const routes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomePageModule),
  },
  {
    path: 'user-page',
    loadChildren: () => import('./user-page/user-page.module').then( m => m.UserPagePageModule)
  },
  { path: 'counsellor-register', component: CounsellorRegisterComponent },
  { path: 'counsellor-dashboard',component: CounsellorDashboardComponent},
  { path: 'counsellor-profile', component: CounsellorProfileComponent },
  { path: 'counsellor-notifications', component: CounsellorNotificationsComponent },
  { path: 'counsellor-call', component: CounsellorCallComponent },
  { path: 'user-profile', component: UserProfileComponent },
  { path: 'user-notifications', component: UserNotificationsComponent },
  { path: 'user-dashboard', component: UserDashboardComponent },
  { path: 'checkout', component: CheckoutComponent },
  { path: 'counsellor-payment-settings', component: CounsellorPaymentSettingsComponent },
  { path: 'counsellor-login', component: CounsellorLoginComponent },
  { path: 'call', component: CallComponent },
  { path: 'wallet', component: WalletComponent },
  { path: 'problem-selection', component: ProblemSelectionComponent },
  { path: 'user-registeration', component: UserRegistrationComponent }
  
];


@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }

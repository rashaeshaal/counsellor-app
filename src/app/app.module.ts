import { Injector, NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgOtpInputModule } from 'ng-otp-input';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { environment } from '../environments/environment';
import { initializeApp,provideFirebaseApp } from '@angular/fire/app';

import { provideAuth,getAuth } from '@angular/fire/auth';
import { provideFirestore,getFirestore } from '@angular/fire/firestore';

import { SocketIoModule, SocketIoConfig } from 'ngx-socket-io';
import { CounsellorProfileComponent } from './components/counsellor-profile/counsellor-profile.component';
import { CounsellorNotificationsComponent } from './components/counsellor-notifications/counsellor-notifications.component';
import { CounsellorCallComponent } from './components/counsellor-call/counsellor-call.component';
import { CommonModule } from '@angular/common';
import { CounsellorDashboardComponent } from './components/counsellor-dashboard/counsellor-dashboard.component';
import { FooterComponent } from './footer/footer.component';
import { HomeFooterComponent } from './home-footer/home-footer.component';
import { UserProfileComponent } from './components/user-profile/user-profile.component';
import { UserNotificationsComponent } from './components/user-notifications/user-notifications.component';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard.component';
import { CounsellorPaymentSettingsComponent } from './counsellor-payment-settings/counsellor-payment-settings.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthInterceptor } from './auth.interceptor';
import { CounsellorLoginComponent } from './counsellor/counsellor-login/counsellor-login.component';
import { CallComponent } from './user-dashboard/call/call.component';
import { AuthService } from './services/auth.service';
import { CounsellorRegisterComponent } from './counsellor/counsellor-register/counsellor-register.component';
import { ProblemSelectionComponent } from './problem-selection/problem-selection.component';


import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ViewCounsellorProfileComponent } from './components/view-counsellor-profile/view-counsellor-profile.component';


export function authInterceptor() {
  return (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      const cloned = req.clone({
        setHeaders: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      return next(cloned);
    }
    return next(req);
  };
}
export function socketIoConfigFactory(authService: AuthService): SocketIoConfig {
  return {
    url: environment.wsUrl,
    options: {
      extraHeaders: {
        Authorization: `Bearer ${authService.getToken() || ''}`
      }
    }
  };
}
let appInjector: Injector;
@NgModule({
  declarations: [AppComponent,
    CounsellorNotificationsComponent,
    CounsellorProfileComponent,
    CounsellorDashboardComponent,
    FooterComponent,
    UserProfileComponent,
    UserNotificationsComponent,
    UserDashboardComponent,
    CounsellorPaymentSettingsComponent,
    CounsellorLoginComponent,
    CheckoutComponent,
    CounsellorCallComponent,
    CallComponent,
    CounsellorRegisterComponent,
    ViewCounsellorProfileComponent,
    HomeFooterComponent,
    ],
  imports: [
    BrowserModule,
    IonicModule.forRoot(),
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    NgOtpInputModule,
    HttpClientModule,
    CommonModule,
    SocketIoModule,
    ProblemSelectionComponent,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    BrowserAnimationsModule,

   
  ],
  providers: [
    AuthService,
 
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()), // Ensures Auth is available for injection
    provideFirestore(() => getFirestore())
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}

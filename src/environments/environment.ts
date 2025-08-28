// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

import { a } from "@angular/material/ripple.d-BT30YVLB";

export const environment = {
  production: false, 
  wsUrl: 'wss://counsellor-backend-13.onrender.com',
  apiUrl: 'https://counsellor-backend-13.onrender.com', // Update with your API URL
  // wsUrl: 'wss://localhost:8000',
  // apiUrl: 'http://localhost:8000',
  firebase: {
    apiKey: "AIzaSyAenoNfxm6XyIWrad5hocYwKTlqO3roKa8",
    authDomain: "counsellor-7cb91.firebaseapp.com",
    projectId: "counsellor-7cb91",
    storageBucket: "counsellor-7cb91.firebasestorage.app",
    messagingSenderId: "730488533133",
    appId: "1:730488533133:web:460a308720d9ef2dfd32c4",
    measurementId: "G-BSHZWL5NNY"
}
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.


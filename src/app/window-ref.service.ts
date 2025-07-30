import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class WindowRefService {

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  get nativeWindow(): any {
    if (isPlatformBrowser(this.platformId)) {
      return window;
    }
    return null;
  }
}
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-profile',
  templateUrl: './counsellor-profile.component.html',
  styleUrls: ['./counsellor-profile.component.scss'],
  standalone: false,
})
export class CounsellorProfileComponent implements OnInit {
  profileForm: FormGroup;
  isLoading = false;
  profilePhotoUrl: string | null = null;
  selectedPhoto: File | null = null;
  isEditMode = false;

  genderOptions = [
    { value: 'M', label: 'Male' },
    { value: 'F', label: 'Female' },
    { value: 'O', label: 'Other' },
  ];

  @ViewChild('photoInput') photoInput!: ElementRef;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    public router: Router
  ) {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      age: ['', [Validators.required, Validators.min(18), Validators.max(100)]],
      email: ['', [Validators.required, Validators.email]],
      gender: ['', Validators.required],
      phone_number: ['', [Validators.required, Validators.pattern(/^\+?1?\d{9,15}$/)]],
      qualification: ['', [Validators.required, Validators.maxLength(500)]],
      experience: ['', [Validators.required, Validators.min(0)]],
      google_pay_number: ['', [Validators.required, Validators.pattern(/^\+?1?\d{9,15}$/)]],
      account_number: ['', [Validators.required, Validators.pattern(/^\d{9,20}$/)]],
      ifsc_code: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
      profile_photo: [null],
      is_active: [false],
      is_approved: [false],
    });
  }

  ngOnInit() {
    this.loadProfile();
  }

  // Public method for navigation
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    if (this.isEditMode) {
      this.loadProfile();
    } else {
      this.loadProfile(); // Reload profile to reset form if cancelled
    }
  }

  getGenderLabel(): string {
    const genderValue = this.profileForm.get('gender')?.value;
    const foundOption = this.genderOptions.find(option => option.value === genderValue);
    return foundOption ? foundOption.label : genderValue;
  }

  async loadProfile() {
    let accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.showToast('Please log in to view profile.', 'danger');
      this.router.navigate(['/login']);
      return;
    }
    try {
      await this.showLoader('Loading profile...');
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      });
      const response: any = await this.http
        .get(`${environment.apiUrl}/api/counsellor/profile/`, { headers })
        .toPromise();
      this.profileForm.patchValue(response.counsellor);
      this.profilePhotoUrl = response.counsellor.profile_photo
        ? `${environment.apiUrl}${response.counsellor.profile_photo}`
        : null;
      await this.hideLoader();
    } catch (error: any) {
      await this.hideLoader();
      if (error.status === 401) {
        accessToken = await this.refreshToken();
        if (accessToken) {
          try {
            const headers = new HttpHeaders({
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            });
            const response: any = await this.http
              .get(`${environment.apiUrl}/api/counsellor/profile/`, { headers })
              .toPromise();
            this.profileForm.patchValue(response.counsellor);
            this.profilePhotoUrl = response.counsellor.profile_photo
              ? `${environment.apiUrl}${response.counsellor.profile_photo}`
              : null;
            await this.hideLoader();
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            this.showToast('Session expired. Please log in again.', 'danger');
            this.router.navigate(['/login']);
          }
        } else {
          this.showToast('Session expired. Please log in again.', 'danger');
          this.router.navigate(['/login']);
        }
      } else {
        this.showToast('Error loading profile: ' + (error.error?.detail || 'Unknown error'), 'danger');
        console.error('Load profile error:', error);
      }
    }
  }

  selectPhoto() {
    this.photoInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedPhoto = input.files[0];
      console.log('Selected photo:', this.selectedPhoto);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePhotoUrl = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedPhoto);
    }
  }

  async showLoader(msg: string) {
    this.isLoading = true;
    const loader = await this.loadingCtrl.create({
      message: msg,
      spinner: 'bubbles',
    });
    await loader.present();
    return loader;
  }

  async hideLoader() {
    this.isLoading = false;
    await this.loadingCtrl.dismiss();
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  async refreshToken(): Promise<string | null> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.showToast('Session expired. Please log in again.', 'danger');
      this.router.navigate(['/login']);
      return null;
    }
    try {
      const response: any = await this.http
        .post(`${environment.apiUrl}/api/token/refresh/`, { refresh: refreshToken })
        .toPromise();
      const newAccessToken = response.access;
      localStorage.setItem('access_token', newAccessToken);
      console.log('Token refreshed:', newAccessToken);
      return newAccessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.showToast('Session expired. Please log in again.', 'danger');
      this.router.navigate(['/login']);
      return null;
    }
  }

  async onSubmit() {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Please fill all required fields correctly', 'danger');
      return;
    }

    let accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.showToast('Please log in to update profile.', 'danger');
      this.router.navigate(['/login']);
      return;
    }

    try {
      await this.showLoader('Updating profile...');
      const formData = new FormData();
      const fields = this.profileForm.value;
      fields.phone_number = fields.phone_number.startsWith('+') ? fields.phone_number : `+91${fields.phone_number}`;
      fields.google_pay_number = fields.google_pay_number.startsWith('+')
        ? fields.google_pay_number
        : `+91${fields.google_pay_number}`;
      fields.ifsc_code = fields.ifsc_code.toUpperCase();

      // Exclude read-only fields
      const editableFields = { ...fields };
      delete editableFields.is_active;
      delete editableFields.is_approved;
      delete editableFields.profile_photo; // Do not send the photo URL

      for (const key in editableFields) {
        if (editableFields[key] !== null && editableFields[key] !== undefined) {
          formData.append(key, editableFields[key]);
        }
      }

      if (this.selectedPhoto) {
        console.log('Appending profile_photo:', this.selectedPhoto);
        formData.append('profile_photo', this.selectedPhoto);
      } else {
        console.log('No profile photo selected');
      }

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${accessToken}`
      });
      const response = await this.http
        .put(`${environment.apiUrl}/api/counsellor/profile/`, formData, { headers })
        .toPromise();
      await this.hideLoader();
      this.showToast('Profile updated successfully');
      this.isEditMode = false; // Exit edit mode on successful save
      this.loadProfile(); // Refresh profile data
    } catch (error: any) {
      await this.hideLoader();
      if (error.status === 401) {
        accessToken = await this.refreshToken();
        if (accessToken) {
          try {
            const retryFormData = new FormData();
            const fields = this.profileForm.value;
            fields.phone_number = fields.phone_number.startsWith('+') ? fields.phone_number : `+91${fields.phone_number}`;
            fields.google_pay_number = fields.google_pay_number.startsWith('+')
              ? fields.google_pay_number
              : `+91${fields.google_pay_number}`;
            fields.ifsc_code = fields.ifsc_code.toUpperCase();

            const retryEditableFields = { ...fields };
            delete retryEditableFields.is_active;
            delete retryEditableFields.is_approved;
            delete retryEditableFields.profile_photo; // Do not send the photo URL

            for (const key in retryEditableFields) {
              if (retryEditableFields[key] !== null && retryEditableFields[key] !== undefined) {
                retryFormData.append(key, retryEditableFields[key]);
              }
            }

            if (this.selectedPhoto) {
              retryFormData.append('profile_photo', this.selectedPhoto);
            }

            const headers = new HttpHeaders({
              'Authorization': `Bearer ${accessToken}`
            });
            const response = await this.http
              .put(`${environment.apiUrl}/api/counsellor/profile/`, retryFormData, { headers })
              .toPromise();
            await this.hideLoader();
            this.showToast('Profile updated successfully');
            this.isEditMode = false; // Exit edit mode on successful save
            this.loadProfile(); // Refresh profile data
          } catch (retryError) {
            console.error('Retry failed:', retryError);
            this.showToast('Session expired. Please log in again.', 'danger');
            this.router.navigate(['/login']);
          }
        } else {
          this.showToast('Session expired. Please log in again.', 'danger');
          this.router.navigate(['/login']);
        }
      } else {
        const errorMsg = error.error?.detail || error.error?.profile_photo?.[0] || 'Failed to update profile';
        this.showToast(errorMsg, 'danger');
        console.error('Update profile error:', error);
      }
    }
  }
}
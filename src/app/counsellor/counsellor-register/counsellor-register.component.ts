import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-counsellor-register',
  templateUrl: './counsellor-register.component.html',
  styleUrls: ['./counsellor-register.component.scss'],
  standalone: false
})
export class CounsellorRegisterComponent  implements OnInit {

  counsellorForm: FormGroup;
  isLoading = false;
  profilePhotoUrl: string | null = null;
  selectedPhoto: File | null = null;
  showSuccessMessage = false;

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
    private router: Router
  ) {
    this.counsellorForm = this.fb.group({
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
    });
  }

  ngOnInit() {}

  selectPhoto() {
    this.photoInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedPhoto = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePhotoUrl = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedPhoto);
    }
  }

  getProgressPercentage(): number {
    const controls = this.counsellorForm.controls;
    const totalFields = Object.keys(controls).length;
    const filledFields = Object.values(controls).filter(control => control.value && control.valid).length;
    return (filledFields / totalFields) * 100;
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

  async onSubmit() {
    if (!this.counsellorForm.valid) {
      this.counsellorForm.markAllAsTouched();
      this.showToast('Please fill all required fields correctly', 'danger');
      return;
    }

    try {
      await this.showLoader('Registering counsellor...');

      const formData = new FormData();
      const fields = this.counsellorForm.value;
      fields.phone_number = fields.phone_number.startsWith('+') ? fields.phone_number : `+91${fields.phone_number}`;
      fields.google_pay_number = fields.google_pay_number.startsWith('+') ? 
        fields.google_pay_number : `+91${fields.google_pay_number}`;
      fields.ifsc_code = fields.ifsc_code.toUpperCase();

      for (const key in fields) {
        if (fields[key] !== null && fields[key] !== undefined) {
          formData.append(key, fields[key]);
        }
      }

      if (this.selectedPhoto) {
        formData.append('profile_photo', this.selectedPhoto);
      }

      interface RegisterResponse {
        access: string;
        refresh: string;
        [key: string]: any;
      }

      const response = await this.http
        .post<RegisterResponse>(`${environment.apiUrl}/api/auth/counsellor/register/`, formData)
        .toPromise();

      console.log('Registration response:', response); // Debug log

      await this.hideLoader();
      this.showSuccessMessage = true;
      this.showToast('Counsellor registered successfully.');
      
      if (response && response.access && response.refresh) {
        localStorage.setItem('access_token', response.access);
        localStorage.setItem('refresh_token', response.refresh);
        console.log('Tokens stored:', { access: response.access, refresh: response.refresh }); // Debug log
      } else {
        console.error('No tokens in response:', response);
        this.showToast('Registration successful but no tokens received', 'warning');
      }

      setTimeout(() => {
        this.counsellorForm.reset();
        this.profilePhotoUrl = null;
        this.selectedPhoto = null;
        this.showSuccessMessage = false;
        console.log('Navigating to /counsellor-dashboard'); // Debug log
        this.router.navigate(['/counsellor-dashboard']).then(success => {
          console.log('Navigation to /counsellor-dashboard:', success ? 'Successful' : 'Failed'); // Debug log
        });
      }, 2000);
    } catch (e: any) {
      await this.hideLoader();
      const errorMsg = e.error?.error || 'Failed to register counsellor';
      console.error('Registration error:', e); // Debug log
      this.showToast(errorMsg, 'danger');
    }
  }
}
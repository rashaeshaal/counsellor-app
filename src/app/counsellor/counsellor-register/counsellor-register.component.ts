import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LoadingController, ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-counsellor-register',
  templateUrl: './counsellor-register.component.html',
  styleUrls: ['./counsellor-register.component.scss'],
  standalone: false,
})
export class CounsellorRegisterComponent implements OnInit {
  counsellorForm: FormGroup;
  isLoading = false;
  profilePhotoUrl: string | null = null;
  selectedPhoto: File | null = null;
  showSuccessMessage = false;
  showErrorMessage = false;
  errorMessage = '';

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
      phone_number: ['', [Validators.required, Validators.pattern(/^\+?\d{10,15}$/)]],
      qualification: ['', [Validators.required, Validators.maxLength(500)]],
      experience: ['', [Validators.required, Validators.min(0)]],
      google_pay_number: ['', [Validators.required, Validators.pattern(/^\+?\d{10,15}$/)]],
      account_number: ['', [Validators.required, Validators.pattern(/^\d{9,20}$/)]],
      ifsc_code: ['', [Validators.required, Validators.pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/)]],
      profile_photo: [null],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm_password: ['', Validators.required]
    }, {
      validator: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirm_password');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
    } else {
      if (confirmPassword) {
        confirmPassword.setErrors(null);
      }
    }
    return null;
  }

  ngOnInit() {}

  selectPhoto() {
    this.photoInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        this.showToast('Profile photo must be less than 5MB.', 'danger');
        return;
      }
      this.selectedPhoto = file;
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
    const filledFields = Object.values(controls).filter(
      (control) => control.value && control.valid
    ).length;
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
      buttons: [
        {
          text: 'Dismiss',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }

  async onSubmit() {
    if (!this.counsellorForm.valid) {
      this.counsellorForm.markAllAsTouched();
      await this.showToast('Please fill all required fields correctly.', 'danger');
      return;
    }

    try {
      await this.showLoader('Registering counsellor...');

      const formData = new FormData();
      const fields = this.counsellorForm.value;
      fields.phone_number = fields.phone_number.startsWith('+')
        ? fields.phone_number
        : `+91${fields.phone_number}`;
      fields.google_pay_number = fields.google_pay_number.startsWith('+')
        ? fields.google_pay_number
        : `+91${fields.google_pay_number}`;
      fields.ifsc_code = fields.ifsc_code.toUpperCase();

      for (const key in fields) {
        if (key !== 'confirm_password' && fields[key] !== null && fields[key] !== undefined) {
          formData.append(key, fields[key]);
        }
      }

      if (this.selectedPhoto) {
        formData.append('profile_photo', this.selectedPhoto);
      }

      interface RegisterResponse {
        access?: string;
        refresh?: string;
        message?: string;
        [key: string]: any;
      }

      const response = await this.http
        .post<RegisterResponse>(`${environment.apiUrl}/api/auth/counsellor/register/`, formData)
        .toPromise();

      await this.hideLoader();
      this.showSuccessMessage = true;
      await this.showToast(
        response?.message || 'Counsellor registered successfully. We’ll review your application soon.'
      );

      // Reset form and clear photo
      this.counsellorForm.reset();
      this.profilePhotoUrl = null;
      this.selectedPhoto = null;
      this.photoInput.nativeElement.value = '';

      // Hide success message after 5 seconds
      setTimeout(() => {
        this.showSuccessMessage = false;
        this.router.navigate(['/counsellor-login']);
      }, 5000);
    } catch (e: any) {
      await this.hideLoader();
      const errorMsg = e.error?.error || 'Failed to register counsellor. Please try again.';
      this.errorMessage = errorMsg;
      this.showErrorMessage = true;
      await this.showToast(errorMsg, 'danger');
      // Hide error message after 5 seconds
      setTimeout(() => {
        this.showErrorMessage = false;
      }, 5000);
    }
  }

  navigateToLogin() {
    this.router.navigate(['/counsellor-login']);
  }
}
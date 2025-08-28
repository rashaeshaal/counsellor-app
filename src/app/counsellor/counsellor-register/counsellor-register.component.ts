import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { LoadingController, ToastController, IonicModule, IonDatetime, IonModal } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { Router, RouterModule } from '@angular/router';

// Custom validator for age
function ageValidator(control: FormControl): { [key: string]: boolean } | null {
  if (control.value) {
    const today = new Date();
    const birthDate = new Date(control.value);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      return { 'ageInvalid': true };
    }
  }
  return null;
}

@Component({
  selector: 'app-counsellor-register',
  templateUrl: './counsellor-register.component.html',
  styleUrls: ['./counsellor-register.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, ReactiveFormsModule, HttpClientModule, RouterModule]
})
export class CounsellorRegisterComponent implements OnInit {
  counsellorForm: FormGroup;
  isLoading = false;
  profilePhotoUrl: string | null = null;
  selectedPhoto: File | null = null;
  maxDate!: string;
  showPassword = false;
  showConfirmPassword = false;
  

  @ViewChild('photoInput') photoInput!: ElementRef;
  @ViewChild('datePicker', { static: false }) datePicker!: IonDatetime;
  @ViewChild('dobModal') dobModal!: IonModal;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    this.counsellorForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      dob: ['', [Validators.required, ageValidator]],
      email: ['', [Validators.required, Validators.email]],
      phone_number: ['', [Validators.required, Validators.pattern(/^\+?\d{10,15}$/), Validators.maxLength(15)]],
      profile_photo: [null],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(10)]],
      confirm_password: ['', Validators.required]
    }, {
      validator: this.passwordMatchValidator
    });
  }

  ngOnInit() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const dd = String(today.getDate()).padStart(2, '0');
    this.maxDate = `${yyyy}-${mm}-${dd}`;
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

  onPhoneNumberInput(event: any) {
    const value = event.target.value;
    // a "+" sign is only allowed at the beginning of the input
    const sanitizedValue = value.replace(/[^+0-9]/g, ' ').replace(/(?!^)[+]/g, '');
    this.counsellorForm.controls['phone_number'].setValue(sanitizedValue, { emitEvent: false });
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  selectPhoto() {
    this.photoInput.nativeElement.click();
  }

  onPhotoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) { // 5MB
        this.showToast('Profile photo must be less than 5MB.', 'danger');
        return;
      }
      this.selectedPhoto = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.profilePhotoUrl = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  async openDobPicker() {
    if (this.dobModal) {
      await this.dobModal.present();
    }
  }

  

  onDateSelected(event: any) {
    const selectedDate = event.detail.value;
    if (selectedDate) {
      this.counsellorForm.controls['dob'].setValue(selectedDate);
      this.counsellorForm.controls['dob'].markAsTouched();
      if (this.dobModal) {
        this.dobModal.dismiss();
      }
      
    }
  }

  

  async onSubmit() {
    if (!this.counsellorForm.valid) {
      this.showToast('Please fill all the required fields correctly.', 'danger');
      return;
    }

    this.isLoading = true;
    const loader = await this.loadingCtrl.create({ message: 'Registering counsellor...' });
    await loader.present();

    const formData = new FormData();
    const formValue = this.counsellorForm.value;

    const today = new Date();
    const birthDate = new Date(formValue.dob);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    // Only append the fields that are part of the simplified form
    formData.append('name', formValue.name);
    formData.append('age', age.toString());
    formData.append('email', formValue.email);
    formData.append('phone_number', formValue.phone_number);
    formData.append('password', formValue.password);

    if (this.selectedPhoto) {
      formData.append('profile_photo', this.selectedPhoto, this.selectedPhoto.name);
    }

    try {
      const response = await this.http.post<any>(`${environment.apiUrl}/api/auth/counsellor/register/`, formData).toPromise();
      await loader.dismiss();
      this.isLoading = false;
      this.showToast(response?.message || 'Counsellor registered successfully. We’ll review your application soon.', 'success');
      this.router.navigate(['/counsellor-login']);
    } catch (error: any) {
      await loader.dismiss();
      this.isLoading = false;
      const errorMsg = error.error?.error || 'Failed to register counsellor. Please try again.';
      this.showToast(errorMsg, 'danger');
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  navigateToLogin() {
    this.router.navigate(['/counsellor-login']);
  }
}
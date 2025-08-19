import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
  standalone: false,
})
export class UserProfileComponent implements OnInit {
  user: any = null;
  loading: boolean = true;
  error: string = '';
  editMode: boolean = false;
  selectedFile: File | null = null;
  editableUser: any = {
    id: null,
    name: '',
    age: null,
    email: '',
    phone_number: '',
    profile_photo: '',
    user_role: '',
    total_sessions: 0
  };

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.loadUserProfile();
  }

  toggleEditMode() {
    console.log('toggleEditMode called - current editMode:', this.editMode);
    console.log('user data:', this.user);
    
    this.editMode = !this.editMode;
    console.log('Edit mode toggled to:', this.editMode);
    
    if (this.editMode && this.user) {
      // Create a proper copy with all fields initialized
      this.editableUser = {
        id: this.user.id || null,
        name: this.user.name || '',
        age: this.user.age || null,
        email: this.user.email || '',
        phone_number: this.user.phone_number || '',
        profile_photo: this.user.profile_photo || '',
        user_role: this.user.user_role || '',
        total_sessions: this.user.total_sessions || 0
      };
      console.log('Editable user data initialized:', this.editableUser);
      
      // Force change detection
      setTimeout(() => {
        console.log('After timeout - editableUser:', this.editableUser);
      }, 100);
    } else {
      // Reset selected file when cancelling edit
      this.selectedFile = null;
      console.log('Edit mode cancelled, file reset');
    }
  }

  onNameChange(event: any) {
    // Manual two-way binding for name
    this.editableUser.name = event.target.value;
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        this.showToast('Please select a valid image file', 'warning');
        return;
      }
      
      // Validate file size (e.g., max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        this.showToast('File size must be less than 5MB', 'warning');
        return;
      }
      
      this.selectedFile = file;
      
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.editableUser.profile_photo = e.target.result;
      };
      reader.readAsDataURL(file);
      
      console.log('File selected:', file.name);
    }
  }

  updateProfile() {
    console.log('updateProfile called with:', this.editableUser);

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      this.router.navigate(['/user-page']);
      return;
    }

    // Validate form data
    if (!this.editableUser.name?.trim()) {
      this.showToast('Name is required', 'warning');
      return;
    }

    if (!this.editableUser.email?.trim()) {
      this.showToast('Email is required', 'warning');
      return;
    }

    if (!this.editableUser.age || this.editableUser.age < 1) {
      this.showToast('Please enter a valid age', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('name', this.editableUser.name.trim());
    formData.append('age', String(this.editableUser.age));
    formData.append('email', this.editableUser.email.trim());
    if (this.editableUser.phone_number?.trim()) {
      formData.append('phone_number', this.editableUser.phone_number.trim());
    }
    if (this.selectedFile) {
      formData.append('profile_photo', this.selectedFile as Blob);
    }

    console.log('Submitting update payload: FormData', {
      name: this.editableUser.name,
      age: this.editableUser.age,
      email: this.editableUser.email,
      phone_number: this.editableUser.phone_number,
      hasFile: !!this.selectedFile
    });

    this.http
      .patch(`${environment.apiUrl}/api/dashboard/profile/`, formData)
      .subscribe({
        next: (response: any) => {
          console.log('Profile updated successfully:', response);
          this.user = response;

          if (this.user && this.user.profile_photo && !this.user.profile_photo.startsWith('http')) {
            this.user.profile_photo = `${environment.apiUrl}${this.user.profile_photo}`;
          }

          this.editMode = false;
          this.selectedFile = null;
          this.showToast('Profile updated successfully', 'success');
        },
        error: (error) => {
          console.error('Update profile error:', error);
          let errorMessage = 'Failed to update profile';

          if (error.status === 403) {
            errorMessage = error.error?.error || error.error?.detail || 'Access denied';
          } else if (error.status === 400) {
            errorMessage = error.error?.message || error.error?.detail || 'Invalid data provided';
          } else if (error.status === 413) {
            errorMessage = 'File too large';
          } else if (error.error?.detail) {
            errorMessage = error.error.detail;
          }

          this.error = `Error ${error.status}: ${errorMessage}`;
          this.showToast(this.error as string, 'danger');
        }
      });
  }

  loadUserProfile() {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      console.error('UserProfile: No access token found');
      this.error = 'No access token found';
      this.loading = false;
      this.router.navigate(['/user-page']);
      return;
    }

    console.log('UserProfile: Loading profile with token');
    this.http
      .get(`${environment.apiUrl}/api/dashboard/profile/`, {
        headers: new HttpHeaders({ 'Authorization': `Bearer ${accessToken}` })
      })
      .subscribe({
        next: (response: any) => {
          console.log('UserProfile response:', response);
          console.log('Profile photo URL received:', response.profile_photo);
          this.user = response;
          
          // Ensure profile photo URL is absolute
          if (this.user && this.user.profile_photo && !this.user.profile_photo.startsWith('http')) {
            this.user.profile_photo = `${environment.apiUrl}${this.user.profile_photo}`;
          }
          
          this.loading = false;
          this.error = '';
          
          // Initialize editableUser with loaded data
          this.editableUser = {
            id: this.user.id || null,
            name: this.user.name || '',
            age: this.user.age || null,
            email: this.user.email || '',
            phone_number: this.user.phone_number || '',
            profile_photo: this.user.profile_photo || '',
            user_role: this.user.user_role || '',
            total_sessions: this.user.total_sessions || 0
          };
          
          console.log('User data after loading:', this.user);
          console.log('EditableUser initialized:', this.editableUser);
        },
        error: (error) => {
          console.error('UserProfile error:', error);
          let errorMessage = 'Failed to load profile';
          
          if (error.status === 403) {
            errorMessage = error.error?.error || 'Access denied';
            this.router.navigate(['/login']);
          } else if (error.status === 401) {
            errorMessage = 'Session expired';
            this.router.navigate(['/login']);
          }
          
          this.error = errorMessage;
          this.loading = false;
          this.showToast(errorMessage, 'danger');
        }
      });
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning' = 'danger') {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top'
    });
    toast.present();
  }

  // Debug method to test form binding
  onInputChange(field: string, value: any) {
    console.log(`Field ${field} changed to:`, value);
    console.log('Current editableUser:', this.editableUser);
  }
}
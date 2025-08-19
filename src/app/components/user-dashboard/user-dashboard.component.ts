import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { environment } from 'src/environments/environment';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';

@Component({
  selector: 'app-user-dashboard',
  templateUrl: './user-dashboard.component.html',
  styleUrls: ['./user-dashboard.component.scss'],
  standalone: false,
})
export class UserDashboardComponent implements OnInit {
  user: any = { name: 'Guest' };
  counsellors: any[] = [];
  filteredCounsellors: any[] = [];
  searchQuery: string = '';
  activeFilter: string = 'all';

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastCtrl: ToastController,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit() {
    this.loadUserProfile();
    this.loadCounsellors();
  }

  async loadUserProfile() {
    this.http.get(`${environment.apiUrl}/api/dashboard/profile/`).subscribe({
      next: (response: any) => {
        console.log('UserDashboard profile response:', response);
        this.user = response.user;
      },
      error: (error) => {
        console.error('UserDashboard profile error:', error);
        this.showToast('Failed to load profile.', 'danger');
      },
    });
  }

  async loadCounsellors() {
    this.http.get(`${environment.apiUrl}/api/dashboard/counsellors/`).subscribe({
      next: (response: any) => {
        console.log('UserDashboard counsellors response:', response);
        this.counsellors = response;
        this.filteredCounsellors = [...this.counsellors];
        console.log('Counsellors array:', this.counsellors);
      },
      error: (error) => {
        console.error('UserDashboard counsellors error:', error);
        this.showToast('Failed to load counsellors.', 'danger');
      },
    });
  }

  handleSearch() {
    this.applyFilters();
  }

  filterByStatus(status: string) {
    this.activeFilter = status;
    this.applyFilters();
  }

  filterBySpecialty(specialty: string) {
    this.activeFilter = specialty;
    this.applyFilters();
  }

  applyFilters() {
    let filtered = [...this.counsellors];

    // Apply search filter
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (counsellor) =>
          counsellor.name.toLowerCase().includes(query) ||
          (counsellor.qualification &&
            counsellor.qualification.toLowerCase().includes(query))
      );
    }

    // Apply status/specialty filter
    if (this.activeFilter !== 'all') {
      if (this.activeFilter === 'online') {
        filtered = filtered.filter((counsellor) => counsellor.is_active);
      } else {
        // Simulate specialty filtering (since backend doesn't provide specialization)
        filtered = filtered.filter((counsellor) =>
          counsellor.qualification
            ? counsellor.qualification.toLowerCase().includes(this.activeFilter)
            : false
        );
      }
    }

    this.filteredCounsellors = filtered;
  }

  bookCounsellor(counsellor: any) {
    console.log('Booking counsellor:', counsellor);
    if (!counsellor.id) {
      console.error('Counsellor ID missing:', counsellor);
      this.showToast('Invalid counsellor data.', 'danger');
      return;
    }
    this.router.navigate(['/checkout'], { state: { counsellor } });
  }

  viewCounsellorProfile(counsellor: any) {
    console.log('Viewing counsellor profile:', counsellor.user_id);
    this.router.navigate(['/view-counsellor', counsellor.user_id]);
  }

  goHome() {
    this.router.navigate(['/']);
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
  getProfilePhotoStyle(photo: string): SafeStyle {
    if (photo) {
      const imageUrl = `url(${environment.apiUrl}${photo})`;
      console.log('Generated counsellor image URL:', imageUrl);
      return this.sanitizer.bypassSecurityTrustStyle(imageUrl);
    }
    return 'none';
  }

  getProfilePhotoSrc(photo: string): string {
    if (photo) {
      return `${environment.apiUrl}${photo}`;
    }
    return '';
  }
}
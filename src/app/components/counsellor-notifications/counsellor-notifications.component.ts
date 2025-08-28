import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-counsellor-notifications',
  templateUrl: './counsellor-notifications.component.html',
  styleUrls: ['./counsellor-notifications.component.scss'],
  standalone: false,
})
export class CounsellorNotificationsComponent  implements OnInit {

  callRequests: any[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    // Initialization logic can go here if needed in the future
  }

}
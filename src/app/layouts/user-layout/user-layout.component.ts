import { Component, inject, signal, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService, User } from '../../auth/auth.service';
import { NotificationDropdownComponent } from '../../shared/notification-dropdown/notification-dropdown.component';
import { environment } from '../../../environments/environment';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, NotificationDropdownComponent],
  templateUrl: './user-layout.component.html',
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private http = inject(HttpClient);

  protected readonly userName = signal('User');
  protected readonly userInitials = signal('U');
  protected readonly userPhotoUrl = signal<string | null>(null);

  ngOnInit() {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.userName.set(`${user.firstName} ${user.lastName}`);
      this.userInitials.set(this.getInitials(user.firstName, user.lastName));
      this.loadUserPhoto(user.id);
    }

    // Refresh photo on navigation (in case profile was updated)
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      const u = this.authService.getCurrentUser();
      if (u) this.loadUserPhoto(u.id);
    });
  }

  private loadUserPhoto(userId: number) {
    this.http.get<any>(`${environment.apiUrl}/users/${userId}`).subscribe({
      next: (profile) => this.userPhotoUrl.set(profile.photo_url || null),
    });
  }

  private getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }

  logout() {
    this.authService.logout();
  }
}

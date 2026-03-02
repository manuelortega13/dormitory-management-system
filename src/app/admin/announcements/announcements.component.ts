import { Component, signal, inject, OnInit, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AnnouncementService, Announcement, AnnouncementStats, CreateAnnouncementDto } from './announcement.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-announcements',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './announcements.component.html',
  styleUrl: './announcements.component.scss'
})
export class AnnouncementsComponent implements OnInit {
  private announcementService = inject(AnnouncementService);
  private notificationService = inject(NotificationService);

  searchQuery = signal('');
  announcements = signal<Announcement[]>([]);
  isLoading = signal(true);
  errorMessage = signal('');

  // Filters
  statusFilter = signal('');
  priorityFilter = signal('');
  audienceFilter = signal('');

  // Stats
  stats = signal<AnnouncementStats>({ total: 0, published: 0, drafts: 0, urgent: 0 });

  // Modal state
  showModal = signal(false);
  isEditing = signal(false);
  editingId = signal<number | null>(null);
  isSaving = signal(false);

  // Form data
  formTitle = signal('');
  formContent = signal('');
  formPriority = signal<'low' | 'normal' | 'high' | 'urgent'>('normal');
  formStatus = signal<'draft' | 'published'>('draft');
  formAudience = signal<'all' | 'residents' | 'parents' | 'staff'>('all');
  formExpiresAt = signal<string>('');

  // Delete confirmation
  showDeleteModal = signal(false);
  deletingAnnouncement = signal<Announcement | null>(null);
  isDeleting = signal(false);

  constructor() {
    // Watch for new announcement notifications and reload the list/stats
    effect(() => {
      const trigger = this.notificationService.newAnnouncementTrigger();
      if (trigger > 0) {
        this.loadAnnouncements();
        this.loadStats();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.loadAnnouncements();
    this.loadStats();
  }

  async loadAnnouncements() {
    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const filters: { status?: string; audience?: string; priority?: string } = {};
      if (this.statusFilter()) filters.status = this.statusFilter();
      if (this.audienceFilter()) filters.audience = this.audienceFilter();
      if (this.priorityFilter()) filters.priority = this.priorityFilter();

      const data = await this.announcementService.getAll(filters);
      this.announcements.set(data);
    } catch (error: any) {
      this.errorMessage.set(error?.error?.error || 'Failed to load announcements');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadStats() {
    try {
      const data = await this.announcementService.getStats();
      this.stats.set(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  get filteredAnnouncements(): Announcement[] {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.announcements();
    
    return this.announcements().filter(a => 
      a.title.toLowerCase().includes(query) || 
      a.content.toLowerCase().includes(query) ||
      a.author_name?.toLowerCase().includes(query)
    );
  }

  onFilterChange() {
    this.loadAnnouncements();
  }

  openCreateModal() {
    this.isEditing.set(false);
    this.editingId.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(announcement: Announcement) {
    this.isEditing.set(true);
    this.editingId.set(announcement.id);
    this.formTitle.set(announcement.title);
    this.formContent.set(announcement.content);
    this.formPriority.set(announcement.priority);
    this.formStatus.set(announcement.status === 'expired' ? 'draft' : announcement.status);
    this.formAudience.set(announcement.audience);
    this.formExpiresAt.set(announcement.expires_at ? announcement.expires_at.split('T')[0] : '');
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.resetForm();
  }

  resetForm() {
    this.formTitle.set('');
    this.formContent.set('');
    this.formPriority.set('normal');
    this.formStatus.set('draft');
    this.formAudience.set('all');
    this.formExpiresAt.set('');
  }

  async saveAnnouncement() {
    if (!this.formTitle() || !this.formContent()) {
      alert('Title and content are required');
      return;
    }

    this.isSaving.set(true);

    try {
      const data: CreateAnnouncementDto = {
        title: this.formTitle(),
        content: this.formContent(),
        priority: this.formPriority(),
        status: this.formStatus(),
        audience: this.formAudience(),
        expires_at: this.formExpiresAt() || null
      };

      if (this.isEditing() && this.editingId()) {
        await this.announcementService.update(this.editingId()!, data);
      } else {
        await this.announcementService.create(data);
      }

      this.closeModal();
      await this.loadAnnouncements();
      await this.loadStats();
    } catch (error: any) {
      alert(error?.error?.error || 'Failed to save announcement');
    } finally {
      this.isSaving.set(false);
    }
  }

  async publishAnnouncement(announcement: Announcement) {
    try {
      await this.announcementService.publish(announcement.id);
      await this.loadAnnouncements();
      await this.loadStats();
    } catch (error: any) {
      alert(error?.error?.error || 'Failed to publish announcement');
    }
  }

  openDeleteModal(announcement: Announcement) {
    this.deletingAnnouncement.set(announcement);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.deletingAnnouncement.set(null);
  }

  async confirmDelete() {
    const announcement = this.deletingAnnouncement();
    if (!announcement) return;

    this.isDeleting.set(true);

    try {
      await this.announcementService.delete(announcement.id);
      this.closeDeleteModal();
      await this.loadAnnouncements();
      await this.loadStats();
    } catch (error: any) {
      alert(error?.error?.error || 'Failed to delete announcement');
    } finally {
      this.isDeleting.set(false);
    }
  }

  getPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      low: 'low',
      normal: 'normal',
      high: 'high',
      urgent: 'urgent'
    };
    return classes[priority] || 'normal';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      draft: 'pending',
      published: 'completed',
      expired: 'expired'
    };
    return classes[status] || 'pending';
  }

  getAudienceIcon(audience: string): string {
    const icons: Record<string, string> = {
      all: '👥',
      residents: '🏠',
      parents: '👨‍👩‍👧',
      staff: '👔'
    };
    return icons[audience] || '👥';
  }

  formatDate(date: string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

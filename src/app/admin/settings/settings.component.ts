import { Component, signal, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { SettingsService, SystemSetting, SettingUpdate } from '../../services/settings.service';

interface SettingSection {
  id: string;
  title: string;
  icon: string;
  description: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);

  sections: SettingSection[] = [
    {
      id: 'general',
      title: 'General Settings',
      icon: '⚙️',
      description: 'Basic system configuration'
    },
    {
      id: 'notifications',
      title: 'Notification Settings',
      icon: '🔔',
      description: 'Configure system notifications'
    },
    {
      id: 'security',
      title: 'Security Settings',
      icon: '🔒',
      description: 'Security and access control'
    },
    {
      id: 'payments',
      title: 'Payment Settings',
      icon: '💳',
      description: 'Configure payment options'
    }
  ];

  activeSection = signal('general');
  isLoading = signal(true);
  isSaving = signal(false);
  hasChanges = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  // Local state for edited values
  editedValues = signal<Record<string, Record<string, any>>>({});

  ngOnInit() {
    this.loadSettings();
  }

  async loadSettings() {
    this.isLoading.set(true);
    this.errorMessage.set('');
    try {
      await this.settingsService.getAllSettings();
      // Initialize edited values with current values
      this.initializeEditedValues();
    } catch (error: any) {
      this.errorMessage.set('Failed to load settings');
    } finally {
      this.isLoading.set(false);
    }
  }

  initializeEditedValues() {
    const settings = this.settingsService.settings();
    const edited: Record<string, Record<string, any>> = {};
    
    for (const category in settings) {
      edited[category] = {};
      for (const setting of settings[category]) {
        edited[category][setting.key] = setting.value;
      }
    }
    
    this.editedValues.set(edited);
    this.hasChanges.set(false);
  }

  setActiveSection(sectionId: string): void {
    this.activeSection.set(sectionId);
  }

  getActiveSection(): SettingSection | undefined {
    return this.sections.find(s => s.id === this.activeSection());
  }

  getActiveSettings(): SystemSetting[] {
    const settings = this.settingsService.settings();
    return settings[this.activeSection()] || [];
  }

  getSettingValue(category: string, key: string): any {
    const edited = this.editedValues();
    return edited[category]?.[key];
  }

  updateSettingValue(category: string, key: string, value: any) {
    const edited = { ...this.editedValues() };
    if (!edited[category]) {
      edited[category] = {};
    }
    edited[category][key] = value;
    this.editedValues.set(edited);
    this.hasChanges.set(true);
    this.successMessage.set('');
  }

  async saveChanges() {
    this.isSaving.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const updates: SettingUpdate[] = [];
      const edited = this.editedValues();
      const original = this.settingsService.settings();

      // Find all changed values
      for (const category in edited) {
        for (const key in edited[category]) {
          const originalSetting = original[category]?.find(s => s.key === key);
          if (originalSetting && edited[category][key] !== originalSetting.value) {
            updates.push({
              category,
              key,
              value: edited[category][key]
            });
          }
        }
      }

      if (updates.length > 0) {
        await this.settingsService.updateSettings(updates);
        this.initializeEditedValues();
        this.successMessage.set('Settings saved successfully!');
      } else {
        this.successMessage.set('No changes to save');
      }
    } catch (error: any) {
      this.errorMessage.set('Failed to save settings');
    } finally {
      this.isSaving.set(false);
    }
  }

  discardChanges() {
    this.initializeEditedValues();
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  getSettingLabel(key: string): string {
    // Convert snake_case to Title Case
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

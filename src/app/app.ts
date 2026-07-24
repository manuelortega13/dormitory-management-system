import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast-container/toast-container.component';
import { NotificationPromptComponent } from './shared/notification-prompt/notification-prompt.component';
import { ChatbotWidgetComponent } from './shared/chatbot-widget/chatbot-widget.component';
import { SettingsService } from './services/settings.service';
import { AppUpdateService } from './services/app-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainerComponent, NotificationPromptComponent, ChatbotWidgetComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  private settingsService = inject(SettingsService);
  private appUpdateService = inject(AppUpdateService);
  protected readonly title = signal('PAC DMS');

  ngOnInit() {
    this.settingsService.loadBranding();
    this.appUpdateService.init();
  }
}

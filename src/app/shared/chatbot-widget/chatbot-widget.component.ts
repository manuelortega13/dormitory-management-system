import { Component, inject, ElementRef, viewChild, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatbotService, ChatMessage } from '../../services/chatbot.service';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrl: './chatbot-widget.component.scss',
})
export class ChatbotWidgetComponent {
  protected chatbot = inject(ChatbotService);
  protected auth = inject(AuthService);

  messagesContainer = viewChild<ElementRef>('messagesContainer');
  messageInput = viewChild<ElementRef>('messageInput');

  protected inputText = '';

  constructor() {
    effect(() => {
      // Trigger on messages change to auto-scroll
      this.chatbot.messages();
      this.scrollToBottom();
    });
  }

  protected send() {
    const text = this.inputText.trim();
    if (!text || this.chatbot.loading()) return;
    this.inputText = '';
    this.chatbot.sendMessage(text);
  }

  protected onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected toggle() {
    this.chatbot.toggle();
    if (this.chatbot.isOpen()) {
      setTimeout(() => this.messageInput()?.nativeElement.focus(), 100);
    }
  }

  protected clear() {
    this.chatbot.clearHistory();
  }

  protected formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom() {
    setTimeout(() => {
      const el = this.messagesContainer()?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }
}

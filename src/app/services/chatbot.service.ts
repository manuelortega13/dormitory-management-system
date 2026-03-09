import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root',
})
export class ChatbotService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/chatbot`;

  messages = signal<ChatMessage[]>([]);
  loading = signal<boolean>(false);
  isOpen = signal<boolean>(false);

  toggle() {
    this.isOpen.update((v) => !v);
  }

  async sendMessage(text: string): Promise<void> {
    const userMessage: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    this.messages.update((msgs) => [...msgs, userMessage]);
    this.loading.set(true);

    try {
      const history = this.messages().map((m) => ({ role: m.role, content: m.content }));
      // Remove the last user message from history since we send it as `message`
      history.pop();

      const response = await firstValueFrom(
        this.http.post<{ success: boolean; message: string }>(
          `${this.apiUrl}/message`,
          { message: text.trim(), history },
        ),
      );

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      };
      this.messages.update((msgs) => [...msgs, assistantMessage]);
    } catch (error: any) {
      const errorMsg =
        error?.error?.error || 'Sorry, something went wrong. Please try again.';
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: errorMsg,
        timestamp: new Date(),
      };
      this.messages.update((msgs) => [...msgs, assistantMessage]);
    } finally {
      this.loading.set(false);
    }
  }

  clearHistory() {
    this.messages.set([]);
  }
}

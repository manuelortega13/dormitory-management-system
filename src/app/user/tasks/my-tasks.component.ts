import { Component, signal, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tasks-page">
      <header><h1>📋 My Tasks</h1><p class="subtitle">Disciplinary tasks assigned to you</p></header>

      @if (loading()) {
        <div class="state">Loading…</div>
      } @else if (tasks().length === 0) {
        <div class="state empty">You have no tasks. 🎉</div>
      } @else {
        <div class="task-list">
          @for (t of tasks(); track t.id) {
            <div class="task-card" [class.done]="t.status === 'completed'">
              <div class="task-head">
                <span class="task-title">{{ t.title }}</span>
                <span class="badge" [class]="t.status">{{ t.status === 'completed' ? 'Completed' : 'Pending' }}</span>
              </div>
              @if (t.description) { <p class="task-desc">{{ t.description }}</p> }
              <div class="task-meta">
                @if (t.due_date) { <span>Due {{ t.due_date | date: 'mediumDate' }}</span> }
                @if (t.assigned_by_name) { <span>By {{ t.assigned_by_name }}</span> }
                <span>Assigned {{ t.created_at | date: 'mediumDate' }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .tasks-page { padding: 1rem; max-width: 720px; margin: 0 auto; }
      header h1 { margin: 0; font-size: 1.4rem; }
      .subtitle { color: #6c757d; margin: 0.2rem 0 1rem; font-size: 0.85rem; }
      .state { padding: 2rem; text-align: center; color: #6c757d; }
      .task-list { display: flex; flex-direction: column; gap: 0.75rem; }
      .task-card { background: #fff; border: 1px solid #eee; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
      .task-card.done { opacity: 0.7; }
      .task-head { display: flex; justify-content: space-between; align-items: center; }
      .task-title { font-weight: 600; color: #1a1a2e; }
      .badge { padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
      .badge.pending { background: #f8d7da; color: #842029; }
      .badge.completed { background: #d1e7dd; color: #0f5132; }
      .task-desc { color: #495057; font-size: 0.9rem; margin: 0.5rem 0; }
      .task-meta { display: flex; flex-wrap: wrap; gap: 0.75rem; font-size: 0.75rem; color: #adb5bd; }
    `,
  ],
})
export class MyTasksComponent implements OnInit {
  private taskService = inject(TaskService);
  private notifications = inject(NotificationService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  constructor() {
    effect(() => {
      if (this.notifications.gatepassUpdatedTrigger() > 0) this.load();
    });
  }

  ngOnInit(): void {
    this.load();
  }
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.tasks.set(await this.taskService.getMyTasks());
    } finally {
      this.loading.set(false);
    }
  }
}

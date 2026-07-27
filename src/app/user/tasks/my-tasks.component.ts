import { Component, signal, inject, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskService } from '../../services/task.service';
import { Task } from '../../models/task.model';
import { NotificationService } from '../../services/notification.service';
import { ToastService } from '../../services/toast.service';
import { compressImage } from '../../shared/utils/image.util';

@Component({
  selector: 'app-my-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="tasks-page">
      <header>
        <h1>📋 My Tasks</h1>
        <p class="subtitle">Disciplinary tasks assigned to you</p>
      </header>

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
                <span class="badge" [class]="t.status">{{
                  t.status === 'completed' ? 'Completed' : 'Pending'
                }}</span>
              </div>
              @if (t.description) {
                <p class="task-desc">{{ t.description }}</p>
              }
              <div class="task-meta">
                @if (t.due_date) {
                  <span>Due {{ t.due_date | date: 'mediumDate' }}</span>
                }
                @if (t.assigned_by_name) {
                  <span>By {{ t.assigned_by_name }}</span>
                }
                <span>Assigned {{ t.created_at | date: 'mediumDate' }}</span>
              </div>

              @if (t.status === 'completed') {
                <div class="proof">
                  @if (t.completion_note) {
                    <p class="proof-note">📝 {{ t.completion_note }}</p>
                  }
                  @if (t.completion_image) {
                    <img class="proof-img" [src]="t.completion_image" alt="Completion proof" />
                  }
                  @if (t.completed_at) {
                    <span class="proof-date">Completed {{ t.completed_at | date: 'medium' }}</span>
                  }
                </div>
              } @else {
                <div class="task-actions">
                  <button class="btn-complete" (click)="openComplete(t)">Mark as Completed</button>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Complete-with-proof modal -->
    @if (completeTarget()) {
      <div class="modal-overlay" (click)="closeComplete()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h2>Complete Task</h2>
          <p class="modal-sub">{{ completeTarget()!.title }}</p>

          <label>Note <span class="optional">(optional)</span></label>
          <textarea
            rows="3"
            [(ngModel)]="noteInput"
            placeholder="Add a note about how you completed this task…"
          ></textarea>

          <label>Proof photo <span class="req">*</span></label>
          <p class="hint">Attach a photo as proof that the task is done.</p>
          @if (proofImage()) {
            <div class="preview">
              <img [src]="proofImage()!" alt="Proof preview" />
              <button type="button" class="btn-remove" (click)="clearImage()">Remove</button>
            </div>
          } @else {
            <label class="file-drop">
              📷 Take / Choose Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                (change)="onImage($event)"
                hidden
              />
            </label>
          }

          @if (formError()) {
            <p class="form-error">{{ formError() }}</p>
          }

          <div class="modal-actions">
            <button class="btn-secondary" (click)="closeComplete()" [disabled]="saving()">
              Cancel
            </button>
            <button class="btn-complete" (click)="submitComplete()" [disabled]="saving()">
              {{ saving() ? 'Submitting…' : 'Complete Task' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .tasks-page {
        padding: 1rem;
        max-width: 720px;
        margin: 0 auto;
      }
      header h1 {
        margin: 0;
        font-size: 1.4rem;
      }
      .subtitle {
        color: #6c757d;
        margin: 0.2rem 0 1rem;
        font-size: 0.85rem;
      }
      .state {
        padding: 2rem;
        text-align: center;
        color: #6c757d;
      }
      .task-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .task-card {
        background: #fff;
        border: 1px solid #eee;
        border-radius: 10px;
        padding: 1rem;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
      }
      .task-card.done {
        opacity: 0.85;
      }
      .task-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.5rem;
      }
      .task-title {
        font-weight: 600;
        color: #1a1a2e;
      }
      .badge {
        padding: 0.2rem 0.6rem;
        border-radius: 20px;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .badge.pending {
        background: #f8d7da;
        color: #842029;
      }
      .badge.completed {
        background: #d1e7dd;
        color: #0f5132;
      }
      .task-desc {
        color: #495057;
        font-size: 0.9rem;
        margin: 0.5rem 0;
      }
      .task-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        font-size: 0.75rem;
        color: #adb5bd;
      }
      .task-actions {
        margin-top: 0.85rem;
      }
      .btn-complete {
        background: #2f9e44;
        color: #fff;
        border: none;
        padding: 0.55rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .btn-complete:hover:not(:disabled) {
        background: #268139;
      }
      .btn-complete:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .proof {
        margin-top: 0.85rem;
        padding-top: 0.75rem;
        border-top: 1px solid #f1f3f5;
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
      }
      .proof-note {
        margin: 0;
        font-size: 0.85rem;
        color: #495057;
      }
      .proof-img {
        max-width: 200px;
        border-radius: 8px;
      }
      .proof-date {
        font-size: 0.72rem;
        color: #adb5bd;
      }

      .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1300;
        padding: 1rem;
      }
      .modal {
        background: #fff;
        border-radius: 12px;
        padding: 1.25rem;
        width: 100%;
        max-width: 440px;
        max-height: 90vh;
        overflow-y: auto;
      }
      .modal h2 {
        margin: 0 0 0.2rem;
        font-size: 1.15rem;
      }
      .modal-sub {
        margin: 0 0 1rem;
        color: #6c757d;
        font-size: 0.85rem;
      }
      .modal label {
        display: block;
        font-weight: 600;
        font-size: 0.85rem;
        margin: 0.75rem 0 0.3rem;
        color: #1a1a2e;
      }
      .optional {
        color: #adb5bd;
        font-weight: 400;
      }
      .req {
        color: #e03131;
      }
      .hint {
        margin: 0 0 0.5rem;
        font-size: 0.78rem;
        color: #868e96;
      }
      .modal textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #ced4da;
        border-radius: 8px;
        padding: 0.6rem;
        font-family: inherit;
        font-size: 0.9rem;
        resize: vertical;
      }
      .file-drop {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        cursor: pointer;
        background: #eef2ff;
        color: #4a90d9;
        border: 1px dashed #b9c6f0;
        padding: 0.7rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
      }
      .preview {
        position: relative;
        display: inline-block;
      }
      .preview img {
        max-width: 100%;
        max-height: 220px;
        border-radius: 8px;
        display: block;
      }
      .btn-remove {
        margin-top: 0.4rem;
        background: #f1f3f5;
        border: none;
        padding: 0.35rem 0.75rem;
        border-radius: 6px;
        font-size: 0.78rem;
        cursor: pointer;
      }
      .form-error {
        color: #e03131;
        font-size: 0.8rem;
        margin: 0.6rem 0 0;
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
        margin-top: 1.25rem;
      }
      .btn-secondary {
        background: #f1f3f5;
        color: #495057;
        border: none;
        padding: 0.55rem 1rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .btn-secondary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class MyTasksComponent implements OnInit {
  private taskService = inject(TaskService);
  private notifications = inject(NotificationService);
  private toast = inject(ToastService);
  protected readonly tasks = signal<Task[]>([]);
  protected readonly loading = signal(true);

  // Complete-with-proof modal state
  protected readonly completeTarget = signal<Task | null>(null);
  protected noteInput = '';
  protected readonly proofImage = signal<string | null>(null);
  protected readonly formError = signal('');
  protected readonly saving = signal(false);

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

  openComplete(t: Task): void {
    this.noteInput = '';
    this.proofImage.set(null);
    this.formError.set('');
    this.completeTarget.set(t);
  }

  closeComplete(): void {
    this.completeTarget.set(null);
  }

  clearImage(): void {
    this.proofImage.set(null);
  }

  async onImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.formError.set('Please select an image file');
      return;
    }
    this.formError.set('');
    try {
      this.proofImage.set(await compressImage(file));
    } catch {
      this.formError.set('Could not process that image. Please try another.');
    }
  }

  async submitComplete(): Promise<void> {
    const task = this.completeTarget();
    if (!task) return;
    const image = this.proofImage();
    if (!image) {
      this.formError.set('A proof photo is required to complete this task.');
      return;
    }
    this.saving.set(true);
    try {
      await this.taskService.completeMyTask(task.id, {
        note: this.noteInput.trim() || undefined,
        image,
      });
      this.toast.success('Task completed', 'Your task has been marked as completed.');
      this.completeTarget.set(null);
      await this.load();
    } catch (err: any) {
      this.formError.set(err?.error?.error || 'Failed to complete the task. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }
}

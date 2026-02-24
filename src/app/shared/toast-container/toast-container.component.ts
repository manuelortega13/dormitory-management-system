import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss'
})
export class ToastContainerComponent {
  toastService = inject(ToastService);

  onToastClick(toast: Toast): void {
    if (toast.onClick) {
      toast.onClick();
    }
    this.toastService.dismiss(toast.id);
  }

  dismiss(id: number): void {
    this.toastService.dismiss(id);
  }
}

import { Component, input } from '@angular/core';
import { PaginatorControls } from '../utils/paginate.util';

/**
 * Pager bar for a paginated list. Same controls as the Payments page — previous/next,
 * a five-page window and a "page X of Y" summary — in one place, so the admin list
 * pages don't each carry their own copy.
 */
@Component({
  selector: 'app-pagination',
  standalone: true,
  templateUrl: './pagination.component.html',
  styleUrl: './pagination.component.scss',
})
export class PaginationComponent {
  /** The paginator returned by `paginate()`. */
  readonly state = input.required<PaginatorControls>();

  /** Plural noun for the total, e.g. "occupants". */
  readonly itemLabel = input('items');
}

import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface InventoryItem {
  id: number;
  name: string;
  category: 'furniture' | 'appliance' | 'linens' | 'supplies' | 'equipment';
  quantity: number;
  minStock: number;
  location: string;
  condition: 'good' | 'fair' | 'poor' | 'needs-replacement';
  lastUpdated: string;
}

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss'
})
export class InventoryComponent {
  searchQuery = signal('');

  mockItems: InventoryItem[] = [
    {
      id: 1,
      name: 'Single Bed Frame',
      category: 'furniture',
      quantity: 48,
      minStock: 10,
      location: 'Storage Room A',
      condition: 'good',
      lastUpdated: '2025-01-10'
    },
    {
      id: 2,
      name: 'Mattress (Single)',
      category: 'furniture',
      quantity: 45,
      minStock: 10,
      location: 'Storage Room A',
      condition: 'fair',
      lastUpdated: '2025-01-08'
    },
    {
      id: 3,
      name: 'Study Desk',
      category: 'furniture',
      quantity: 50,
      minStock: 10,
      location: 'Storage Room B',
      condition: 'good',
      lastUpdated: '2025-01-05'
    },
    {
      id: 4,
      name: 'Electric Fan',
      category: 'appliance',
      quantity: 5,
      minStock: 10,
      location: 'Maintenance Office',
      condition: 'fair',
      lastUpdated: '2025-01-12'
    },
    {
      id: 5,
      name: 'Bed Sheets Set',
      category: 'linens',
      quantity: 100,
      minStock: 30,
      location: 'Laundry Room',
      condition: 'good',
      lastUpdated: '2025-01-11'
    },
    {
      id: 6,
      name: 'Cleaning Supplies Kit',
      category: 'supplies',
      quantity: 15,
      minStock: 20,
      location: 'Janitor Closet',
      condition: 'good',
      lastUpdated: '2025-01-09'
    },
    {
      id: 7,
      name: 'Fire Extinguisher',
      category: 'equipment',
      quantity: 12,
      minStock: 12,
      location: 'Various Floors',
      condition: 'good',
      lastUpdated: '2024-12-15'
    },
    {
      id: 8,
      name: 'Chair (Plastic)',
      category: 'furniture',
      quantity: 8,
      minStock: 15,
      location: 'Storage Room B',
      condition: 'poor',
      lastUpdated: '2025-01-07'
    }
  ];

  stats = {
    totalItems: this.mockItems.length,
    lowStock: this.mockItems.filter(i => i.quantity < i.minStock).length,
    needsReplacement: this.mockItems.filter(i => i.condition === 'needs-replacement' || i.condition === 'poor').length,
    categories: new Set(this.mockItems.map(i => i.category)).size
  };

  getStockClass(item: InventoryItem): string {
    if (item.quantity < item.minStock) return 'low-stock';
    if (item.quantity < item.minStock * 1.5) return 'warning-stock';
    return 'good-stock';
  }

  getConditionClass(condition: string): string {
    const classes: Record<string, string> = {
      good: 'completed',
      fair: 'pending',
      poor: 'overdue',
      'needs-replacement': 'overdue'
    };
    return classes[condition] || 'pending';
  }

  getCategoryIcon(category: string): string {
    const icons: Record<string, string> = {
      furniture: '🪑',
      appliance: '🔌',
      linens: '🛏️',
      supplies: '🧹',
      equipment: '🧯'
    };
    return icons[category] || '📦';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

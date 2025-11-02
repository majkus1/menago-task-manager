import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleString('pl-PL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isOverdue(date: string | Date): boolean {
  return new Date(date) < new Date();
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function getPriorityColor(priority: number): string {
  switch (priority) {
    case 0: return 'text-gray-500';
    case 1: return 'text-blue-500';
    case 2: return 'text-orange-500';
    case 3: return 'text-red-500';
    default: return 'text-gray-500';
  }
}

export function getPriorityLabel(priority: number): string {
  switch (priority) {
    case 0: return 'Niski';
    case 1: return 'Średni';
    case 2: return 'Wysoki';
    case 3: return 'Krytyczny';
    default: return 'Nieznany';
  }
}

export function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

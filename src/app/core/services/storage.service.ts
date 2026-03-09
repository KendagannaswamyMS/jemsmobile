import { Injectable } from '@angular/core';

const PREFIX = 'jems_';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get(key: string): string | null {
    return localStorage.getItem(PREFIX + key);
  }

  set(key: string, value: string): void {
    localStorage.setItem(PREFIX + key, value);
  }

  remove(key: string): void {
    localStorage.removeItem(PREFIX + key);
  }

  getJson<T>(key: string): T | null {
    const raw = this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw) as T; } catch { return null; }
  }

  setJson(key: string, value: any): void {
    this.set(key, JSON.stringify(value));
  }

  clear(): void {
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => localStorage.removeItem(k));
  }
}

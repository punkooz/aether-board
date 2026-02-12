import { promises as fs } from 'node:fs';
import path from 'node:path';

export class JsonStore<T extends { id: string }> {
  constructor(private readonly filePath: string) {}

  async ensure(defaultValue: T[] = []): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify(defaultValue, null, 2));
    }
  }

  async all(): Promise<T[]> {
    await this.ensure();
    const raw = await fs.readFile(this.filePath, 'utf-8');
    return JSON.parse(raw) as T[];
  }

  async writeAll(items: T[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(items, null, 2));
  }

  async findById(id: string): Promise<T | undefined> {
    const items = await this.all();
    return items.find((it) => it.id === id);
  }

  async insert(item: T): Promise<T> {
    const items = await this.all();
    items.push(item);
    await this.writeAll(items);
    return item;
  }

  async update(id: string, patch: Partial<T>): Promise<T | undefined> {
    const items = await this.all();
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return undefined;
    items[idx] = { ...items[idx], ...patch } as T;
    await this.writeAll(items);
    return items[idx];
  }

  async delete(id: string): Promise<boolean> {
    const items = await this.all();
    const next = items.filter((it) => it.id !== id);
    if (next.length === items.length) return false;
    await this.writeAll(next);
    return true;
  }
}

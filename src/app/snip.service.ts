import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface LinkRecord {
  code: string;
  url: string;
  shortUrl: string;
  hits: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class SnipService {
  private readonly http = inject(HttpClient);

  createLink(url: string) {
    return this.http.post<LinkRecord>('http://localhost:3000/api/links', { url });
  }

  listLinks() {
    return this.http.get<LinkRecord[]>('http://localhost:3000/api/links');
  }
}

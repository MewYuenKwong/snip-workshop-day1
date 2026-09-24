import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { LinkRecord, SnipService } from './snip.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  private readonly fb = inject(FormBuilder);
  private readonly snipService = inject(SnipService);

  readonly form = this.fb.nonNullable.group({
    url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/i)]],
  });

  readonly links = signal<LinkRecord[]>([]);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  constructor() {
    this.loadLinks();
  }

  loadLinks(): void {
    this.errorMessage.set('');

    this.snipService.listLinks().subscribe({
      next: (items) => this.links.set(items),
      error: () => this.errorMessage.set('Could not load links right now.'),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please enter a valid http or https URL.');
      this.successMessage.set('');
      return;
    }

    const rawUrl = this.form.controls.url.value.trim();
    if (!/^https?:\/\//i.test(rawUrl)) {
      this.errorMessage.set('Please enter a valid http or https URL.');
      this.successMessage.set('');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.snipService
      .createLink(rawUrl)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (link) => {
          this.form.reset();
          this.successMessage.set(`Short link ready: ${link.shortUrl}`);
          this.loadLinks();
        },
        error: (error) => {
          const message = error?.error?.error || 'Unable to create link. Please try again.';
          this.errorMessage.set(message);
        },
      });
  }
}

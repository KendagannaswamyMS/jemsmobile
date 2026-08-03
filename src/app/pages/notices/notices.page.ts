import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from '../../core/services/auth.service';

/** Category whose posts belong to the exam-announcements section on jssstuniv.in. */
const EXAM_ANNOUNCEMENT_SECTION = 'Exam Announcements';
// Offset applied to JSS Web Portal content IDs so they can't collide with real notice slnums
// when merged into the same list.
const EXAM_POST_SLNUM_OFFSET = 1_000_000_000;

@Component({
  selector: 'app-notices',
  templateUrl: './notices.page.html',
  styleUrls: ['./notices.page.scss'],
  standalone: false
})
export class NoticesPage implements OnInit {
  loading = false;
  notices: any[] = [];
  expandedSlnum: number | null = null;

  constructor(private http: HttpClient, private authService: AuthService) {}

  ngOnInit() {
    const studentId = this.authService.getCurrentUser()?.userId || 0;

    this.loading = true;
    forkJoin({
      notices: studentId
        ? this.http.get<any[]>(`${environment.apiUrl}studentnotice/student/${studentId}`).pipe(catchError(() => of([])))
        : of([]),
      examPosts: this.http.get<any[]>(`${environment.apiUrl}jsswebportlang/feed`).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ notices, examPosts }) => {
        const exam = (examPosts || [])
          .filter((c: any) => c.websiteSection === EXAM_ANNOUNCEMENT_SECTION)
          .map((c: any) => this.mapExamPostToNotice(c));

        this.notices = [...(notices || []), ...exam].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  /** Adapts a published JSS Web Portal content item into the same shape as a student notice. */
  private mapExamPostToNotice(content: any): any {
    return {
      slnum: EXAM_POST_SLNUM_OFFSET + content.contentId,
      title: content.title,
      message: content.summary || content.contentBody,
      academicYearLabel: content.academicYear,
      visibleFrom: content.displayStartAt,
      visibleTo: content.displayEndAt,
      status: content.status,
      isActive: content.isActive,
      createdAt: content.publishedAt || content.displayStartAt || content.createdAt,
      updatedAt: content.updatedAt,
      categoryName: content.categoryName,
      attachments: (content.attachments || []).map((a: any) => ({
        slnum: a.attachmentId,
        attachmentType: a.attachmentType === 'file' ? 'file' : 'url',
        originalFileName: a.originalName,
        storedFilePath: a.publicUrl,
        publicUrl: a.publicUrl,
        mimeType: a.mimeType,
        fileSizeBytes: a.fileSizeBytes
      }))
    };
  }

  toggle(slnum: number) {
    this.expandedSlnum = this.expandedSlnum === slnum ? null : slnum;
  }

  isExpired(notice: any): boolean {
    if (!notice.visibleTo) return false;
    return new Date(notice.visibleTo) < new Date();
  }

  formatBytes(bytes?: number): string {
    if (bytes === undefined || bytes === null) return '';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

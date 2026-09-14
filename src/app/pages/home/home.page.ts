import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { filter, take } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { CurrentUser } from '../../models/user.model';
import { BiometricRecord, DayLog } from '../../models/biometric.model';
import { LatestJoiner } from '../../models/joiner.model';
import { environment } from 'src/environments/environment';

export interface StaffNewsMember {
  name: string;
  designation: string;
  /** Tblusermaster.UserId — the profile picture is resolved from this. */
  userId?: number;
  avatar?: string;
}

/**
 * Staff profile pictures are served as absolute URLs off the JEMS archive host and
 * follow a per-user folder convention, e.g.
 *   https://jems.jssstuniv.in/archivefilestorage/userprofilepics/278/profile_278.jpg
 * The extension varies per upload (.jpg / .png), so a URL is never constructed from
 * an id — it is taken from Tblusermaster.UserProfilepic as stored.
 */
const STAFF_PROFILE_PIC_BASE = 'https://jems.jssstuniv.in/archivefilestorage/userprofilepics';

export interface StaffNewsItem {
  id: number;
  title: string;
  detail?: string;
  category?: string;
  date?: string;
  bannerImg: string;
  staffList: StaffNewsMember[];
  imgError?: boolean;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false
})
export class HomePage implements OnInit, OnDestroy {
  user: CurrentUser | null = null;

  // Biometric
  biometric: BiometricRecord | null = null;
  bioLoading = true;
  bioImgError = false;
  runningTime = '';
  private timerInterval: any;

  // Latest Joiners
  latestJoiners: LatestJoiner[] = [];
  selectedJoiner: LatestJoiner | null = null;
  joinerImgError = false;

  // Student Clubs / Club Events (student-only)
  clubs: any[] = [];
  clubEvents: any[] = [];

  // University Staff in News
  staffNewsList: StaffNewsItem[] = [
    {
      id: 1,
      title: 'Congratulations! JSS Science & Technology University Welcomes Prof. Santhosh Chidangil',
      detail: 'Prof. Santhosh Chidangil joins the Department of Physics as Professor, bringing internationally acclaimed research leadership in Photonics and Biophotonics.',
      category: 'Welcome',
      date: '2026-07-30',
      bannerImg: '',
      staffList: [
        {
          name: 'Dr. Santhosh Chidangil',
          designation: 'Professor',
          userId: 678,
          avatar: `${STAFF_PROFILE_PIC_BASE}/678/profile_678.jpg`
        }
      ]
    },
    {
      id: 2,
      title: 'CPHEEO PHE Sector Development Scheme Grant Awarded',
      detail: 'Government of India, New Delhi awards research grant under CPHEEO PHE Sector Development Scheme to Department of Environmental Engineering.',
      category: 'Research Grant',
      date: '2026-07-28',
      bannerImg: '',
      staffList: [
        {
          name: 'Dr. C S. Karthik',
          designation: 'Associate Professor',
          userId: 27,
          avatar: `${STAFF_PROFILE_PIC_BASE}/27/profile_27.jpg`
        },
        {
          name: 'Dr. SHIVAPRASAD K S',
          designation: 'Assistant Professor',
          userId: 278,
          avatar: `${STAFF_PROFILE_PIC_BASE}/278/profile_278.jpg`
        }
      ]
    },
    {
      id: 3,
      title: 'Appointed as Dean International Engagements and Rankings',
      detail: 'Hearty congratulations on your well-deserved appointment as Dean International Engagements and Rankings.',
      category: 'Leadership',
      date: '2026-07-25',
      bannerImg: '',
      staffList: [
        {
          name: 'Dr. Mahanand B S',
          designation: 'Professor',
          userId: 312,
          avatar: `${STAFF_PROFILE_PIC_BASE}/312/profile_312.jpg`
        }
      ]
    },
    {
      id: 4,
      title: 'Felicitation for Excellence in Academic Innovation & Research',
      detail: 'JSS Science & Technology University felicitates Dr. S. Reddy K. for outstanding contributions to research and innovations.',
      category: 'Excellence Award',
      date: '2026-07-20',
      bannerImg: '',
      staffList: [
        {
          name: 'Dr. P. S. Reddy K.',
          designation: 'Professor',
          userId: 398,
          avatar: `${STAFF_PROFILE_PIC_BASE}/398/profile_398.jpg`
        }
      ]
    }
  ];

  selectedNewsItem: StaffNewsItem | null = null;
  showPostModal = false;

  newAchievement = {
    title: '',
    category: 'Research Grant',
    description: '',
    staffName: '',
    designation: 'Assistant Professor',
    bannerUrl: ''
  };

  constructor(
    private authService: AuthService,
    private http: HttpClient,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.authService.user$.subscribe(u => (this.user = u));

    if (!this.isStudent) {
      // Wait for user to be available, then fetch biometric (staff-only: time-clock punch data)
      this.authService.user$.pipe(
        filter(u => !!u),
        take(1)
      ).subscribe(u => {
        this.loadBiometric(u!.userId);
      });

      this.loadLatestJoiners();
      this.loadStaffNews();
    } else {
      this.bioLoading = false;
      this.loadClubs();
      this.loadClubEvents();
    }
  }

  get isStudent(): boolean {
    return this.authService.isStudent();
  }

  // ── Biometric ──────────────────────────────────────────────────────────────

  private loadBiometric(userId: number) {
    this.bioLoading = true;
    this.http.post<BiometricRecord[]>(
      `${environment.apiUrl}biometriclog/getweeklyattendancerecords`,
      { UserId: userId, selectedDate: new Date().toISOString() }
    ).subscribe({
      next: res => {
        this.biometric = res?.[0] || null;
        this.bioLoading = false;
        this.startTimer();
      },
      error: () => { this.bioLoading = false; }
    });
  }

  get todayLog(): DayLog | null {
    if (!this.biometric?.logs?.length) return null;
    const today = new Date().toDateString();
    return this.biometric.logs.find(l => new Date(l.date).toDateString() === today) || null;
  }

  get todayDateLabel(): string {
    return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  // First "In" punch time, e.g. "10:13 AM"
  firstIn(day: DayLog): string {
    const entry = day.logs.find(l => l.status === 'In');
    if (!entry) return '—';
    return new Date(entry.logdatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  // Last "Out" punch time
  lastOut(day: DayLog): string {
    const outs = day.logs.filter(l => l.status === 'Out');
    if (!outs.length) return '—';
    return new Date(outs[outs.length - 1].logdatetime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  isStillIn(day: DayLog): boolean {
    return day.logs.some(l => l.status === 'In') && !day.logs.some(l => l.status === 'Out');
  }

  private startTimer() {
    this.updateRunningTime();
    this.timerInterval = setInterval(() => this.updateRunningTime(), 1000);
  }

  private updateRunningTime() {
    const day = this.todayLog;
    if (!day?.logs?.length) { this.runningTime = ''; return; }
    const firstInLog = day.logs.find(l => l.status === 'In');
    if (!firstInLog) { this.runningTime = ''; return; }
    const outs = day.logs.filter(l => l.status === 'Out');
    const end = outs.length ? new Date(outs[outs.length - 1].logdatetime).getTime() : Date.now();
    const elapsed = end - new Date(firstInLog.logdatetime).getTime();
    const h = Math.floor(elapsed / 3600000);
    const m = Math.floor((elapsed % 3600000) / 60000);
    const s = Math.floor((elapsed % 60000) / 1000);
    this.runningTime = `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
  }

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  // ── Latest Joiners ─────────────────────────────────────────────────────────

  private loadLatestJoiners() {
    this.http.get<LatestJoiner[]>(`${environment.apiUrl}UserMaster/getthelatest`)
      .subscribe({ next: res => (this.latestJoiners = res || []), error: () => {} });
  }

  joinerName(j: LatestJoiner): string {
    return [j.firstName, j.middleName, j.lastName].filter(s => s?.trim()).join(' ').trim();
  }

  joinerInitials(j: LatestJoiner): string {
    const f = j.firstName?.trim()[0] || '';
    const l = j.lastName?.trim()[0] || j.firstName?.trim().split(' ')?.[1]?.[0] || '';
    return (f + l).toUpperCase() || '?';
  }

  joiningDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  openJoinerPopup(j: LatestJoiner) { this.selectedJoiner = j; this.joinerImgError = false; }
  closeJoinerPopup() { this.selectedJoiner = null; }

  // ── Student Clubs / Club Events ──────────────────────────────────────────────

  private loadClubs() {
    this.http.get<any[]>(`${environment.apiUrl}club/list`)
      .subscribe({ next: res => (this.clubs = res || []), error: () => {} });
  }

  private loadClubEvents() {
    this.http.get<any[]>(`${environment.apiUrl}clubevent/upcoming`)
      .subscribe({ next: res => (this.clubEvents = res || []), error: () => {} });
  }

  // ── University Staff in News Methods ────────────────────────────────────────

  private loadStaffNews() {
    // Keep staffNewsList strictly dedicated to University Staff News & Achievements (no mixing with generic events)
  }

  openPostAchievementModal() {
    const u = this.user;
    this.newAchievement = {
      title: '',
      category: 'Research Grant',
      description: '',
      staffName: u ? [u.firstName || u.name, u.lastName].filter(Boolean).join(' ') : '',
      designation: 'Assistant Professor',
      bannerUrl: ''
    };
    this.showPostModal = true;
  }

  closePostModal() {
    this.showPostModal = false;
  }

  async submitAchievement() {
    if (!this.newAchievement.title?.trim() || !this.newAchievement.staffName?.trim()) {
      const toast = await this.toastCtrl.create({
        message: 'Please fill in the achievement title and staff name.',
        duration: 2500,
        position: 'bottom',
        color: 'warning'
      });
      await toast.present();
      return;
    }

    const newItem: StaffNewsItem = {
      id: Date.now(),
      title: this.newAchievement.title,
      detail: this.newAchievement.description || 'Achievement posted by staff member.',
      category: this.newAchievement.category || 'Achievement',
      date: new Date().toISOString().split('T')[0],
      bannerImg: this.newAchievement.bannerUrl || '',
      staffList: [
        {
          name: this.newAchievement.staffName,
          designation: this.newAchievement.designation || 'Faculty Member',
          // The form is prefilled with the signed-in staff member, so their own picture
          // applies unless they retyped the name as somebody else.
          userId: this.isOwnAchievement() ? this.user?.userId : undefined,
          avatar: this.isOwnAchievement() ? (this.user?.profilePic || '') : ''
        }
      ]
    };

    this.staffNewsList.unshift(newItem);
    this.showPostModal = false;

    const toast = await this.toastCtrl.create({
      message: 'Achievement posted successfully! Submitted for university approval.',
      duration: 3000,
      position: 'bottom',
      color: 'success'
    });
    await toast.present();
  }

  openStaffNewsDetail(item: StaffNewsItem) {
    this.selectedNewsItem = item;
  }

  closeStaffNewsDetail() {
    this.selectedNewsItem = null;
  }

  /** True when the achievement form still names the signed-in user (the prefilled default). */
  private isOwnAchievement(): boolean {
    const u = this.user;
    if (!u) return false;
    const normalise = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const ownName = normalise([u.firstName || u.name, u.lastName].filter(Boolean).join(' '));
    return !!ownName && ownName === normalise(this.newAchievement.staffName);
  }

  getStaffInitials(name: string): string {
    if (!name) return '?';
    const parts = name.replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s+/i, '').trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
}

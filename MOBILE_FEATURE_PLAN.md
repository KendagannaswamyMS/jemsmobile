# Mobile plan based on the actual JEMS web frontend

Reference repository: `C:/Users/Kswamy_PC/Desktop/JEMS/JEMS`.
This plan comes from the existing Angular templates, routes, services and dashboard logic, rather than a generic campus-app wishlist. Proposed features below are not all implemented in the APK.

## Visual direction

Adapt the web student dashboard's teal `#125875`, deep teal `#0d3d50`, saffron accents, pale `#f1f4f8` canvas and outlined white cards. Use the faculty dashboard's greeting and task-first hierarchy. Mobile keeps larger touch targets, short cards and five primary navigation destinations instead of copying desktop tables and KPI rails.

## Faculty and staff

| Location | What to add | Existing web reference |
| --- | --- | --- |
| Home, first section | Pending CIE entry and question-paper tasks, each linking to its actual action | `features/faculty-dashboard/components/faculty-dashboard-home` attention cards |
| Home | Next teaching slot and daily punch status; distinguish teaching faculty from non-teaching staff | Faculty dashboard teaching tab and `features/dashboard/dashboard-home` |
| Teaching page | Subjects, sections, attendance marking, CIE deadlines and results | Faculty dashboard, faculty workload and academic modules |
| Mentoring page | Assigned mentees, upcoming sessions and session history | Faculty dashboard mentees and mentoring services |
| Profile page | Research/publications, citations, awards and certifications | `FacultyDashboardService` and its existing summary/profile endpoints |
| Staff Home | Circulars, notifications, upcoming events, punch status and leave | Main web dashboard; avoid faculty-only metrics for non-teaching roles |

The current mobile build already exposes timetable, attendance, leave, staff directory and campus services. The newly added shortcuts make those functions easier to reach. The web's academic attention cards still need their mobile action pages and permission checks before porting.

## Students

| Location | What to add | Existing web reference |
| --- | --- | --- |
| Home | Today's timetable and next class | `features/student/student-dashboard` day pills and week-slot logic |
| Home | Attendance, CGPA, credits earned and fee balance; show unavailable values honestly | Student dashboard KPI logic; validate each underlying data source before porting |
| Academics page | Subjects, learning content, marks and quizzes | Student routes `subjects`, `content-view/:nodeId`, `marks`, `quiz/:sessionId` |
| Fees page | Demands, paid amounts, balance, receipts and transactions | Student fee details and payment transactions pages |
| Campus page | Notices, academic calendar, clubs, events and mentoring | Existing student routes and components |
| Services page | Library loans/history/search, document requests, semester registration and placements | Student route configuration |
| Profile/settings | Academic identity, contact details and password management | Student profile and settings components |

Do not copy dashboard tiles blindly: the inspected web quick-link list has Hall Ticket, Library and Helpdesk items without a route. Library has separate real routes; Hall Ticket and Helpdesk need their destinations and availability checked.

## Important parity requirements

- The web treats alumni, autonomous archive and passed-out users as document-request-only accounts. Mobile must carry those login flags and enforce equivalent routing before extending the student portal to those users.
- The web has student first-login/password recovery flows that are not yet present in the APK.
- Faculty, non-teaching staff, HOD and administrative permissions must remain distinct. Do not infer access merely from a visible tile or expose university-wide HR statistics to every staff member.
- For Home, show a few actionable items and summaries. Keep full records in dedicated pages. Empty, failed and not-authorized states must remain distinct.

## Suggested delivery order

1. Current visual refresh and role-specific shortcuts; device check of login/keyboard behavior.
2. Real next-class cards for both roles and student subjects/marks pages, using the web's actual request/response contracts.
3. Fees/receipts and faculty attention workflows, with ownership and authorization tests.
4. Mentoring, library, notifications, placements and document requests, including alumni routing.

Source review does not establish that every web feature is deployed or every displayed metric is fully implemented. Each port needs API-contract and test-account validation.

Implementation caveats found in the web code: the faculty attention builder currently combines CIE and question-paper entries, even though the template supports additional kinds. Student fee KPI logic defaults a missing balance to zero and can say Fully paid without fee data; mobile must show unavailable instead. The student credit total also defaults to 160 and must use the actual programme requirement.


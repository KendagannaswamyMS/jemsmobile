# JEMS mobile review — 14 September 2026

Reviewed the Ionic/Capacitor app and relevant controllers in the sibling `jemsapisrv/jemswebapi` repository. This is a targeted source review, not a complete server security audit or a live production validation.

## Implemented

- Android keyboard insets now contribute to content padding so the keyboard does not cover the login form. Added `adjustResize`, Capacitor keyboard configuration, a compact short-screen layout, and explicit scrolling.
- Added accessible Show/Hide Password, keyboard Next/Go actions, named autofill fields, and student identifier guidance matching the backend. Passwords are not persisted by app code; password saving is delegated to the device's password manager.
- Removed authentication response logging, rejected tokenless login responses, prevented stale profile responses from replacing another user's session, and scoped bearer headers to the JEMS API.
- Preserved structured student-login 404 errors such as `NOT_REGISTERED` instead of treating them as missing routes.
- Added notice search, pull-to-refresh, request timeouts, retry feedback, keyboard-accessible expansion, and student-only targeting of the student-notice API.

## Priority follow-up work

1. **Server authorization:** `StudentNoticeController` has no controller/action authorization annotations, including its approver mutation and student-by-ID action. The inspected `Program.cs` configures JWT authentication but shows no fallback authorization policy. Validate any deployment-level protection and add role and student ownership checks with API tests before exposing these operations broadly. This review did not change backend files.
2. **Session persistence:** the app stores its token in localStorage and the server generates expiring JWTs. Implement a server-supported refresh/revocation flow and protected native token storage to support reliable long-lived sign-in. Saving the raw password in app storage is unnecessary.
3. **Account recovery:** bring the server's student access/recovery flows into mobile with contract tests; test staff and student sign-in with dedicated test accounts.
4. **Home content:** move the hard-coded staff news in `home.page.ts` to maintained API content. Add consistent retry/empty states to the remaining dashboard sections.
5. **Performance:** production builds currently warn that attendance, department master, home, and leave styles exceed their component budgets. Consolidate repeated styling before increasing budgets.

## Device acceptance checks

- On a small Android phone, open both sign-in modes, focus Password, rotate the device, and verify that Password and Sign In remain reachable by scrolling.
- Verify Next moves from identifier to password, Go submits once, and Show/Hide Password works with TalkBack.
- With Android autofill enabled, verify filling and saving credentials using the configured password manager. WebView autofill behavior needs device validation.
- Test successful staff/student login, wrong password, unregistered student, airplane mode, app restart, logout, and session expiry.
- Check notice search, pull-to-refresh, partial API failure, and attachments.

No Android device was connected during this review, so keyboard and autofill behavior have not been verified on hardware.

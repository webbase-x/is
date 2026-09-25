# P1 classroom extension

This extension is loaded from index.html and lesson.html. Book source data,
reading code, audio, and karaoke assets are unchanged.

- Google login uses a separate P1 auth storage key. It does not sign P2 out.
- Teacher authorization uses existing active teacher_profiles rows with
  can_record_scores and role teacher/admin. No new Google account can self-promote.
- Students use anonymous auth plus room+PIN or a 256-bit per-pupil token.
- QR credentials are in the URL fragment, removed after capture, generated locally.
- Only hashes of PINs/tokens are stored. Reissuing credentials revokes memberships.
- Rooms, pupils, drawings, and results are new P1 tables with RLS.
- p1_private.members and join_limits intentionally have no direct-access policies.
  Their security-definer handler always requires auth.uid() and validates owner or
  credential/membership before use. The public wrapper is security invoker.
- Tests use transactional fixtures and rollback, never production student records.
- Result integration is exposed as window.P1Classroom.saveResult; worksheet games
  are not included in this release. Existing reading scores are not reinterpreted.

## Validation

Google and anonymous providers enabled; transactional correct/incorrect PIN,
closed-room, individual-result and cross-owner RLS checks passed.

Run UI regressions: npm ci --prefix P1/tests && npm test --prefix P1/tests.
Run existing book check: node P1/tests/book-source-integrity.test.mjs.

## Rollback

Restore only the two HTML files from backup/p1-before-classroom-20260925 to stop
loading the extension. Do not drop new classroom tables: they may contain user
records. Existing book files need no rollback. The backup points to commit
471e9937d1e3bc2f8385d8210265584e3d861937.

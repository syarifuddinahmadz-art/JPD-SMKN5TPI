# Security Specification — JPD-SMK (Stage 1 + Stage 2A + Stage 2B + Stage 3)

## 1. Data Invariants
1. **Strict Identity Ownership (`users`, `teachingJournals`, `supervisions`)**:
   - `users/{userId}` creation requires `request.auth.uid == userId`, verified email, and `PENDING` role/status for non-bootstrapped users.
   - `teachingJournals/{journalId}` creation requires an approved `GURU` or `ADMIN`, and `incoming().teacherUid == request.auth.uid` strictly.
   - `supervisions/{supervisionId}` creation requires an approved `KEPALA_SEKOLAH` or `ADMIN`, and `incoming().supervisorUid == request.auth.uid` strictly.
2. **Admin-Only Master Data Mutations**: Only verified approved `ADMIN` users can create, update, or delete documents in `academicYears`, `teachers`, `classes`, `subjects`, and `schedules`.
3. **Referential Integrity**:
   - `TeachingSchedule` requires existing `academicYearId`, `teacherId`, `classId`, and `subjectId`.
   - `TeachingJournal` requires existing `academicYearId`, `classId`, `subjectId` (and `scheduleId` when non-empty).
   - `PrincipalSupervision` requires existing `academicYearId` (and `journalId` when non-empty).
4. **PII Isolation (`users`, `teachers`)**:
   - `users`: Only owner or admin can `get`, and `list` uses zero `get()`/`exists()` calls (`isBootstrappedAdmin()` or `resource.data.uid == request.auth.uid`).
   - `teachers`: `ADMIN`, `KEPALA_SEKOLAH` (for school-wide compliance monitoring), or the linked teacher (`resource.data.userUid == request.auth.uid`) can read.
5. **Strict Schema, Bounds & Immutability**: Every string/int field has explicit bounds, `date` enforces `YYYY-MM-DD`, `periodMonth` enforces `YYYY-MM`, `createdAt` & owner UID fields are immutable after creation, and `updatedAt == request.time`.
6. **Journal Ownership & Supervisory Read**: Teachers can read, update, and delete only their own `teachingJournals` (`teacherUid == request.auth.uid`). Approved `ADMIN` and `KEPALA_SEKOLAH` can list/get all `teachingJournals` and `journalPhotos` for principal monitoring, documentation gallery, and school reporting.

## 2. Adversarial Payloads Covered (Must Return PERMISSION_DENIED)
1. Teacher A creates or edits a `TeachingJournal` with `teacherUid: "teacherB_uid"` (identity spoofing).
2. Unapproved `PENDING` user or `KEPALA_SEKOLAH` attempts to create a `TeachingJournal`.
3. Teacher A attempts to update or delete Teacher B's `TeachingJournal`.
4. `GURU` or `PENDING` user attempts to create, update, or delete a `PrincipalSupervision` document.
5. `KEPALA_SEKOLAH` creates a `PrincipalSupervision` with `supervisorUid` set to another user's UID.
6. `PrincipalSupervision` submitted with non-existent `academicYearId` or non-existent `journalId`, or malformed `periodMonth` (`"2026-13"` / `"11-2026"`).
7. Ghost field injection (`{ verifiedByMinistry: true }`) into `teachingJournals` or `supervisions`.
8. Oversized strings (`activities` > 1500 chars, `notes` > 1000 chars in `supervisions`).
9. Forged client timestamps (`createdAt` / `updatedAt` != `request.time`).
10. Non-admin `GURU` attempting to list another teacher's `teachingJournals` or `journalPhotos`.
11. Unverified email attempting any read or write operation.

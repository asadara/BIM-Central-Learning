# Divisi BIM Workspace Blueprint

Tanggal: 10 Juli 2026

Dokumen ini merangkum keputusan blueprint untuk modul **Divisi BIM Workspace** di platform BCL. Modul ini dirancang sebagai area operasional internal Divisi BIM untuk task, worklog, risalah rapat, issue, dashboard, dan report.

## 1. Positioning

**Divisi BIM Workspace** adalah modul operasional internal di dalam BCL.

Tujuan utamanya:
- memberi visibility pekerjaan Divisi BIM;
- mencatat task dan progres;
- mencatat worklog harian staff BIM;
- mengelola risalah rapat sesuai form standar perusahaan;
- mendokumentasikan issue internal Divisi BIM;
- menyediakan dashboard dan report operasional sederhana.

Modul ini bukan pengganti sistem KPI resmi perusahaan, bukan risk register departemen, dan bukan project management kompleks seperti Jira.

## 2. Navigasi

Keputusan navigasi:

```text
Navbar parent: Divisi BIM
Submenu: Workspace
Nama halaman: Divisi BIM Workspace
URL: /pages/divisi-bim-workspace.html
Navigasi internal: sidebar
Access flag: bimWorkspaceAccess
```

Sidebar internal:

```text
Dashboard
Task Scheduler
Worklog
Risalah Rapat
Issues
Reports
Workspace Settings
```

## 3. Access Model

Prinsip akses:
- hanya staff BIM dan role terkait yang bisa masuk;
- user selain staff BIM tidak bisa akses;
- Kepala Divisi BIM bisa melihat dan melakukan approval;
- Kepala Departemen Engineering bisa view summary;
- viewer hanya read-only;
- user yang bisa input harus user asli BCL, bukan viewer.

Role behavior awal:

```text
Staff BIM:
- lihat workspace
- input worklog
- submit issue
- lihat progress umum

Kepala Divisi BIM:
- lihat semua detail
- approve task
- accept/reject issue
- approve closure issue
- review action item

Kepala Departemen Engineering:
- summary/read-only
- lihat progress, overdue, blocked, issue penting, output utama

Viewer:
- read-only
```

## 4. Task Scheduler

Task Scheduler berbasis periode bulanan.

Keputusan utama:

```text
Base period: monthly
Grouping: per minggu + task list
Default month state: empty
Project: manual text
Official owner: Kepala Divisi BIM
PIC: optional manual text/user reference later
Task closure: requires approval/review
Carry-forward: outstanding task bulan sebelumnya
Routine generation: user-triggered from previous month
```

Task bisa berdurasi:
- 1-3 hari;
- 1-2 minggu;
- hampir sebulan;
- lintas bulan;
- rutin seperti monitoring dan koordinasi.

Status task:

```text
planned
in_progress
blocked
submitted_for_review
approved_done
rejected_revision
cancelled
```

UI label:

```text
Planned
In Progress
Blocked
Review
Done
Revision
Cancelled
```

Task type:

```text
project_task
tender_support
routine_monitoring
coordination
review
reporting
support
internal_admin
other
```

Monthly behavior:
- bulan baru default kosong;
- outstanding task bulan sebelumnya ditawarkan untuk carry-forward;
- routine task bulan sebelumnya bisa digenerate hanya jika user memilih;
- outstanding task adalah task yang statusnya bukan `approved_done` atau `cancelled`.

## 5. Worklog

Worklog adalah catatan harian pelaksanaan task.

Keputusan utama:

```text
Mode: harian
PIC: pilih dari user BCL
Hours spent: aktif sejak awal
Task item: linked task atau manual task item
```

Required fields:

```text
Do Date
Task Item
PIC User
Task Status
Hours Spent
Work Summary
```

Optional fields:

```text
Project
Output / Result
Blocker
Next Action
Evidence Link
Worklog Type
Remarks
```

Worklog type:

```text
progress_update
coordination
review
revision
monitoring
reporting
support
issue_followup
other
```

Rules:
- worklog selalu satu tanggal, bukan rentang tanggal;
- task beberapa hari diisi dengan beberapa worklog harian;
- worklog bisa update status task, tetapi tidak bisa approve task menjadi done;
- task closure tetap lewat approval Task Scheduler.

## 6. Risalah Rapat

Risalah Rapat mengikuti form standar perusahaan:

```text
FRM.NKE.01.06 Risalah Rapat RevA
```

Label sidebar:

```text
Risalah Rapat
```

Nomor risalah auto-generate dari tanggal pembuatan dengan format:

```text
NN/BIM/MM_ROMAWI/YYYY
```

Contoh:

```text
01/BIM/VII/2026
02/BIM/VII/2026
```

Rule penting dari template:

```text
Item risalah sebelumnya yang masih dalam proses / belum closed harus dimunculkan kembali dalam item tindak lanjut risalah berikutnya.
```

Workflow:

```text
Buat Risalah Rapat
-> isi header rapat
-> isi peserta / tidak hadir / CC
-> isi risalah saat ini
-> buat action item
-> tarik ulang action item lama yang belum closed
-> review / close action
-> print/export sesuai form standar
```

Action item dari Risalah Rapat bisa dikonversi menjadi task.

## 7. Issues

Issues dibuat untuk dokumentasi issue internal Divisi BIM.

Scope:
- bukan risk register formal departemen;
- bukan NCR formal;
- bukan full RFI/change management;
- bisa menampung masalah koordinasi, model, data, drawing, workflow, resource, dan risk note ringan.

Keputusan utama:

```text
Owner issue: optional
Create issue: semua user BCL dengan akses Divisi BIM Workspace, kecuali viewer
Acceptance: perlu approval Kepala Divisi BIM
Closure: perlu approval Kepala Divisi BIM
```

Issue type:

```text
internal_issue
coordination_issue
model_issue
data_issue
drawing_issue
workflow_issue
resource_issue
risk_note
other
```

Severity:

```text
low
medium
high
critical
```

Status:

```text
draft
submitted
accepted
action_required
resolved_pending_approval
closed
rejected
cancelled
```

Issue aktif hanya setelah status `accepted`.

Issue bisa:
- dibuat manual;
- berasal dari task;
- berasal dari worklog;
- berasal dari risalah/action meeting;
- melahirkan task baru.

## 8. Dashboard

Dashboard adalah wajah utama Divisi BIM Workspace.

Prinsip:

```text
Dashboard = visibility dan progress, bukan timesheet atau KPI formal.
```

Management cukup melihat:
- Divisi sedang mengerjakan apa;
- progress sampai mana;
- apa yang terlambat/terhambat;
- issue penting apa;
- action meeting apa yang masih terbuka.

Dashboard structure:

```text
1. Header Periode
2. Ringkasan Bulanan
3. Pekerjaan Berjalan
4. Perlu Perhatian
5. Output Terbaru
6. Issue Terbuka
7. Tindak Lanjut Rapat
8. Aktivitas Terbaru
```

Dashboard indicators sederhana:

```text
Task Completion %
On-Time Completion %
Pending Approval count
Overdue Task count
Blocked Task count
```

Tidak masuk MVP:
- score personal;
- ranking staff;
- weighted KPI;
- productivity score dari hours;
- integrasi KPI resmi Divisi/Departemen.

Worklog hours:
- staff/PIC bisa melihat jam miliknya sendiri;
- Kepala Divisi/Kepala Departemen fokus ke progress dan output, bukan detail jam.

## 9. Database Schema v0.1

Core tables:

```text
bim_ops_tasks
bim_ops_worklogs
bim_ops_meetings
bim_ops_meeting_attendees
bim_ops_meeting_actions
bim_ops_issues
bim_ops_activity_log
```

Prinsip schema:
- source of truth PostgreSQL;
- tidak perlu tabel `bim_ops_periods` untuk MVP;
- evidence cukup satu `evidence_link` per item;
- activity log masuk sejak awal, minimal untuk status dan approval;
- `official_owner_name = Kepala Divisi BIM` sebagai default/config sederhana;
- project masih manual text;
- user internal mengacu ke user BCL existing, dengan snapshot nama untuk histori.

### 9.1 bim_ops_tasks

```text
id
period_month
week_bucket
title
description
project_name
task_type
official_owner_name
pic_user_id
pic_name_snapshot
start_date
due_date
priority
status
requires_review
submitted_at
approved_by_user_id
approved_by_name_snapshot
approved_at
review_note
rejected_by_user_id
rejected_by_name_snapshot
rejected_at
rejection_note
is_routine
is_recurring_candidate
carried_from_task_id
source_type
source_id
evidence_link
created_by_user_id
created_by_name_snapshot
created_at
updated_at
completed_at
```

### 9.2 bim_ops_worklogs

```text
id
work_date
period_month
task_id
task_item_text
project_name
pic_user_id
pic_name_snapshot
worklog_type
task_status
hours_spent
work_summary
output_result
blocker
next_action
evidence_link
remarks
updates_task_status
previous_task_status
new_task_status
created_by_user_id
created_by_name_snapshot
created_at
updated_at
```

### 9.3 bim_ops_meetings

```text
id
meeting_no
period_month
subject
scope_type
project_name
day_name
meeting_date
start_time
end_time
place
reported_by_name
reported_by_position
acknowledged_by_name
acknowledged_by_position
department_division
reference_memo_no
reference_agenda_no
reference_archive_no
status
created_by_user_id
created_by_name_snapshot
created_at
updated_at
issued_at
closed_at
```

### 9.4 bim_ops_meeting_attendees

```text
id
meeting_id
user_id
name
initial
attendance_status
position
company_or_division
created_at
updated_at
```

### 9.5 bim_ops_meeting_actions

```text
id
meeting_id
source_meeting_id
carried_from_action_id
section_type
description
action_owner_name
action_owner_user_id
planned_due_date
reviewer_name
reviewer_user_id
review_result
review_note
review_date
status
created_task_id
evidence_link
created_by_user_id
created_by_name_snapshot
created_at
updated_at
closed_at
```

### 9.6 bim_ops_issues

```text
id
issue_date
period_month
title
description
issue_type
project_context
severity
status
reported_by_user_id
reported_by_name_snapshot
owner_user_id
owner_name_snapshot
due_date
impact_note
action_note
mitigation_note
resolution_note
evidence_link
source_type
source_id
created_task_id
submitted_at
accepted_by_user_id
accepted_by_name_snapshot
accepted_at
acceptance_note
rejected_by_user_id
rejected_by_name_snapshot
rejected_at
rejection_reason
closure_requested_by_user_id
closure_requested_by_name_snapshot
closure_requested_at
closure_note
closed_by_user_id
closed_by_name_snapshot
closed_at
closure_approval_note
created_by_user_id
created_by_name_snapshot
created_at
updated_at
```

### 9.7 bim_ops_activity_log

```text
id
entity_type
entity_id
action
summary
metadata_json
actor_user_id
actor_name_snapshot
created_at
```

## 10. Reports Direction

Reports belum difinalkan. Kandidat report MVP:

```text
Monthly Task Report
PIC Worklog Report
Issue Register
Risalah Rapat Print View
Meeting Action Follow-up Report
Outstanding Task/Issue Report
```

Prinsip report:
- operasional internal;
- bukan KPI resmi perusahaan;
- cukup jelas untuk kepala divisi dan kepala departemen;
- bisa dimulai dari table/filter/export CSV/print.

## 11. Next Discussion

Urutan pembahasan berikutnya:

```text
1. Reports MVP
2. Sidebar final
3. Permission/access final
4. Implementation phases
5. SQL migration and API design
6. UI wireframe
```


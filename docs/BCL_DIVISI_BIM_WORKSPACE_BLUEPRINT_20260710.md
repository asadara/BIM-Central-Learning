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
KPI
Reports
Workspace Settings
```

Status implementasi KPI per 13 Juli 2026:
- menu KPI tersedia pada grup Pelaporan;
- halaman menyediakan tab Overview, Departemen, Divisi BIM, Individu, serta Program & Aktivitas;
- 10 KPI Departemen Engineering dan 10 KPI Divisi BIM tahun 2026 sudah tersedia dari workbook referensi;
- KPI Divisi memiliki relasi eksplisit ke KPI Departemen: `direct`, `scoped_rollup`, atau `contribution`;
- KPI Individu dibentuk dari program Divisi yang diambil staff atau didelegasikan Kepala Divisi BIM;
- Staff BIM dapat `raise hand` pada program berstatus `open` dengan `claim_policy=staff_proposable`, termasuk sebelum target program Divisi ditetapkan;
- target program Divisi wajib ditetapkan Kepala Divisi saat review sebelum usulan staff dapat disetujui;
- program `owner_only/delegation_only` tidak dapat diambil staff dan hanya dapat didelegasikan Kepala Divisi;
- Coverage Matrix memisahkan target teralokasi dari actual terverifikasi dan menandai program yang belum disentuh;
- Task dapat ditautkan ke satu kontribusi KPI approved milik PIC;
- formula Excel yang rusak tidak diimpor; sistem memakai calculation contract terstruktur di PostgreSQL.

## 3. Access Model

Prinsip akses:
- hanya staff BIM dan role terkait yang bisa masuk;
- user selain staff BIM tidak bisa akses;
- Kepala Divisi BIM bisa melihat dan melakukan approval;
- Kepala Departemen Engineering bisa view summary;
- viewer hanya read-only;
- user yang bisa input harus user asli BCL, bukan viewer;
- identitas dari token user BCL aktif diprioritaskan terhadap cookie Admin Panel yang mungkin masih tersimpan;
- role global BCL dan `bim_workspace_role` adalah dua domain berbeda;
- user dengan hak administrasi global tetap memakai role Workspace tersimpan ketika `bim_workspace_access=true`;
- `system_admin` hanya menjadi fallback Workspace untuk administrator yang tidak memiliki assignment role Workspace eksplisit.

Role behavior awal:

```text
Staff BIM:
- lihat workspace
- lihat task kolektif Divisi BIM
- membuat dan mengajukan task baru
- memperbaiki task yang dikembalikan untuk revisi
- update task yang menjadi tanggung jawabnya
- input worklog
- submit issue
- raise hand / mengajukan kontribusi pada program KPI yang terbuka
- lihat progress umum

Kepala Divisi BIM:
- lihat semua detail
- review, koreksi, approve, atau reject input task staff
- membuat task yang langsung tercatat sebagai approved
- approve task
- accept/reject issue
- approve closure issue
- review action item
- menetapkan target program serta approve/revisi/reject kontribusi KPI staff

Kepala Departemen Engineering:
- summary/read-only
- lihat progress, overdue, blocked, issue penting, output utama

Viewer:
- read-only
```

System Administrator BCL dapat mengelola akun, access flag, dan pemulihan data, tetapi bukan business approver. Override darurat harus dicatat di activity log.

### 3.1 Workspace Access Fields

```text
bim_workspace_access = true / false
bim_workspace_role = staff_bim | division_head | department_head | viewer
```

Semua route workspace wajib memverifikasi login, access flag, dan workspace role di backend. Menyembunyikan tombol di frontend bukan pengganti authorization backend.

### 3.2 Permission Matrix

| Modul/Aksi | Staff BIM | Kepala Divisi | Kepala Departemen | Viewer |
|---|---|---|---|---|
| Dashboard summary | Lihat | Lihat | Lihat | Lihat |
| Dashboard detail | Sesuai akses | Semua | Summary | Summary |
| Task kolektif | Lihat semua | Lihat semua | Read-only | Read-only |
| Buat task | Ya | Ya | Tidak | Tidak |
| Edit task draft | Creator sendiri | Semua | Tidak | Tidak |
| Update progres task | Creator/PIC | Semua | Tidak | Tidak |
| Approve input task | Tidak | Ya | Tidak | Tidak |
| Approve task selesai | Tidak | Ya | Tidak | Tidak |
| Input/edit worklog | Milik sendiri | Milik sendiri | Tidak | Tidak |
| Lihat hours | Hours sendiri | Hours sendiri | Tidak | Tidak |
| Lihat output worklog | Output divisi | Semua output | Summary | Summary terbatas |
| Buat draft Risalah | Ya | Ya | Tidak | Tidak |
| Edit draft Risalah | Creator sendiri | Semua | Tidak | Tidak |
| Issue/close Risalah | Tidak | Ya | Tidak | Tidak |
| Print Risalah issued | Ya | Ya | Ya | Jika diberi akses |
| Buat issue | Ya | Ya | Tidak | Tidak |
| Edit issue draft | Reporter sendiri | Semua | Tidak | Tidak |
| Accept/reject issue | Tidak | Ya | Tidak | Tidak |
| Request closure | Reporter/owner | Ya | Tidak | Tidak |
| Approve closure | Tidak | Ya | Tidak | Tidak |
| Reports personal | Ya | Ya | Tidak | Tidak |
| Reports divisi | Summary | Semua | Summary | Summary terbatas |
| Export | Data yang diizinkan | Semua | Summary | Tidak |
| Workspace settings | Tidak | Konfigurasi operasional | Tidak | Tidak |

### 3.3 Record Visibility

- task approved bersifat kolektif dan terlihat seluruh staff BIM;
- draft task hanya terlihat creator dan Kepala Divisi;
- draft Risalah hanya terlihat creator dan Kepala Divisi;
- Risalah issued terlihat seluruh user workspace;
- draft/rejected issue hanya terlihat reporter dan Kepala Divisi;
- issue accepted terlihat seluruh staff workspace;
- hours worklog hanya dikirim API kepada PIC pemiliknya.

### 3.4 Locking, Audit, and Delete Policy

- worklog terkunci setelah task berstatus `approved_done`;
- task pending approval dikunci untuk staff sampai dikembalikan sebagai revision;
- Risalah issued dikoreksi melalui revisi, bukan overwrite langsung;
- issue closed hanya dapat dibuka kembali Kepala Divisi dengan alasan;
- approve, reject, correction, cancel, reopen, dan export dicatat di activity log;
- tidak ada hard delete dari UI;
- record memakai status cancelled, archived, corrected, voided, atau revised sesuai jenisnya;
- Admin BCL mengatur access flag dan workspace role;
- Kepala Divisi mengatur konfigurasi operasional, bukan akun atau hak akses user.

## 4. Task Scheduler

Task Scheduler berbasis periode bulanan.

Keputusan utama:

```text
Base period: monthly
Grouping: per minggu + task list
Default month state: empty
Project: manual text
Official owner: Kepala Divisi BIM
PIC: wajib; creator sendiri untuk task staff atau user Staff BIM yang dipilih Kepala Divisi
Task visibility: kolektif untuk seluruh staff Divisi BIM Workspace
Task input: staff BIM dan Kepala Divisi BIM
Task delegation: hanya Kepala Divisi BIM kepada user aktif ber-role Staff BIM
Task intake approval: Kepala Divisi BIM
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

Approval input task dipisahkan dari status pelaksanaan:

```text
draft
pending_approval
approved
revision_required
rejected
```

Workflow input task:

```text
Staff membuat draft task
-> Staff submit untuk approval
-> Kepala Divisi review dan dapat melakukan koreksi
-> Approve menjadi task aktif, atau kembalikan untuk revision
-> Task yang rejected tidak masuk pekerjaan aktif
```

Task yang dibuat langsung oleh Kepala Divisi dapat berstatus `approved` dengan audit actor tetap tercatat.

Aturan penugasan:

- task yang dibuat Staff BIM otomatis memakai creator sebagai PIC dan tidak dapat didelegasikan kepada user lain;
- task staff adalah usulan pribadi sampai disetujui Kepala Divisi;
- Kepala Divisi dapat memilih `Task saya` atau `Delegasikan ke Staff BIM` saat membuat atau mengoreksi task;
- delegasi mencatat pemberi tugas, PIC, dan waktu delegasi;
- perubahan PIC oleh Kepala Divisi dicatat sebagai aktivitas delegasi baru.

### 4.1 Task dan KPI Alignment

Setelah master KPI disahkan, setiap task approved harus memiliki salah satu klasifikasi berikut:

```text
KPI-linked task       -> terkait KPI Divisi dan indikator KPI individu PIC
Non-KPI operational  -> tetap sah, tetapi wajib memiliki alasan operasional
Pending KPI mapping  -> task usulan staff yang belum diputuskan Kepala Divisi
```

Prinsip alignment:

- staff dapat mengusulkan kontribusi pada program yang dibuka Kepala Divisi;
- Kepala Divisi dapat mendelegasikan program langsung kepada staff serta mengoreksi target, bobot, due date, dan evidence;
- mapping task hanya dapat memakai kontribusi KPI milik PIC yang sudah approved;
- task di luar pengetahuan Kepala Divisi tidak mendapat KPI credit sebelum direview;
- completion task dan evidence menjadi sumber realisasi, tetapi tidak otomatis menjadi score KPI;
- KPI credit hanya berasal dari actual yang diverifikasi Kepala Divisi agar pekerjaan tidak dihitung ganda;
- task non-KPI tetap diperbolehkan untuk kebutuhan insidental, dengan alasan dan audit trail yang jelas.

### 4.2 KPI Program dan Individu

Hierarki operasional:

```text
KPI Departemen -> KPI Divisi BIM -> Program -> Komitmen Individu -> Task -> Evidence -> Actual Terverifikasi
```

Aturan:
- satu program master mewakili satu KPI Divisi BIM pada siklus 2026;
- target operasional program ditetapkan Kepala Divisi dan tidak mengubah target scorecard resmi;
- program dapat `open` untuk usulan staff atau `closed`/`delegation_only`;
- satu staff hanya memiliki satu komitmen aktif per program dan maksimal lima komitmen aktif;
- total bobot approved per scorecard individu tidak boleh melebihi 100%;
- Coverage mengukur target yang sudah dialokasikan, sedangkan Realization hanya memakai actual terverifikasi;
- achievement individu dibatasi 120% dan weighted score memakai bobot approved;
- state review: `pending_approval`, `revision_required`, `approved`, `verification_pending`, `achieved`, atau `rejected`.

### 4.3 KPI Calculation Contract

Master awal memakai scorecard 2026 dari workbook `Scorecard & KPI (Departemen - Individu).xlsx`.

Kaidah perhitungan:

```text
Hasil Pengukuran = dihitung sesuai jenis indikator
Achievement      = MIN(Hasil Pengukuran / Target, 120%)
Weighted Score   = SUM(Achievement indikator x Bobot indikator)
```

Guardrails:
- total bobot setiap scorecard harus 100%;
- pembagi nol atau data kosong menghasilkan `belum terukur`, bukan 0%;
- achievement setiap indikator dibatasi 120%;
- `ratio_of_sums` dipakai untuk rasio event dan volume YTD;
- `latest_checkpoint` dipakai untuk target milestone kumulatif digitalisasi;
- `average_components` dan `average_period_scores` dipakai untuk Quality Survey dan PMP;
- `cumulative_count` dipakai untuk inovasi, bukan nilai maksimum bulanan;
- target PMP disimpan dalam skala konsisten `0..1`, sehingga 70% disimpan sebagai `0.70`;
- KPI Departemen tidak dijumlahkan langsung dari skor tiga divisi tanpa aturan konsolidasi resmi.

Relasi KPI Divisi ke Departemen:

```text
direct         = Divisi BIM menjadi pemilik langsung hasil indikator
scoped_rollup  = hasil Divisi BIM menjadi bagian terukur dari hasil Departemen
contribution   = aktivitas Divisi mendukung KPI Departemen tetapi skor tidak diwariskan 1:1
```

Setelah task aktif, staff creator/PIC dapat memperbarui progres dan mengirim task untuk completion review. Approval penyelesaian tetap dilakukan Kepala Divisi.

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

Worklog adalah rekapan harian pelaksanaan aktivitas operasional yang bersumber dari Task, kontribusi KPI, Issue, action Risalah Rapat, atau aktivitas manual yang memiliki alasan operasional.

Keputusan utama:

```text
Mode: harian
PIC: mengikuti owner/PIC sumber dan user BCL yang login
Hours spent: privat, hanya terlihat oleh user pemilik
Sumber resmi: Task, KPI Assignment, Issue, Meeting Action
Fallback: manual dengan alasan/konteks operasional wajib
```

Alur data:

```text
Activity Log -> Activity Event -> Daily Worklog Auto Draft -> Konfirmasi PIC -> Report
```

Activity event dibagi menjadi:
- `planning`: penugasan, usulan, approval intake, dan konfigurasi; termonitor tetapi tidak dihitung sebagai pekerjaan;
- `execution`: update progress/output oleh PIC/owner; dapat membentuk draft Worklog;
- `verification`: approval, review, closure, atau verifikasi oleh Kepala Divisi; termonitor tetapi tidak membentuk jam kerja staff.

Required fields:

```text
Do Date
Task Item
PIC User
Task Status
Hours Spent
Work Summary
Source Type
Source ID
Confirmation Status
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
- event eksekusi dikonsolidasikan menjadi satu Worklog per tanggal, PIC, source type, dan source ID;
- hanya event eksekusi yang dilakukan PIC/owner sumber yang membentuk auto draft;
- auto draft wajib dikonfirmasi PIC sebelum masuk Dashboard output dan Reports;
- planning dan verification tetap terlihat pada Activity Feed, tetapi tidak dihitung sebagai Worklog resmi;
- private hours disimpan terpisah dan tidak dapat dilihat Kepala Divisi/Kepala Departemen;
- aktivitas manual tidak boleh dipakai sebagai jalur task random; alasan/konteks operasional wajib diisi;
- worklog bisa update status task, tetapi tidak bisa approve task menjadi done;
- task closure tetap lewat approval Task Scheduler;
- Worklog tidak otomatis memberikan achievement atau score KPI. Credit KPI tetap melalui actual submission dan verifikasi KPI.

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

Tidak masuk dashboard operasional:
- score personal;
- ranking staff;
- productivity score dari hours;
- detail score KPI; scorecard dibuka melalui menu KPI.

Worklog hours:
- staff/PIC bisa melihat jam miliknya sendiri;
- Kepala Divisi/Kepala Departemen fokus ke progress dan output, bukan detail jam.

## 9. Database Schema v0.1

Core tables:

```text
bim_ops_tasks
bim_ops_worklogs
bim_ops_worklog_time
bim_ops_activity_events
bim_ops_meetings
bim_ops_meeting_attendees
bim_ops_meeting_actions
bim_ops_issues
bim_ops_activity_log
bim_kpi_scorecards
bim_kpi_indicators
```

Prinsip schema:
- source of truth PostgreSQL;
- tidak perlu tabel `bim_ops_periods` untuk MVP;
- evidence cukup satu `evidence_link` per item;
- activity log masuk sejak awal, minimal untuk status dan approval;
- activity event bersifat immutable dan menjadi sumber Activity Feed;
- jam Worklog disimpan di tabel privat terpisah;
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
intake_status
intake_submitted_at
intake_reviewed_by_user_id
intake_reviewed_by_name_snapshot
intake_reviewed_at
intake_review_note
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
work_summary
output_result
blocker
next_action
evidence_link
remarks
source_type
source_id
kpi_assignment_id
issue_id
meeting_action_id
entry_origin
confirmation_status
confirmed_at
progress_before
progress_after
system_summary
event_count
auto_key
created_by_user_id
created_by_name_snapshot
created_at
updated_at
```

### 9.3 bim_ops_worklog_time

```text
worklog_id
user_id
hours_spent
created_at
updated_at
```

Primary key adalah kombinasi `worklog_id` dan `user_id`. API hanya melakukan join terhadap `user_id` dari user yang sedang login.

### 9.4 bim_ops_activity_events

```text
id
event_type
activity_class
source_type
source_id
actor_user_id
actor_name_snapshot
pic_user_id
pic_name_snapshot
project_context
event_date
occurred_at
summary
output_snapshot
progress_snapshot
status_snapshot
evidence_link
metadata_json
deduplication_key
counts_as_work
consolidated_worklog_id
created_at
```

### 9.5 bim_ops_meetings

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

### 9.6 bim_ops_meeting_attendees

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

### 9.7 bim_ops_meeting_actions

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

### 9.8 bim_ops_issues

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

### 9.9 bim_ops_activity_log

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

### 9.10 bim_kpi_scorecards

```text
id
period_year
level
org_unit
title
status
max_achievement
source_reference
created_at
updated_at
```

### 9.11 bim_kpi_indicators

```text
id
scorecard_id
parent_indicator_id
code
sort_order
perspective_code
perspective_name
indicator_name
program_name
relation_type
measurement_formula
achievement_formula
aggregation_method
zero_denominator_policy
target_operator
target_value
target_unit
weight
calculation_config
source_reference
is_active
created_at
updated_at
```

### 9.12 bim_kpi_programs

```text
id
period_year
division_indicator_id
code
sort_order
program_name
allocation_mode
claim_policy
availability_status
target_value
target_unit
is_active
created_at
updated_at
```

### 9.13 bim_kpi_individual_scorecards

```text
id
period_year
staff_user_id
staff_name_snapshot
status
created_at
updated_at
```

### 9.14 bim_kpi_assignments

```text
id
scorecard_id
program_id
division_indicator_id
staff_user_id
staff_name_snapshot
commitment_title
measurement_type
target_value
target_unit
proposed_weight
approved_weight
due_date
expected_evidence
status
submitted_actual
actual_evidence_link
actual_note
verified_actual
achievement
weighted_score
review_note
created_by_user_id
delegated_by_user_id
approved_by_user_id
verified_by_user_id
created_at
updated_at
```

## 10. Reports MVP

Reports MVP sudah dikunci menjadi empat keluaran:

```text
1. Ringkasan Bulanan Divisi
2. Laporan Progress Task
3. Laporan Worklog
4. Laporan Outstanding
```

### 10.1 Ringkasan Bulanan Divisi

Report default untuk Kepala Divisi BIM dan Kepala Departemen Engineering.

Isi:
- pekerjaan bulan berjalan;
- task completion dan on-time completion;
- task overdue atau blocked;
- issue penting yang sudah accepted;
- tindak lanjut rapat yang belum closed;
- output utama dari worklog.

Format awal dibuat print-friendly dan dapat disimpan sebagai PDF melalui browser.

### 10.2 Laporan Progress Task

Daftar task berdasarkan periode dengan field utama:

```text
Task
Project / Context
PIC
Start Date
Due Date
Status
Progress
Approval Status
```

Mendukung filter periode, project, PIC, status, priority, dan export CSV.

### 10.3 Laporan Worklog

Aturan visibility:
- staff BIM hanya melihat detail worklog dan hours miliknya sendiri;
- Kepala Divisi dan Kepala Departemen melihat progress dan output per task/PIC tanpa detail hours.

Mendukung filter periode, PIC, task, project, status, dan export CSV sesuai permission.

### 10.4 Laporan Outstanding

Menggabungkan item yang masih memerlukan perhatian:
- task overdue atau blocked;
- issue accepted/action required yang belum closed;
- action item Risalah Rapat yang belum closed.

### 10.5 Report Guardrails

- report bersifat operasional internal, bukan KPI resmi perusahaan;
- default periode adalah bulanan;
- data operasional dapat diekspor CSV;
- summary manajemen dibuat print-friendly;
- generator Word/Excel kompleks belum masuk MVP;
- print Risalah Rapat sesuai `FRM.NKE.01.06` tetap berada di menu Risalah Rapat, bukan digandakan di Reports.

## 11. Implementation Status

MVP pertama diimplementasikan pada 13 Juli 2026 dengan cakupan:

- menu `Divisi BIM > Workspace` yang hanya tampil untuk user berizin;
- role `Staff BIM`, `Kepala Divisi BIM`, `Kepala Departemen Engineering`, dan `Viewer`;
- pengaturan akses dan role melalui User Management BCL;
- Dashboard operasional bulanan;
- Task Scheduler dengan approval input, completion review, dan carry-forward;
- Worklog source-driven dengan Activity Feed lintas modul, auto draft harian, konfirmasi PIC, fallback manual terkontrol, dan private hours terpisah;
- Risalah Rapat berbasis `FRM.NKE.01.06`, nomor otomatis, action item, dan print;
- Issues dengan acceptance dan closure approval Kepala Divisi;
- KPI 2026 untuk Departemen Engineering dan Divisi BIM dengan formula terstruktur dan cap achievement 120%;
- master 10 program KPI Divisi, Coverage Matrix, target operasional, serta status coverage dan realization;
- KPI Individu dari take/delegation program, approval/revision Kepala Divisi, actual, evidence, dan verified score;
- linkage satu kontribusi KPI approved per task dengan validasi kepemilikan PIC;
- Reports bulanan, progress task, output worklog, outstanding, print, dan CSV;
- activity log untuk audit perubahan penting dan approval;
- immutable operational activity event untuk planning, execution, dan verification.

Implementasi berada pada:

```text
Frontend : BC-Learning-Main/pages/divisi-bim-workspace.html
API      : /api/bim-workspace
Schema   : bim_ops_* dan bim_kpi_*
```

Tahap berikutnya adalah menetapkan target operasional program dan user Staff BIM pada akun nyata, lalu user acceptance test untuk role Staff BIM, Kepala Divisi BIM, serta Kepala Departemen Engineering.

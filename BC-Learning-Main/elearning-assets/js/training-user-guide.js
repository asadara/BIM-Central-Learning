(function () {
   const GUIDE_ID = 'bcl-training-user-guide';

   function createStep(number, icon, title, description, meta) {
      return `
         <article class="training-guide-step">
            <div class="training-guide-step__number">${number}</div>
            <div class="training-guide-step__body">
               <div class="training-guide-step__title">
                  <i class="${icon}" aria-hidden="true"></i>
                  <span>${title}</span>
               </div>
               <p>${description}</p>
               ${meta ? `<small>${meta}</small>` : ''}
            </div>
         </article>
      `;
   }

   function injectStyles() {
      if (document.getElementById(`${GUIDE_ID}-styles`)) return;

      const style = document.createElement('style');
      style.id = `${GUIDE_ID}-styles`;
      style.textContent = `
         .training-user-guide {
            margin: 2rem auto;
            padding: 0 2rem;
            max-width: 1220px;
         }

         .training-user-guide__panel {
            background: #ffffff;
            border: 1px solid #dbe3ea;
            border-left: 5px solid var(--main-color, #007bff);
            border-radius: 8px;
            box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
            overflow: hidden;
         }

         .training-user-guide__header {
            display: flex;
            justify-content: space-between;
            gap: 1rem;
            align-items: flex-start;
            padding: 1.5rem 1.75rem;
            background: linear-gradient(135deg, #f8fbff 0%, #eef5fb 100%);
            border-bottom: 1px solid #dbe3ea;
         }

         .training-user-guide__eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.45rem;
            color: var(--main-color, #007bff);
            font-size: 1.1rem;
            font-weight: 700;
            text-transform: uppercase;
         }

         .training-user-guide h2 {
            margin: 0;
            color: #1f2937;
            font-size: 1.9rem;
            line-height: 1.25;
         }

         .training-user-guide__summary {
            margin: 0.55rem 0 0;
            color: #4b5563;
            font-size: 1.35rem;
            line-height: 1.6;
         }

         .training-user-guide__toggle {
            flex: 0 0 auto;
            border: 1px solid #cbd5e1;
            background: #ffffff;
            color: #1f2937;
            border-radius: 6px;
            padding: 0.75rem 1rem;
            font-size: 1.25rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
         }

         .training-user-guide__toggle:hover,
         .training-user-guide__toggle:focus {
            border-color: var(--main-color, #007bff);
            color: var(--main-color, #007bff);
            outline: none;
         }

         .training-user-guide__content {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 320px;
            gap: 1.5rem;
            padding: 1.75rem;
         }

         .training-guide-steps {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
         }

         .training-guide-step {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr);
            gap: 0.9rem;
            padding: 1rem;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
         }

         .training-guide-step__number {
            width: 42px;
            height: 42px;
            display: grid;
            place-items: center;
            border-radius: 50%;
            background: #eef6ff;
            color: var(--main-color, #007bff);
            font-size: 1.35rem;
            font-weight: 800;
         }

         .training-guide-step__title {
            display: flex;
            align-items: center;
            gap: 0.55rem;
            color: #111827;
            font-size: 1.35rem;
            font-weight: 800;
            line-height: 1.3;
         }

         .training-guide-step__title i {
            color: var(--main-color, #007bff);
         }

         .training-guide-step p {
            margin: 0.35rem 0 0;
            color: #4b5563;
            font-size: 1.2rem;
            line-height: 1.55;
         }

         .training-guide-step small {
            display: block;
            margin-top: 0.45rem;
            color: #6b7280;
            font-size: 1.05rem;
            line-height: 1.45;
         }

         .training-guide-side {
            border: 1px solid #dbe3ea;
            border-radius: 8px;
            background: #f9fafb;
            padding: 1rem;
         }

         .training-guide-side h3 {
            margin: 0 0 0.8rem;
            color: #111827;
            font-size: 1.35rem;
         }

         .training-guide-side dl {
            margin: 0;
         }

         .training-guide-side dt {
            margin-top: 0.85rem;
            color: #111827;
            font-size: 1.15rem;
            font-weight: 800;
         }

         .training-guide-side dt:first-child {
            margin-top: 0;
         }

         .training-guide-side dd {
            margin: 0.2rem 0 0;
            color: #4b5563;
            font-size: 1.1rem;
            line-height: 1.55;
         }

         .training-guide-actions {
            display: flex;
            gap: 0.65rem;
            flex-wrap: wrap;
            margin-top: 1rem;
         }

         .training-guide-actions a {
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            padding: 0.65rem 0.85rem;
            border-radius: 6px;
            background: var(--main-color, #007bff);
            color: #ffffff;
            font-size: 1.1rem;
            font-weight: 700;
            text-decoration: none;
         }

         .training-guide-actions a.secondary {
            background: #334155;
         }

         .training-user-guide.is-collapsed .training-user-guide__content {
            display: none;
         }

         .training-user-guide.is-collapsed .training-user-guide__toggle i {
            transform: rotate(180deg);
         }

         @media (max-width: 991px) {
            .training-user-guide {
               padding: 0 1rem;
            }

            .training-user-guide__header {
               flex-direction: column;
            }

            .training-user-guide__content {
               grid-template-columns: 1fr;
            }

            .training-guide-steps {
               grid-template-columns: 1fr;
            }
         }
      `;
      document.head.appendChild(style);
   }

   function buildGuide() {
      const section = document.createElement('section');
      section.id = GUIDE_ID;
      section.className = 'training-user-guide is-collapsed';
      section.setAttribute('aria-label', 'Panduan penggunaan training BCL');
      section.innerHTML = `
         <div class="training-user-guide__panel">
            <div class="training-user-guide__header">
               <div>
                  <div class="training-user-guide__eyebrow">
                     <i class="fas fa-route" aria-hidden="true"></i>
                     Panduan Batch Training
                  </div>
                  <h2>Ikuti alur ini agar progress belajar BIM Modeller tercatat rapi.</h2>
                  <p class="training-user-guide__summary">
                     Gunakan BCL untuk materi, video, dan post-test teori. Gunakan media pendamping resmi dari mentor untuk absensi, pengumpulan tugas praktik, dan catatan review.
                  </p>
               </div>
               <button class="training-user-guide__toggle" type="button" aria-expanded="false">
                  <i class="fas fa-chevron-up" aria-hidden="true"></i>
                  Tampilkan
               </button>
            </div>
            <div class="training-user-guide__content">
               <div class="training-guide-steps">
                  ${createStep('1', 'fas fa-right-to-bracket', 'Login akun BCL', 'Masuk memakai akun peserta training. Jika baru registrasi, lakukan login ulang sebelum membuka materi.', 'Data user dan token perlu aktif agar akses course berjalan normal.')}
                  ${createStep('2', 'fas fa-layer-group', 'Buka track BIM Modeller', 'Pilih track BIM Modeller pada Learning Paths, lalu mulai dari materi PDF yang disusun untuk role modeller.', 'Track ini adalah jalur utama batch pertama.')}
                  ${createStep('3', 'fas fa-file-pdf', 'Baca materi PDF per modul', 'Buka PDF sesuai urutan sesi. Tutup viewer setelah selesai agar read count dan evidence pembukaan materi tercatat.', 'Gunakan PDF sebagai rujukan konsep dan prosedur.')}
                  ${createStep('4', 'fas fa-circle-play', 'Tonton video latihan', 'Gunakan filter Revit atau kategori video lain yang diarahkan mentor. Fokus pada video yang sesuai sesi berjalan.', 'Video menjadi pendamping praktik, bukan pengganti tugas mentor.')}
                  ${createStep('5', 'fas fa-clipboard-check', 'Kerjakan post-test teori', 'Selesaikan quiz yang ditentukan mentor setelah materi selesai. Nilai quiz akan menjadi salah satu evidence pembelajaran.', 'Contoh jalur teori: BIM Mindset, Governance, dan Delivery Workflow.')}
                  ${createStep('6', 'fas fa-folder-open', 'Kumpulkan tugas praktik', 'Upload file praktik ke folder resmi yang diberikan mentor, misalnya SharePoint atau Teams.', 'BCL belum menjadi tempat submission file praktik batch pertama.')}
                  ${createStep('7', 'fas fa-user-pen', 'Ikuti review mentor', 'Periksa catatan mentor pada spreadsheet atau template review. Revisi tugas jika status masih perlu pendampingan.', 'Catatan praktik tetap dikelola di media pendamping.')}
                  ${createStep('8', 'fas fa-chart-line', 'Cek progress akhir', 'Pastikan materi, quiz, tugas praktik, dan absensi sudah masuk rekap batch sebelum penutupan training.', 'Status akhir ditetapkan dari gabungan data BCL dan rekap mentor.')}
               </div>
               <aside class="training-guide-side">
                  <h3>Media yang dipakai</h3>
                  <dl>
                     <dt>BCL</dt>
                     <dd>Materi PDF, video pembelajaran, quiz/post-test teori, dan evidence akses belajar dasar.</dd>
                     <dt>Teams</dt>
                     <dd>Pengumuman, sesi sinkron, komunikasi mentor, dan absensi bila dipakai oleh batch.</dd>
                     <dt>SharePoint</dt>
                     <dd>Folder pengumpulan model, gambar, PDF output, atau file latihan peserta.</dd>
                     <dt>Spreadsheet mentor</dt>
                     <dd>Nilai praktik, catatan review, status akhir, dan rekomendasi peserta.</dd>
                  </dl>
                  <div class="training-guide-actions">
                     <a href="/elearning-assets/dashboard.html">
                        <i class="fas fa-chart-simple" aria-hidden="true"></i>
                        Progress
                     </a>
                     <a class="secondary" href="/pages/bim-mindset-quiz.html">
                        <i class="fas fa-clipboard-question" aria-hidden="true"></i>
                        Post-test
                     </a>
                  </div>
               </aside>
            </div>
         </div>
      `;
      return section;
   }

   function findGuideAnchor() {
      return document.querySelector('.learning-sections-guide')
         || document.getElementById('pdf-section')
         || document.querySelector('.pdf-courses');
   }

   function initGuide(attempt = 0) {
      if (document.getElementById(GUIDE_ID)) return;

      injectStyles();

      const courseNavigator = document.querySelector('.learning-sections-guide');
      if (!courseNavigator && attempt < 30) {
         window.setTimeout(() => initGuide(attempt + 1), 100);
         return;
      }

      const anchor = findGuideAnchor();
      if (!anchor || !anchor.parentNode) return;

      const guide = buildGuide();
      anchor.parentNode.insertBefore(guide, anchor);

      const toggle = guide.querySelector('.training-user-guide__toggle');
      toggle.addEventListener('click', () => {
         const collapsed = guide.classList.toggle('is-collapsed');
         toggle.setAttribute('aria-expanded', String(!collapsed));
         toggle.lastChild.textContent = collapsed ? ' Tampilkan' : ' Sembunyikan';
      });
   }

   if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGuide);
   } else {
      initGuide();
   }
})();

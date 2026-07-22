(function () {
    'use strict';

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const fallbackImage = '/img/course-default.svg';

    const data = {
        courses: null,
        videos: null,
        news: null,
        activity: null
    };

    async function fetchJson(url, timeout = 10000) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                cache: 'no-store',
                credentials: 'same-origin',
                signal: controller.signal
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return await response.json();
        } finally {
            window.clearTimeout(timer);
        }
    }

    function getCourses() {
        data.courses ||= fetchJson('/api/courses');
        return data.courses;
    }

    function getVideos() {
        data.videos ||= fetchJson('/api/video-display/selected');
        return data.videos;
    }

    function getNews() {
        data.news ||= fetchJson('/api/news/all-news');
        return data.news;
    }

    function getActivity() {
        data.activity ||= fetchJson('/api/user-activity/public');
        return data.activity;
    }

    function asArray(payload, key) {
        if (Array.isArray(payload)) return payload;
        if (payload && Array.isArray(payload[key])) return payload[key];
        return [];
    }

    function safeAssetUrl(value, fallback = fallbackImage) {
        const raw = String(value || '').trim();
        if (!raw) return fallback;
        if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
        try {
            const url = new URL(raw, window.location.origin);
            if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
            if (url.protocol === 'data:' && raw.startsWith('data:image/')) return raw;
        } catch (error) {
            return fallback;
        }
        return fallback;
    }

    function setImageFallback(image, source, fallback = fallbackImage) {
        let fallbackApplied = false;
        image.addEventListener('error', () => {
            if (fallbackApplied) return;
            fallbackApplied = true;
            image.src = fallback;
        });
        image.src = safeAssetUrl(source, fallback);
    }

    function youtubeId(value) {
        const raw = String(value || '').trim();
        const match = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,15})/i);
        return match ? match[1] : '';
    }

    function formatNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? new Intl.NumberFormat('id-ID').format(parsed) : '—';
    }

    function initMotion() {
        const elements = $$('.bcl-reveal');
        if (!elements.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            elements.forEach((element) => element.classList.add('is-visible'));
            return;
        }

        document.documentElement.classList.add('bcl-motion-ready');
        if (!('IntersectionObserver' in window)) {
            elements.forEach((element) => element.classList.add('is-visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });

        elements.forEach((element) => observer.observe(element));
    }

    function initNavbarHeight() {
        const container = $('#navbar-container');
        if (!container) return;

        let resizeObserver = null;
        const sync = () => {
            const navbar = $('nav', container);
            if (!navbar) return false;
            const height = Math.max(64, Math.round(navbar.getBoundingClientRect().height));
            document.documentElement.style.setProperty('--home-nav-height', `${height}px`);
            if ('ResizeObserver' in window) {
                resizeObserver?.disconnect();
                resizeObserver = new ResizeObserver(() => {
                    const nextHeight = Math.max(64, Math.round(navbar.getBoundingClientRect().height));
                    document.documentElement.style.setProperty('--home-nav-height', `${nextHeight}px`);
                });
                resizeObserver.observe(navbar);
            }
            return true;
        };

        if (sync()) return;
        const observer = new MutationObserver(() => {
            if (sync()) observer.disconnect();
        });
        observer.observe(container, { childList: true, subtree: true });
    }

    function initCertificateNotice() {
        const notice = $('#https-cert-banner');
        if (!notice) return;

        const storageKey = 'bcl_https_cert_banner_hidden';
        const params = new URLSearchParams(window.location.search);
        if (params.get('cert') === 'installed') {
            localStorage.setItem(storageKey, '1');
            params.delete('cert');
            const query = params.toString();
            const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
            window.history.replaceState({}, document.title, cleanUrl);
        }

        if (localStorage.getItem(storageKey) === '1') {
            notice.hidden = true;
            return;
        }

        const dismiss = () => {
            notice.hidden = true;
            localStorage.setItem(storageKey, '1');
        };
        $('#cert-banner-close')?.addEventListener('click', dismiss);
        $('#cert-banner-installed')?.addEventListener('click', dismiss);

        fetchJson('/api/network-info', 5000)
            .then((networkInfo) => {
                const ip = String(networkInfo?.preferredServerIP || networkInfo?.serverIPs?.[0] || '').trim();
                if (!ip || ip === 'localhost') return;
                const hint = $('#direct-ip-hint');
                if (!hint) return;
                hint.hidden = false;
                hint.append('Alternatif Wi-Fi: ');
                const link = document.createElement('a');
                link.href = `http://${ip}`;
                link.textContent = ip;
                hint.append(link);
            })
            .catch(() => {
                // The access hint is optional; keep the notice concise when the endpoint is unavailable.
            });
    }

    function createCourse(course) {
        const id = String(course?.id || course?.categoryKey || '').trim();
        const title = String(course?.title || course?.category || 'Materi BIM').trim();
        const count = Number(course?.videoCount) || 0;

        const link = document.createElement('a');
        link.className = 'bcl-course bcl-reveal is-visible';
        link.href = `/pages/tutorial.html?category=${encodeURIComponent(id || title)}`;
        link.setAttribute('aria-label', `Buka kategori ${title}`);

        const imageWrap = document.createElement('div');
        imageWrap.className = 'bcl-course__image';
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        setImageFallback(image, course?.thumbnail);
        imageWrap.append(image);

        const body = document.createElement('div');
        body.className = 'bcl-course__body';
        const heading = document.createElement('h3');
        heading.textContent = title;
        const meta = document.createElement('div');
        meta.className = 'bcl-course__meta';
        const countLabel = document.createElement('span');
        const icon = document.createElement('i');
        icon.className = 'fa-regular fa-circle-play';
        icon.setAttribute('aria-hidden', 'true');
        countLabel.append(icon, ` ${formatNumber(count)} video`);
        const action = document.createElement('span');
        action.textContent = 'Mulai →';
        meta.append(countLabel, action);
        body.append(heading, meta);
        link.append(imageWrap, body);
        return link;
    }

    async function loadCourses() {
        const container = $('#courses-container');
        if (!container) return;
        try {
            const payload = await getCourses();
            const courses = asArray(payload, 'courses');
            const featured = courses
                .filter((course) => course && (course.id || course.categoryKey) && course.title)
                .slice(0, 6);

            container.replaceChildren();
            if (!featured.length) {
                const empty = document.createElement('p');
                empty.className = 'bcl-empty-state';
                empty.textContent = 'Kategori belajar belum tersedia saat ini.';
                container.append(empty);
                return;
            }
            featured.forEach((course) => container.append(createCourse(course)));
        } catch (error) {
            const empty = document.createElement('p');
            empty.className = 'bcl-empty-state';
            empty.textContent = 'Kategori belajar tidak dapat dimuat. Gunakan tautan “Lihat semua kategori” untuk melanjutkan.';
            container.replaceChildren(empty);
        }
    }

    async function loadFeaturedVideo() {
        const stage = $('#featured-video-stage');
        const poster = $('#featured-video-poster');
        const play = $('#featured-video-play');
        const title = $('#featured-video-title');
        if (!stage || !poster || !play || !title) return;

        try {
            const payload = await getVideos();
            const videos = asArray(payload, 'videos');
            const selected = videos.find((video) => video?.path) || null;
            if (!selected) throw new Error('no-video');

            title.textContent = selected.name || 'Video pilihan BCL';
            const videoId = youtubeId(selected.path);
            if (videoId) {
                setImageFallback(poster, `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`, '/img/bcl-hero-2026.jpg');
            }

            play.addEventListener('click', () => {
                stage.classList.add('is-playing');
                stage.replaceChildren();
                if (videoId) {
                    const iframe = document.createElement('iframe');
                    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
                    iframe.title = selected.name || 'Video pilihan BCL';
                    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
                    iframe.allowFullscreen = true;
                    stage.append(iframe);
                    return;
                }

                const video = document.createElement('video');
                video.controls = true;
                video.autoplay = true;
                video.playsInline = true;
                video.src = safeAssetUrl(selected.path, '');
                stage.append(video);
            }, { once: true });
        } catch (error) {
            title.textContent = 'Jelajahi pustaka video BIM';
            play.setAttribute('aria-label', 'Buka pustaka video BCL');
            play.addEventListener('click', () => {
                window.location.href = '/pages/tutorial.html';
            }, { once: true });
        }
    }

    function createNewsItem(item) {
        const target = String(item?.url || '').trim();
        const isExternal = /^https?:\/\//i.test(target);
        const link = document.createElement('a');
        link.className = 'bcl-news-item';
        link.href = target && target !== '#' ? target : '/pages/updates.html';
        if (isExternal) {
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        }

        const imageWrap = document.createElement('div');
        imageWrap.className = 'bcl-news-item__image';
        const image = document.createElement('img');
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        setImageFallback(image, item?.urlToImage, '/img/media-thumbnail.svg');
        imageWrap.append(image);

        const copy = document.createElement('div');
        copy.className = 'bcl-news-item__copy';
        const meta = document.createElement('span');
        const source = String(item?.source?.name || item?.source || 'BCL').trim();
        const date = item?.publishedAt ? new Date(item.publishedAt) : null;
        const dateLabel = date && !Number.isNaN(date.getTime())
            ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
            : '';
        meta.textContent = [source, dateLabel].filter(Boolean).join(' · ');
        const heading = document.createElement('h3');
        heading.textContent = String(item?.title || item?.stickerText || 'Update BIM').trim();
        copy.append(meta, heading);

        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-arrow-up-right-from-square';
        icon.setAttribute('aria-hidden', 'true');
        link.append(imageWrap, copy, icon);
        return link;
    }

    async function loadNews() {
        const container = $('#news-container');
        if (!container) return;
        try {
            const payload = await getNews();
            const items = asArray(payload, 'news')
                .filter((item) => item && item.status !== 'draft' && (item.title || item.stickerText))
                .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
                .slice(0, 3);
            container.replaceChildren();
            if (!items.length) throw new Error('no-news');
            items.forEach((item) => container.append(createNewsItem(item)));
        } catch (error) {
            const empty = document.createElement('p');
            empty.className = 'bcl-empty-state';
            empty.textContent = 'Update terbaru belum dapat dimuat.';
            container.replaceChildren(empty);
        }
    }

    async function loadMetrics() {
        const courseMetric = $('#metric-courses');
        const videoMetric = $('#metric-videos');
        const activeMetric = $('#metric-active');
        try {
            const [courseResult, activityResult] = await Promise.allSettled([getCourses(), getActivity()]);
            if (courseResult.status === 'fulfilled') {
                const courses = asArray(courseResult.value, 'courses');
                const totalVideos = courses.reduce((sum, course) => sum + (Number(course?.videoCount) || 0), 0);
                if (courseMetric) courseMetric.textContent = formatNumber(courses.length);
                if (videoMetric) videoMetric.textContent = formatNumber(totalVideos);
            }
            if (activityResult.status === 'fulfilled' && activeMetric) {
                activeMetric.textContent = formatNumber(activityResult.value?.totalActiveUsers);
            }
        } catch (error) {
            // Metrics stay neutral when optional public endpoints are unavailable.
        }
    }

    function initContactDialog() {
        const dialog = $('#contact-dialog');
        if (!dialog) return;
        $$('[data-open-contact]').forEach((button) => button.addEventListener('click', () => {
            if (typeof dialog.showModal === 'function') dialog.showModal();
        }));
        $$('[data-close-contact]', dialog).forEach((button) => button.addEventListener('click', () => dialog.close()));
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    }

    function initBackToTop() {
        const button = $('#back-to-top');
        if (!button) return;
        const update = () => button.classList.toggle('is-visible', window.scrollY > 700);
        window.addEventListener('scroll', update, { passive: true });
        button.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
        update();
    }

    function initFaq() {
        $$('.bcl-faq details').forEach((item) => {
            item.addEventListener('toggle', () => {
                if (!item.open) return;
                $$('.bcl-faq details').forEach((other) => {
                    if (other !== item) other.open = false;
                });
            });
        });
    }

    function init() {
        sessionStorage.setItem('lastPageFromPages', window.location.pathname);
        initNavbarHeight();
        initMotion();
        initCertificateNotice();
        initContactDialog();
        initBackToTop();
        initFaq();
        loadCourses();
        loadFeaturedVideo();
        loadNews();
        loadMetrics();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

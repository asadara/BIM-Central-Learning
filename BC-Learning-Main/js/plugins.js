document.addEventListener("DOMContentLoaded", function () {
    const container = document.getElementById("plugin-container");

    if (!container) {
        console.error("❌ Plugin container not found!");
        return;
    }

    // Show loading state
    showLoadingState();

    // Load plugins data
    loadPlugins();

    async function loadPlugins() {
        try {
            console.log("🔌 Loading plugins from backend...");

            // Fetch plugins from backend API
            const response = await fetch(`/api/plugins`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const pluginsData = await response.json();
            console.log("✅ Plugins data received:", pluginsData.length, "plugins");

            if (!Array.isArray(pluginsData)) {
                throw new Error("Invalid plugins data format");
            }

            displayPlugins(pluginsData);
            hideLoadingState();

        } catch (error) {
            console.error("❌ Error loading plugins:", error);
            showErrorState(error.message);
        }
    }

    function displayPlugins(plugins) {
        if (!container) return;

        if (plugins.length === 0) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-info text-center">
                        <i class="fas fa-info-circle fa-3x mb-3"></i>
                        <h4>Tidak ada plugin tersedia</h4>
                        <p>Saat ini belum ada plugin yang tersedia. Silakan coba lagi nanti.</p>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = ""; // Clear container

        plugins.forEach(plugin => {
            const card = document.createElement("div");
            card.classList.add("col-lg-3", "col-sm-6");

            card.innerHTML = `
                <div class="service-item text-center pt-3 shadow">
                    <div class="p-4">
                        <img src="${plugin.logo || '../img/plugin-default.png'}"
                             alt="${plugin.name}"
                             width="150px"
                             class="mb-4"
                             onerror="this.src='../img/fallback-plugin.png'"
                             style="max-width: 150px; height: auto;">
                        <h5 class="mb-3">${plugin.name}</h5>
                        <p class="text-muted small mb-3" style="font-size: 0.9rem; line-height: 1.4;">
                            ${plugin.description || 'Deskripsi tidak tersedia'}
                        </p>

                        <div class="d-flex flex-column gap-2">
                            <a href="${plugin.download || '#'}"
                               target="_blank"
                               class="btn btn-warning
                               ${plugin.download ? '' : 'disabled'}"
                               ${plugin.download ? '' : 'disabled'}>
                                <i class="fas fa-download me-1"></i>
                                ${plugin.download ? 'Download' : 'Link Tidak Tersedia'}
                            </a>

                            ${plugin.download ?
                    `<small class="text-muted">
                                    <i class="fas fa-external-link-alt me-1"></i>
                                    Link eksternal
                                </small>`
                    :
                    `<small class="text-danger">
                                    <i class="fas fa-exclamation-triangle me-1"></i>
                                    Link download belum tersedia
                                </small>`
                }
                        </div>
                    </div>
                </div>
            `;

            container.appendChild(card);
        });

        // Add animation class after rendering
        setTimeout(() => {
            document.querySelectorAll('.service-item').forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateY(20px)';

                setTimeout(() => {
                    item.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    item.style.opacity = '1';
                    item.style.transform = 'translateY(0)';
                }, index * 100); // Stagger animation
            });
        }, 100);
    }

    function showLoadingState() {
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="loading-spinner text-center py-5">
                        <i class="fas fa-spinner fa-spin fa-3x text-primary mb-3"></i>
                        <h4>Memuat Daftar Plugin...</h4>
                        <p class="text-muted">Mengambil plugin BIM dari server</p>
                    </div>
                </div>
            `;
        }
    }

    function hideLoadingState() {
        // Loading state will be replaced when content is displayed
    }

    function showErrorState(message) {
        if (container) {
            container.innerHTML = `
                <div class="col-12">
                    <div class="alert alert-danger text-center py-5">
                        <i class="fas fa-exclamation-triangle fa-3x mb-3"></i>
                        <h4>Gagal Memuat Plugin</h4>
                        <p>${message}</p>
                        <button class="btn btn-primary mt-3" onclick="window.location.reload()">
                            <i class="fas fa-refresh me-2"></i>Coba Lagi
                        </button>
                    </p>
                </div>
            `;
        }
    }

    // Global functions for window (if needed)
    window.loadPlugins = loadPlugins;
});

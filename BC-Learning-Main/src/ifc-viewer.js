import * as THREE from "three";
import * as OBC from "@thatopen/components";

class BclIfcViewer {
    constructor() {
        this.components = null;
        this.world = null;
        this.fragments = null;
        this.ifcLoader = null;
        this.grid = null;
        this.clipper = null;
        this.hider = null;
        this.boxer = null;
        this.picker = null;
        this.measurementGroup = null;
        this.currentFileUrl = "";
        this.currentFileName = "";
        this.isViewerReady = false;
        this.hasLoadedModel = false;
        this.gridVisible = true;
        this.selectedElement = null;
        this.pointerDownPosition = null;
        this.measureMode = false;
        this.measureStart = null;
        this.measurements = [];
        this.elements = {};
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.applyQueryContext();

        if (this.currentFileUrl) {
            this.loadModel(this.currentFileUrl, this.currentFileName);
        }
    }

    cacheElements() {
        const byId = (id) => document.getElementById(id);
        this.elements = {
            viewport: byId("ifc-viewport"),
            overlay: byId("ifc-overlay"),
            status: byId("ifc-status"),
            progressBar: byId("ifc-progress-bar"),
            progressText: byId("ifc-progress-text"),
            input: byId("ifc-url-input"),
            loadButton: byId("ifc-load-url"),
            fileInput: byId("ifc-file-input"),
            selectedFile: byId("ifc-selected-file"),
            resetButton: byId("ifc-reset-camera"),
            fullscreenButton: byId("ifc-fullscreen"),
            downloadLink: byId("ifc-download-original"),
            context: byId("ifc-context"),
            metaName: byId("ifc-meta-name"),
            metaProject: byId("ifc-meta-project"),
            metaYear: byId("ifc-meta-year"),
            metaSource: byId("ifc-meta-source"),
            metaModels: byId("ifc-meta-models"),
            metaCategories: byId("ifc-meta-categories"),
            fitModelButton: byId("ifc-fit-model"),
            toggleGridButton: byId("ifc-toggle-grid"),
            toggleMeasureButton: byId("ifc-toggle-measure"),
            clearMeasuresButton: byId("ifc-clear-measures"),
            measureNote: byId("ifc-measure-note"),
            measureList: byId("ifc-measure-list"),
            clearClipsButton: byId("ifc-clear-clips"),
            clipCount: byId("ifc-clip-count"),
            categorySelect: byId("ifc-category-select"),
            isolateCategoryButton: byId("ifc-isolate-category"),
            hideCategoryButton: byId("ifc-hide-category"),
            showAllButton: byId("ifc-show-all"),
            categoryNote: byId("ifc-category-note"),
            selectedSummary: byId("ifc-selected-summary"),
            propertyList: byId("ifc-property-list"),
            isolateSelectedButton: byId("ifc-isolate-selected"),
            hideSelectedButton: byId("ifc-hide-selected"),
            clearSelectedButton: byId("ifc-clear-selected")
        };
    }

    bindEvents() {
        this.elements.loadButton?.addEventListener("click", () => {
            const value = this.elements.input?.value.trim() || "";
            if (value) {
                this.loadModel(value, this.getFileNameFromUrl(value));
            }
        });

        this.elements.input?.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                this.elements.loadButton?.click();
            }
        });

        this.elements.fileInput?.addEventListener("change", (event) => {
            const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
            if (file) {
                this.loadLocalFile(file);
            }
        });

        this.elements.resetButton?.addEventListener("click", () => this.resetCamera());
        this.elements.fullscreenButton?.addEventListener("click", () => this.toggleFullscreen());
        this.elements.fitModelButton?.addEventListener("click", () => this.fitModel());
        this.elements.toggleGridButton?.addEventListener("click", () => this.toggleGrid());
        this.elements.toggleMeasureButton?.addEventListener("click", () => this.toggleMeasureMode());
        this.elements.clearMeasuresButton?.addEventListener("click", () => this.clearMeasurements());
        this.elements.clearClipsButton?.addEventListener("click", () => this.clearClippingPlanes());
        this.elements.isolateCategoryButton?.addEventListener("click", () => this.applyCategoryVisibility("isolate"));
        this.elements.hideCategoryButton?.addEventListener("click", () => this.applyCategoryVisibility("hide"));
        this.elements.showAllButton?.addEventListener("click", () => this.showAllCategories());
        this.elements.isolateSelectedButton?.addEventListener("click", () => this.applySelectedVisibility("isolate"));
        this.elements.hideSelectedButton?.addEventListener("click", () => this.applySelectedVisibility("hide"));
        this.elements.clearSelectedButton?.addEventListener("click", () => this.clearSelectedElement());
        this.elements.viewport?.addEventListener("pointerdown", (event) => {
            this.pointerDownPosition = { x: event.clientX, y: event.clientY };
        });
        this.elements.viewport?.addEventListener("pointerup", (event) => this.handleViewportPointerUp(event));

        document.querySelectorAll("[data-ifc-view]").forEach((button) => {
            button.addEventListener("click", () => this.setCameraOrientation(button.dataset.ifcView || "front"));
        });

        document.querySelectorAll("[data-ifc-clip]").forEach((button) => {
            button.addEventListener("click", () => this.addClippingPlane(button.dataset.ifcClip || "y"));
        });

        window.addEventListener("resize", () => this.resizeRenderer());
    }

    applyQueryContext() {
        const params = new URLSearchParams(window.location.search);
        const file = params.get("file") || "";
        const name = params.get("name") || this.getFileNameFromUrl(file);
        const project = params.get("project") || "";
        const year = params.get("year") || "";
        const source = params.get("source") || "";

        this.currentFileUrl = file;
        this.currentFileName = name || "IFC Model";

        if (this.elements.input && file) {
            this.elements.input.value = file;
        }

        this.setText(this.elements.metaName, this.currentFileName || "-");
        this.setText(this.elements.metaProject, project || "-");
        this.setText(this.elements.metaYear, year || "-");
        this.setText(this.elements.metaSource, source || "-");

        const context = [year, project, source].filter(Boolean).join(" / ");
        this.setText(
            this.elements.context,
            context ? `Membuka ${this.currentFileName} dari ${context}.` : "Pilih file IFC dari Projects Explorer atau masukkan URL media BCL."
        );

        this.updateDownloadLink(file, this.currentFileName);
    }

    setText(element, value) {
        if (element) {
            element.textContent = value;
        }
    }

    setOverlay({ visible, title, message, icon = "fa-cube" }) {
        const overlay = this.elements.overlay;
        if (!overlay) return;

        overlay.classList.toggle("is-hidden", !visible);
        if (visible) {
            overlay.innerHTML = `
                <i class="fas ${icon}" aria-hidden="true"></i>
                <strong>${this.escapeHtml(title)}</strong>
                <span>${this.escapeHtml(message)}</span>
            `;
        }
    }

    setStatus(status, message = "", progress = null) {
        this.setText(this.elements.status, status);
        this.setText(this.elements.progressText, message);
        if (typeof progress === "number" && Number.isFinite(progress)) {
            const normalized = Math.max(0, Math.min(100, progress));
            if (this.elements.progressBar) {
                this.elements.progressBar.style.width = `${normalized}%`;
            }
        }
    }

    escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    getFileNameFromUrl(value) {
        if (!value) return "";
        const clean = String(value).split("?")[0].split("#")[0];
        const raw = clean.split("/").filter(Boolean).pop() || "";
        try {
            return decodeURIComponent(raw);
        } catch (error) {
            return raw;
        }
    }

    buildFetchUrl(rawUrl) {
        const cleanUrl = String(rawUrl || "").trim();
        if (!cleanUrl) return "";

        if (/^https?:\/\//i.test(cleanUrl)) {
            try {
                const parsed = new URL(cleanUrl);
                if (parsed.origin === window.location.origin && parsed.pathname === "/api/media-proxy") {
                    return cleanUrl;
                }
            } catch (error) {
                return cleanUrl;
            }
            return cleanUrl;
        }

        if (cleanUrl.startsWith("/api/media-proxy")) {
            return cleanUrl;
        }

        if (cleanUrl.startsWith("/data/ifc/")) {
            return cleanUrl;
        }

        return `/api/media-proxy?url=${encodeURIComponent(cleanUrl)}`;
    }

    updateDownloadLink(rawUrl, fileName) {
        const link = this.elements.downloadLink;
        if (!link || !rawUrl) return;

        link.href = this.buildFetchUrl(rawUrl);
        link.download = fileName || this.getFileNameFromUrl(rawUrl) || "model.ifc";
        link.hidden = false;
    }

    async setupViewer() {
        if (this.isViewerReady) {
            return;
        }

        const container = this.elements.viewport;
        if (!container) {
            throw new Error("Viewport tidak ditemukan.");
        }

        this.components = new OBC.Components();
        const worlds = this.components.get(OBC.Worlds);
        this.world = worlds.create();
        this.world.scene = new OBC.SimpleScene(this.components);
        this.world.scene.setup();
        this.world.scene.three.background = new THREE.Color(0x101827);
        this.measurementGroup = new THREE.Group();
        this.measurementGroup.name = "BCL IFC Measurements";
        this.world.scene.three.add(this.measurementGroup);
        this.world.renderer = new OBC.SimpleRenderer(this.components, container);
        this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
        await this.world.camera.controls.setLookAt(14, 10, 14, 0, 0, 0);

        this.components.init();
        this.grid = this.components.get(OBC.Grids).create(this.world);
        this.boxer = this.components.get(OBC.BoundingBoxer);
        this.hider = this.components.get(OBC.Hider);
        this.components.get(OBC.Raycasters).get(this.world);
        if (typeof OBC.FastModelPicker === "function") {
            this.picker = new OBC.FastModelPicker(this.components, this.world);
        }
        this.clipper = this.components.get(OBC.Clipper);
        this.clipper.enabled = true;
        this.clipper.visible = true;
        this.clipper.size = 5;
        this.clipper.onAfterCreate.add(() => this.updateClipCount());
        this.clipper.onAfterDelete.add(() => this.updateClipCount());

        const workerUrl = await OBC.FragmentsManager.getWorker();
        this.fragments = this.components.get(OBC.FragmentsManager);
        this.fragments.init(workerUrl);
        this.world.camera.controls.addEventListener("update", () => this.fragments.core.update());
        this.world.onCameraChanged.add((camera) => {
            for (const [, model] of this.fragments.list) {
                model.useCamera(camera.three);
            }
            this.fragments.core.update(true);
        });
        this.fragments.list.onItemSet.add(({ value: model }) => {
            model.useCamera(this.world.camera.three);
            this.world.scene.three.add(model.object);
            this.fragments.core.update(true);
            this.hasLoadedModel = true;
            this.setOverlay({ visible: false });
        });

        this.fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
            if (!("isLodMaterial" in material && material.isLodMaterial)) {
                material.polygonOffset = true;
                material.polygonOffsetUnits = 1;
                material.polygonOffsetFactor = 1;
            }
        });

        this.ifcLoader = this.components.get(OBC.IfcLoader);
        await this.ifcLoader.setup({
            autoSetWasm: false,
            wasm: {
                path: "https://unpkg.com/web-ifc@0.0.77/",
                absolute: true
            }
        });

        this.isViewerReady = true;
        this.resizeRenderer();
    }

    async loadModel(rawUrl, fileName = "") {
        const fetchUrl = this.buildFetchUrl(rawUrl);
        const displayName = fileName || this.getFileNameFromUrl(rawUrl) || "IFC Model";

        if (!fetchUrl) {
            this.setStatus("Idle", "Masukkan URL file IFC.", 0);
            return;
        }

        this.currentFileUrl = rawUrl;
        this.currentFileName = displayName;
        this.setText(this.elements.metaName, displayName);
        this.updateDownloadLink(rawUrl, displayName);
        this.setOverlay({
            visible: true,
            title: "Menyiapkan viewer",
            message: "Scene dan IFC loader sedang disiapkan."
        });
        this.setStatus("Loading", "Menyiapkan viewer...", 5);

        try {
            await this.setupViewer();
            this.setStatus("Loading", "Mengambil file IFC dari server media...", 12);

            const buffer = await this.fetchIfcBuffer(fetchUrl);
            await this.convertIfcBuffer(buffer, displayName);
        } catch (error) {
            this.setStatus("Error", error.message || "Gagal memuat IFC.", 0);
            this.setOverlay({
                visible: true,
                icon: "fa-triangle-exclamation",
                title: "Model gagal dimuat",
                message: error.message || "Periksa akses file, koneksi server media, dan konfigurasi WASM."
            });
            console.error("IFC viewer load error:", error);
        }
    }

    async loadLocalFile(file) {
        if (!file) return;

        const displayName = file.name || "local-model.ifc";
        if (!/\.ifc$/i.test(displayName)) {
            this.setStatus("Error", "Pilih file dengan ekstensi .ifc.", 0);
            this.setOverlay({
                visible: true,
                icon: "fa-triangle-exclamation",
                title: "Format file tidak sesuai",
                message: "Browse file hanya menerima model IFC dengan ekstensi .ifc."
            });
            return;
        }

        this.currentFileUrl = "";
        this.currentFileName = displayName;
        this.setText(this.elements.metaName, displayName);
        this.setText(this.elements.metaProject, "File lokal");
        this.setText(this.elements.metaYear, "-");
        this.setText(this.elements.metaSource, "Browser");
        this.setText(this.elements.context, `Membuka ${displayName} dari file lokal browser.`);
        this.setText(this.elements.selectedFile, `${displayName} (${this.formatFileSize(file.size)})`);
        if (this.elements.downloadLink) {
            this.elements.downloadLink.hidden = true;
        }
        if (this.elements.input) {
            this.elements.input.value = "";
        }

        this.setOverlay({
            visible: true,
            title: "Membaca file lokal",
            message: "File IFC sedang dibaca dari komputer pengguna."
        });
        this.setStatus("Loading", "Membaca file lokal...", 8);

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.setStatus("Loading", "Menyiapkan viewer...", 18);
            await this.setupViewer();
            await this.convertIfcBuffer(new Uint8Array(arrayBuffer), displayName);
        } catch (error) {
            this.setStatus("Error", error.message || "Gagal membaca file lokal.", 0);
            this.setOverlay({
                visible: true,
                icon: "fa-triangle-exclamation",
                title: "File gagal dimuat",
                message: error.message || "Periksa file IFC yang dipilih."
            });
            console.error("Local IFC load error:", error);
        }
    }

    async convertIfcBuffer(buffer, displayName) {
        await this.clearSelectedElement({ silent: true });
        this.clearMeasurements();
        this.setStatus("Converting", "Mengonversi IFC ke Fragments...", 58);
        this.setOverlay({
            visible: true,
            title: "Konversi IFC",
            message: "File sedang dikonversi di browser. Model besar dapat memerlukan waktu lebih lama."
        });

        const modelId = this.createModelId(displayName);
        await this.ifcLoader.load(buffer, false, modelId, {
            processData: {
                progressCallback: (progress) => {
                    const pct = this.normalizeLoaderProgress(progress);
                    this.setStatus("Converting", `Konversi IFC ${Math.round(pct)}%`, 58 + (pct * 0.4));
                }
            }
        });

        await this.resetCamera();
        await this.refreshModelTools();
        this.setStatus("Ready", "Model IFC berhasil dimuat.", 100);
        this.setOverlay({ visible: false });
    }

    async fetchIfcBuffer(fetchUrl) {
        const response = await fetch(fetchUrl, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`File tidak dapat diambil (HTTP ${response.status}).`);
        }

        const contentLength = Number(response.headers.get("content-length") || "0");
        if (!response.body || !Number.isFinite(contentLength) || contentLength <= 0) {
            const arrayBuffer = await response.arrayBuffer();
            this.setStatus("Loading", "File IFC selesai diunduh.", 54);
            return new Uint8Array(arrayBuffer);
        }

        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            const pct = Math.min(100, (received / contentLength) * 100);
            this.setStatus("Loading", `Mengunduh IFC ${Math.round(pct)}%`, 12 + (pct * 0.42));
        }

        const buffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }

        return buffer;
    }

    formatFileSize(bytes) {
        if (typeof bytes !== "number" || !Number.isFinite(bytes)) return "-";
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex += 1;
        }
        const decimals = size >= 10 || unitIndex === 0 ? 0 : 1;
        return `${size.toFixed(decimals)} ${units[unitIndex]}`;
    }

    normalizeLoaderProgress(progress) {
        if (typeof progress === "number") {
            return progress <= 1 ? progress * 100 : Math.min(progress, 100);
        }

        if (progress && typeof progress === "object") {
            const current = Number(progress.current || progress.loaded || 0);
            const total = Number(progress.total || 0);
            if (total > 0) {
                return Math.min(100, (current / total) * 100);
            }
        }

        return 0;
    }

    createModelId(fileName) {
        const base = String(fileName || "model")
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-z0-9_-]+/gi, "-")
            .replace(/^-+|-+$/g, "")
            .toLowerCase();
        return `${base || "model"}-${Date.now()}`;
    }

    async refreshModelTools() {
        if (!this.fragments) return;

        const categories = new Set();
        for (const [, model] of this.fragments.list) {
            if (!model || typeof model.getItemsWithGeometryCategories !== "function") {
                continue;
            }
            try {
                const modelCategories = await model.getItemsWithGeometryCategories();
                for (const category of modelCategories) {
                    if (category) categories.add(category);
                }
            } catch (error) {
                console.warn("Unable to read IFC categories:", error);
            }
        }

        const sortedCategories = [...categories].sort((a, b) => String(a).localeCompare(String(b)));
        this.populateCategorySelect(sortedCategories);
        this.setText(this.elements.metaModels, String(this.fragments.list.size || 0));
        this.setText(this.elements.metaCategories, sortedCategories.length ? String(sortedCategories.length) : "-");
    }

    async handleViewportPointerUp(event) {
        if (!this.hasLoadedModel || !this.picker || !this.elements.viewport) return;
        if (event.button !== 0) return;

        const start = this.pointerDownPosition;
        this.pointerDownPosition = null;
        if (start) {
            const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
            if (moved > 4) return;
        }

        const position = this.getPointerNdc(event);
        if (this.measureMode) {
            await this.handleMeasurementClick(position);
            return;
        }

        await this.selectElementAt(position);
    }

    getPointerNdc(event) {
        const rect = this.elements.viewport.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
        return new THREE.Vector2(x, y);
    }

    async selectElementAt(position) {
        try {
            const hit = await this.picker.getItemAt(position);
            if (!hit) {
                await this.clearSelectedElement();
                this.setText(this.elements.selectedSummary, "Tidak ada elemen pada titik klik.");
                return;
            }

            const model = this.fragments?.list.get(hit.modelId);
            if (!model) {
                await this.clearSelectedElement();
                this.setText(this.elements.selectedSummary, "Elemen ditemukan, tetapi model tidak tersedia.");
                return;
            }

            await this.resetSelectedHighlight();
            this.selectedElement = {
                modelId: hit.modelId,
                localId: hit.localId,
                itemId: hit.itemId
            };
            await this.highlightSelectedElement();
            await this.updateSelectedPanel();
            this.fragments?.core.update(true);
        } catch (error) {
            console.warn("Unable to select IFC element:", error);
            this.setText(this.elements.selectedSummary, "Elemen tidak dapat dipilih pada model ini.");
        }
    }

    async resetSelectedHighlight() {
        if (!this.selectedElement || !this.fragments) return;
        const model = this.fragments.list.get(this.selectedElement.modelId);
        if (model && typeof model.resetHighlight === "function") {
            await model.resetHighlight([this.selectedElement.localId]);
        }
    }

    async highlightSelectedElement() {
        if (!this.selectedElement || !this.fragments) return;
        const model = this.fragments.list.get(this.selectedElement.modelId);
        if (!model || typeof model.highlight !== "function") return;

        await model.highlight([this.selectedElement.localId], {
            color: new THREE.Color(0xf59e0b),
            renderedFaces: 1,
            opacity: 0.86,
            transparent: true,
            preserveOriginalMaterial: true,
            customId: "bcl-selected-element"
        });
    }

    async updateSelectedPanel() {
        const selected = this.selectedElement;
        if (!selected || !this.fragments) {
            this.setSelectedActionsEnabled(false);
            this.setText(this.elements.selectedSummary, "Klik elemen model untuk melihat data IFC.");
            this.renderPropertyList([{ name: "Status", value: "No element selected" }]);
            return;
        }

        const model = this.fragments.list.get(selected.modelId);
        if (!model) return;

        const properties = await this.readSelectedProperties(model, selected.localId);
        const category = this.getPropertyValue(properties, ["Category", "category", "_category"]) || "-";
        const name = this.getPropertyValue(properties, ["Name", "name", "ObjectType", "Object Type"]) || "Selected element";
        const globalId = this.getPropertyValue(properties, ["GlobalId", "Global ID", "guid", "GUID", "_guid"]) || "-";

        this.elements.selectedSummary?.classList.add("is-active");
        this.setText(this.elements.selectedSummary, `${this.formatCategoryName(category)} | ${name}`);
        this.setSelectedActionsEnabled(true);

        const baseRows = [
            { name: "Model ID", value: selected.modelId },
            { name: "Local ID", value: String(selected.localId) },
            { name: "Item ID", value: String(selected.itemId) },
            { name: "Category", value: this.formatCategoryName(category) },
            { name: "Global ID", value: globalId }
        ];
        this.renderPropertyList([...baseRows, ...properties.slice(0, 40)]);
    }

    async readSelectedProperties(model, localId) {
        const rows = [];

        try {
            const guids = typeof model.getGuidsByLocalIds === "function"
                ? await model.getGuidsByLocalIds([localId])
                : [];
            if (guids && guids[0]) {
                rows.push({ name: "GlobalId", value: guids[0] });
            }
        } catch (error) {
            console.warn("Unable to read selected GUID:", error);
        }

        try {
            const categories = typeof model.getItemsWithGeometryCategories === "function"
                ? await model.getItemsData([localId], { attributesDefault: true })
                : [];
            const flattened = this.flattenItemData(categories && categories[0] ? categories[0] : {});
            rows.push(...flattened);
        } catch (error) {
            console.warn("Unable to read selected attributes:", error);
        }

        try {
            const data = await model.getItemsData([localId], {
                attributesDefault: true,
                relations: {
                    IsDefinedBy: { attributes: true, relations: true },
                    DefinesOccurrence: { attributes: true, relations: false }
                },
                relationsDefault: { attributes: false, relations: false }
            });
            const flattened = this.flattenItemData(data && data[0] ? data[0] : {});
            rows.push(...flattened);
        } catch (error) {
            console.warn("Unable to read selected relations:", error);
        }

        return this.dedupePropertyRows(rows)
            .filter((row) => row.value !== "" && row.value !== "-" && !String(row.value).includes("[object Object]"))
            .slice(0, 60);
    }

    flattenItemData(value, prefix = "", depth = 0) {
        if (depth > 3 || value == null) return [];
        const rows = [];

        if (Array.isArray(value)) {
            value.slice(0, 8).forEach((item, index) => {
                rows.push(...this.flattenItemData(item, `${prefix}${prefix ? " " : ""}${index + 1}`, depth + 1));
            });
            return rows;
        }

        if (typeof value !== "object") {
            return [{ name: prefix || "Value", value: this.stringifyIfcValue(value) }];
        }

        for (const [key, item] of Object.entries(value)) {
            const label = prefix ? `${prefix} / ${key}` : key;
            if (item && typeof item === "object" && !Array.isArray(item)) {
                if ("value" in item) {
                    rows.push({ name: label, value: this.stringifyIfcValue(item.value) });
                } else if ("name" in item && "type" in item) {
                    rows.push({ name: label, value: this.stringifyIfcValue(item.name) });
                } else if (depth < 3) {
                    rows.push(...this.flattenItemData(item, label, depth + 1));
                } else {
                    rows.push({ name: label, value: this.stringifyIfcValue(item) });
                }
            } else {
                rows.push({ name: label, value: this.stringifyIfcValue(item) });
            }
        }

        return rows;
    }

    stringifyIfcValue(value) {
        if (value == null) return "-";
        if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
            return String(value);
        }
        if (Array.isArray(value)) {
            return value.map((item) => this.stringifyIfcValue(item)).filter(Boolean).join(", ");
        }
        if (typeof value === "object" && "value" in value) {
            return this.stringifyIfcValue(value.value);
        }
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }

    dedupePropertyRows(rows) {
        const seen = new Set();
        const result = [];
        for (const row of rows) {
            const name = String(row.name || "").trim();
            const value = String(row.value || "").trim();
            const key = `${name}:${value}`;
            if (!name || seen.has(key)) continue;
            seen.add(key);
            result.push({ name, value });
        }
        return result;
    }

    getPropertyValue(rows, names) {
        const normalized = new Set(names.map((name) => String(name).toLowerCase()));
        const match = rows.find((row) => normalized.has(String(row.name).split("/").pop().trim().toLowerCase()));
        return match ? match.value : "";
    }

    renderPropertyList(rows) {
        const list = this.elements.propertyList;
        if (!list) return;
        list.innerHTML = "";

        const source = rows.length > 0 ? rows : [{ name: "Status", value: "No properties found" }];
        for (const row of source) {
            const item = document.createElement("div");
            const term = document.createElement("dt");
            const definition = document.createElement("dd");
            term.textContent = row.name;
            definition.textContent = row.value;
            item.append(term, definition);
            list.appendChild(item);
        }
    }

    setSelectedActionsEnabled(enabled) {
        [this.elements.isolateSelectedButton, this.elements.hideSelectedButton, this.elements.clearSelectedButton]
            .forEach((button) => {
                if (button) button.disabled = !enabled;
            });
    }

    async applySelectedVisibility(mode) {
        if (!this.selectedElement || !this.hider) return;
        const modelIdMap = {
            [this.selectedElement.modelId]: new Set([this.selectedElement.localId])
        };

        if (mode === "isolate") {
            await this.hider.isolate(modelIdMap);
            this.setText(this.elements.selectedSummary, "Selected element diisolasi.");
        } else {
            await this.hider.set(false, modelIdMap);
            this.setText(this.elements.selectedSummary, "Selected element disembunyikan.");
        }
        this.fragments?.core.update(true);
    }

    async clearSelectedElement(options = {}) {
        await this.resetSelectedHighlight();
        this.selectedElement = null;
        this.elements.selectedSummary?.classList.remove("is-active");
        this.setSelectedActionsEnabled(false);
        this.renderPropertyList([{ name: "Status", value: "No element selected" }]);
        if (!options.silent) {
            this.setText(this.elements.selectedSummary, "Klik elemen model untuk melihat data IFC.");
            this.fragments?.core.update(true);
        }
    }

    toggleMeasureMode() {
        this.measureMode = !this.measureMode;
        this.measureStart = null;
        this.elements.toggleMeasureButton?.classList.toggle("is-active", this.measureMode);
        this.setText(
            this.elements.measureNote,
            this.measureMode
                ? "Measure aktif. Klik titik awal, lalu klik titik akhir."
                : "Aktifkan Measure lalu klik dua titik pada model."
        );
    }

    async handleMeasurementClick(position) {
        if (!this.picker || !this.measurementGroup) return;

        try {
            const point = await this.picker.getPointAt(position);
            if (!point) {
                this.setText(this.elements.measureNote, "Tidak ada permukaan model pada titik klik.");
                return;
            }

            if (!this.measureStart) {
                this.measureStart = point.clone();
                this.addMeasureMarker(this.measureStart, 0x22c55e);
                this.setText(this.elements.measureNote, "Titik awal tersimpan. Klik titik akhir.");
                this.fragments?.core.update(true);
                return;
            }

            const start = this.measureStart.clone();
            const end = point.clone();
            const distance = start.distanceTo(end);
            this.addMeasureMarker(end, 0xf59e0b);
            this.addMeasureLine(start, end);
            this.measurements.push({ start, end, distance });
            this.measureStart = null;
            this.renderMeasurements();
            this.setText(this.elements.measureNote, `Jarak terakhir: ${this.formatDistance(distance)}.`);
            this.fragments?.core.update(true);
        } catch (error) {
            console.warn("Unable to measure IFC model:", error);
            this.setText(this.elements.measureNote, "Measurement gagal pada titik ini.");
        }
    }

    addMeasureMarker(point, color) {
        const marker = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 16, 16),
            new THREE.MeshBasicMaterial({ color, depthTest: false })
        );
        marker.position.copy(point);
        marker.renderOrder = 10;
        this.measurementGroup.add(marker);
    }

    addMeasureLine(start, end) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xf59e0b, depthTest: false })
        );
        line.renderOrder = 9;
        this.measurementGroup.add(line);
    }

    renderMeasurements() {
        const list = this.elements.measureList;
        if (!list) return;
        list.innerHTML = "";

        this.measurements.forEach((measurement, index) => {
            const item = document.createElement("li");
            item.textContent = `M${index + 1}: ${this.formatDistance(measurement.distance)}`;
            list.appendChild(item);
        });
    }

    clearMeasurements() {
        if (this.measurementGroup) {
            while (this.measurementGroup.children.length > 0) {
                const child = this.measurementGroup.children[0];
                this.measurementGroup.remove(child);
                child.geometry?.dispose?.();
                if (Array.isArray(child.material)) {
                    child.material.forEach((material) => material.dispose?.());
                } else {
                    child.material?.dispose?.();
                }
            }
        }
        this.measurements = [];
        this.measureStart = null;
        if (this.elements.measureList) {
            this.elements.measureList.innerHTML = "";
        }
        this.setText(
            this.elements.measureNote,
            this.measureMode ? "Measure aktif. Klik titik awal, lalu klik titik akhir." : "Aktifkan Measure lalu klik dua titik pada model."
        );
        this.fragments?.core.update(true);
    }

    formatDistance(distance) {
        if (!Number.isFinite(distance)) return "-";
        if (distance >= 1000) return `${(distance / 1000).toFixed(2)}k unit model`;
        if (distance >= 10) return `${distance.toFixed(2)} unit model`;
        return `${distance.toFixed(3)} unit model`;
    }

    populateCategorySelect(categories) {
        const select = this.elements.categorySelect;
        if (!select) return;

        select.innerHTML = "";
        if (!Array.isArray(categories) || categories.length === 0) {
            select.disabled = true;
            select.innerHTML = '<option value="">No categories found</option>';
            this.setCategoryActionsEnabled(false);
            this.setText(this.elements.categoryNote, "Kategori model tidak ditemukan pada IFC ini.");
            return;
        }

        for (const category of categories) {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = this.formatCategoryName(category);
            select.appendChild(option);
        }

        select.disabled = false;
        this.setCategoryActionsEnabled(true);
        this.setText(this.elements.categoryNote, `${categories.length} kategori siap untuk isolate/hide.`);
    }

    setCategoryActionsEnabled(enabled) {
        [this.elements.isolateCategoryButton, this.elements.hideCategoryButton, this.elements.showAllButton]
            .forEach((button) => {
                if (button) button.disabled = !enabled;
            });
    }

    formatCategoryName(category) {
        return String(category || "")
            .replace(/^IFC/i, "IFC ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .trim();
    }

    async getCategoryModelIdMap(category) {
        if (!this.fragments || !category) return {};
        const modelIdMap = {};
        const regex = [new RegExp(`^${this.escapeRegExp(category)}$`)];

        for (const [modelId, model] of this.fragments.list) {
            if (!model || typeof model.getItemsOfCategories !== "function") {
                continue;
            }
            const items = await model.getItemsOfCategories(regex);
            const localIds = Object.values(items || {}).flat();
            if (localIds.length > 0) {
                modelIdMap[modelId] = new Set(localIds);
            }
        }

        return modelIdMap;
    }

    escapeRegExp(value) {
        return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    async applyCategoryVisibility(mode) {
        const category = this.elements.categorySelect?.value || "";
        if (!category || !this.hider) return;

        try {
            this.setStatus("Working", `${mode === "isolate" ? "Isolating" : "Hiding"} ${this.formatCategoryName(category)}...`, 100);
            const modelIdMap = await this.getCategoryModelIdMap(category);
            if (Object.keys(modelIdMap).length === 0) {
                this.setText(this.elements.categoryNote, `Tidak ada elemen untuk ${this.formatCategoryName(category)}.`);
                return;
            }

            if (mode === "isolate") {
                await this.hider.isolate(modelIdMap);
            } else {
                await this.hider.set(false, modelIdMap);
            }
            this.fragments?.core.update(true);
            this.setText(this.elements.categoryNote, `${this.formatCategoryName(category)} ${mode === "isolate" ? "diisolasi" : "disembunyikan"}.`);
            this.setStatus("Ready", "Model IFC berhasil dimuat.", 100);
        } catch (error) {
            this.setStatus("Error", error.message || "Gagal mengubah visibility kategori.", 0);
        }
    }

    async showAllCategories() {
        if (!this.hider) return;
        await this.hider.set(true);
        await this.highlightSelectedElement();
        this.fragments?.core.update(true);
        this.setText(this.elements.categoryNote, "Semua kategori ditampilkan.");
        this.setStatus("Ready", "Model IFC berhasil dimuat.", 100);
    }

    async getLoadedModelBox() {
        if (!this.boxer || !this.fragments || this.fragments.list.size === 0) return null;
        this.boxer.list.clear();
        this.boxer.addFromModels();
        const box = this.boxer.get();
        this.boxer.list.clear();
        return box && !box.isEmpty() ? box : null;
    }

    async fitModel() {
        const box = await this.getLoadedModelBox();
        if (!box || !this.world) return;

        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const diagonal = Math.max(size.length(), 10);
        const offset = diagonal * 0.8;
        await this.world.camera.controls.setLookAt(
            center.x + offset,
            center.y + offset * 0.65,
            center.z + offset,
            center.x,
            center.y,
            center.z,
            true
        );
        this.fragments?.core.update(true);
    }

    async setCameraOrientation(orientation) {
        if (!this.boxer || !this.world) return;

        try {
            this.boxer.list.clear();
            this.boxer.addFromModels();
            const cameraData = await this.boxer.getCameraOrientation(orientation, 1.5);
            this.boxer.list.clear();
            await this.world.camera.controls.setLookAt(
                cameraData.position.x,
                cameraData.position.y,
                cameraData.position.z,
                cameraData.target.x,
                cameraData.target.y,
                cameraData.target.z,
                true
            );
            this.fragments?.core.update(true);
        } catch (error) {
            await this.fitModel();
        }
    }

    toggleGrid() {
        if (!this.grid) return;
        this.gridVisible = !this.gridVisible;
        this.grid.visible = this.gridVisible;
        this.fragments?.core.update(true);
    }

    async addClippingPlane(axis) {
        if (!this.clipper || !this.world) return;
        const box = await this.getLoadedModelBox();
        const point = box ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
        const normalMap = {
            x: new THREE.Vector3(1, 0, 0),
            y: new THREE.Vector3(0, 1, 0),
            z: new THREE.Vector3(0, 0, 1)
        };
        const normal = normalMap[axis] || normalMap.y;
        this.clipper.createFromNormalAndCoplanarPoint(this.world, normal, point);
        this.updateClipCount();
    }

    clearClippingPlanes() {
        if (!this.clipper) return;
        this.clipper.deleteAll();
        this.updateClipCount();
    }

    updateClipCount() {
        const count = this.clipper && this.clipper.list ? this.clipper.list.size : 0;
        this.setText(this.elements.clipCount, `${count} section cut${count === 1 ? "" : "s"} active.`);
    }

    async resetCamera() {
        if (!this.world || !this.world.camera) return;
        const box = await this.getLoadedModelBox();
        if (box) {
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const diagonal = Math.max(size.length(), 10);
            const offset = diagonal * 0.8;
            await this.world.camera.controls.setLookAt(
                center.x + offset,
                center.y + offset * 0.65,
                center.z + offset,
                center.x,
                center.y,
                center.z,
                true
            );
        } else {
            await this.world.camera.controls.setLookAt(18, 12, 18, 0, 0, 0, true);
        }
        if (this.fragments) {
            this.fragments.core.update(true);
        }
    }

    toggleFullscreen() {
        const stage = document.querySelector(".ifc-viewer-stage");
        if (!stage) return;

        if (!document.fullscreenElement) {
            stage.requestFullscreen?.();
            return;
        }

        document.exitFullscreen?.();
    }

    resizeRenderer() {
        if (!this.world || !this.world.renderer) return;
        this.world.renderer.resize();
        if (this.fragments && this.hasLoadedModel) {
            this.fragments.core.update(true);
        }
    }
}

function startIfcViewer() {
    const viewer = new BclIfcViewer();
    viewer.init();
    window.BCLIfcViewer = viewer;
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startIfcViewer, { once: true });
} else {
    startIfcViewer();
}

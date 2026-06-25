const express = require("express");
const fs = require("fs");
const path = require("path");
const { getRequestUser } = require("../utils/auth");

const router = express.Router();
const LESSON_LEARN_FILE = path.join(__dirname, "../lesson-learn.json");

const ALLOWED_CATEGORIES = new Set(["problem", "case", "innovation", "improvement"]);
const ALLOWED_STATUSES = new Set(["draft", "review", "approved", "applied"]);

function ensureLessonLearnFile() {
    const dir = path.dirname(LESSON_LEARN_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(LESSON_LEARN_FILE)) {
        fs.writeFileSync(LESSON_LEARN_FILE, JSON.stringify({ items: [] }, null, 2));
    }
}

function readStore() {
    ensureLessonLearnFile();

    try {
        const parsed = JSON.parse(fs.readFileSync(LESSON_LEARN_FILE, "utf8"));
        return {
            items: Array.isArray(parsed.items) ? parsed.items : []
        };
    } catch (error) {
        return { items: [] };
    }
}

function writeStore(store) {
    ensureLessonLearnFile();
    fs.writeFileSync(LESSON_LEARN_FILE, JSON.stringify({
        items: Array.isArray(store.items) ? store.items : []
    }, null, 2));
}

function cleanText(value, maxLength = 4000) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maxLength);
}

function cleanList(value) {
    if (Array.isArray(value)) {
        return value.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 12);
    }

    return String(value || "")
        .split(",")
        .map((item) => cleanText(item, 80))
        .filter(Boolean)
        .slice(0, 12);
}

function normalizeCategory(value) {
    const category = String(value || "").toLowerCase();
    return ALLOWED_CATEGORIES.has(category) ? category : "problem";
}

function normalizeStatus(value) {
    const status = String(value || "").toLowerCase();
    return ALLOWED_STATUSES.has(status) ? status : "draft";
}

function buildActor(req) {
    const authUser = getRequestUser(req);
    if (authUser) {
        return authUser.username || authUser.email || "BCL User";
    }

    return cleanText(req.body?.submittedBy, 120) || "BCL User";
}

function normalizeLesson(input, req, existing = {}) {
    const now = new Date().toISOString();
    const title = cleanText(input.title || existing.title, 180);
    const projectName = cleanText(input.projectName || existing.projectName, 180);

    return {
        id: existing.id || `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title,
        projectName,
        projectPhase: cleanText(input.projectPhase || existing.projectPhase, 120),
        category: normalizeCategory(input.category || existing.category),
        discipline: cleanText(input.discipline || existing.discipline, 120),
        eventDate: cleanText(input.eventDate || existing.eventDate, 40),
        issue: cleanText(input.issue || existing.issue),
        rootCause: cleanText(input.rootCause || existing.rootCause),
        actionTaken: cleanText(input.actionTaken || existing.actionTaken),
        prevention: cleanText(input.prevention || existing.prevention),
        innovationIdea: cleanText(input.innovationIdea || existing.innovationIdea),
        impact: cleanText(input.impact || existing.impact, 800),
        owner: cleanText(input.owner || existing.owner, 120),
        status: normalizeStatus(input.status || existing.status),
        tags: cleanList(input.tags || existing.tags),
        submittedBy: existing.submittedBy || buildActor(req),
        createdAt: existing.createdAt || now,
        updatedAt: now
    };
}

function lessonMatchesQuery(lesson, query) {
    const searchText = cleanText(query.q, 200).toLowerCase();
    const category = cleanText(query.category, 40).toLowerCase();
    const status = cleanText(query.status, 40).toLowerCase();

    if (category && category !== "all" && lesson.category !== category) {
        return false;
    }

    if (status && status !== "all" && lesson.status !== status) {
        return false;
    }

    if (!searchText) {
        return true;
    }

    return [
        lesson.title,
        lesson.projectName,
        lesson.projectPhase,
        lesson.category,
        lesson.discipline,
        lesson.issue,
        lesson.rootCause,
        lesson.actionTaken,
        lesson.prevention,
        lesson.innovationIdea,
        lesson.impact,
        lesson.owner,
        ...(lesson.tags || [])
    ].join(" ").toLowerCase().includes(searchText);
}

router.get("/", (req, res) => {
    try {
        const store = readStore();
        const items = store.items
            .filter((lesson) => lessonMatchesQuery(lesson, req.query))
            .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")));

        res.json({
            success: true,
            count: items.length,
            data: items
        });
    } catch (error) {
        console.error("[LESSON_LEARN] Failed to read lessons:", error);
        res.status(500).json({ success: false, error: "Failed to load lesson learn data" });
    }
});

router.post("/", (req, res) => {
    try {
        const lesson = normalizeLesson(req.body || {}, req);

        if (!lesson.title || !lesson.projectName || !lesson.issue) {
            return res.status(400).json({
                success: false,
                error: "Title, project name, and issue are required"
            });
        }

        const store = readStore();
        store.items.unshift(lesson);
        writeStore(store);

        res.status(201).json({
            success: true,
            data: lesson
        });
    } catch (error) {
        console.error("[LESSON_LEARN] Failed to create lesson:", error);
        res.status(500).json({ success: false, error: "Failed to save lesson learn data" });
    }
});

router.patch("/:id", (req, res) => {
    try {
        const store = readStore();
        const index = store.items.findIndex((item) => item.id === req.params.id);

        if (index === -1) {
            return res.status(404).json({ success: false, error: "Lesson not found" });
        }

        const updated = normalizeLesson(req.body || {}, req, store.items[index]);
        store.items[index] = updated;
        writeStore(store);

        res.json({
            success: true,
            data: updated
        });
    } catch (error) {
        console.error("[LESSON_LEARN] Failed to update lesson:", error);
        res.status(500).json({ success: false, error: "Failed to update lesson learn data" });
    }
});

module.exports = router;

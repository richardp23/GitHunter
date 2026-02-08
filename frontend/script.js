Chart.register(ChartDataLabels);
let languageChart = null;
let firstSearch = true;

const API_BASE = "http://localhost:5000";
const POLL_INTERVAL_MS = 2000;

document.addEventListener("DOMContentLoaded", () => {
    const center = document.getElementById("center");
    setTimeout(() => center.classList.add("fade-in"), 100);
});

function showAnalyzingState(show, progress = 0, text = "Running AI analysis…") {
    const el = document.getElementById("analyzing-status");
    const textEl = document.getElementById("analyzing-text");
    const progressEl = document.getElementById("analyzing-progress");
    const fillEl = document.getElementById("analyzing-bar-fill");
    if (!el) return;
    if (show) {
        el.classList.remove("hidden");
        if (textEl) textEl.textContent = text;
        if (progressEl) progressEl.textContent = progress > 0 ? `${progress}%` : "";
        if (fillEl) fillEl.style.width = `${Math.min(100, progress)}%`;
    } else {
        el.classList.add("hidden");
        if (fillEl) fillEl.style.width = "0%";
    }
}

function pollStatus(jobId) {
    return fetch(`${API_BASE}/api/status/${jobId}`).then((r) => (r.ok ? r.json() : null));
}

function fetchReport(jobId) {
    return fetch(`${API_BASE}/api/report/${jobId}`).then((r) => (r.ok ? r.json() : null));
}

/**
 * Render the full report (profile, chart, stats, AI sections). Called when analysis completes.
 */
function renderReport(data) {
    const container = document.getElementById("center");
    const dashboard = document.getElementById("stats");
    const profileCard = document.getElementById("profile-card");
    const avatarImg = document.getElementById("user-avatar");
    const displayName = document.getElementById("user-display-name");
    const centerForm = document.getElementById("center-form");
    const title = document.querySelector("#search h1");
    const subtitle = document.querySelector("#search h2");
    const boxes = document.querySelectorAll(".stats-box");
    const ctx = document.getElementById("language-chart").getContext("2d");
    const repoDisplay = document.getElementById("repo-stat");
    const starDisplay = document.getElementById("star-stat");
    const forkDisplay = document.getElementById("fork-stat");

    if (firstSearch) {
        title.classList.add("text-shrink");
        subtitle.classList.add("text-shrink");
        container.classList.remove("initial-state");
        container.classList.add("results-state");
        dashboard.classList.add("grid-on");
        centerForm.classList.add("expanded");
        profileCard.classList.add("layout-on");
        setTimeout(() => profileCard.classList.add("visible"), 50);
        setTimeout(() => {
            dashboard.classList.add("visible");
            boxes.forEach((box, index) => {
                setTimeout(() => box.classList.add("flipped"), index * 200);
            });
        }, 800);
        firstSearch = false;
    } else {
        boxes.forEach((box, index) => {
            box.classList.remove("refresh-flip-360");
            void box.offsetHeight;
            setTimeout(() => box.classList.add("refresh-flip-360"), index * 150);
        });
        if (languageChart) {
            languageChart.destroy();
            ctx.canvas.width = ctx.canvas.width;
        }
        repoDisplay.innerText = "0";
        starDisplay.innerText = "0";
        forkDisplay.innerText = "0";
        repoDisplay.style.color = "#ffffff";
        starDisplay.style.color = "#ffffff";
        forkDisplay.style.color = "#ffffff";
    }

    const report = data.report || data;
    avatarImg.src = report.user.avatar_url;
    displayName.innerText = report.user.name || report.user.login;

    const languages = report.stats.language || {};
    const topLanguage = document.getElementById("language-header");
    let labels = [], values = [];
    if (Object.keys(languages).length === 0) {
        topLanguage.innerText = "Nothing!";
    } else {
        const sortedEntries = Object.entries(languages).sort(([, a], [, b]) => b - a);
        labels = sortedEntries.map((e) => e[0]);
        values = sortedEntries.map((e) => e[1]);
        topLanguage.innerText = sortedEntries[0][0];
    }

    const generateReverseRainbow = (count) => {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const h = 360 - (i * (360 / count));
            colors.push(`hsl(${h}, 75%, 60%)`);
        }
        return colors;
    };

    languageChart = new Chart(ctx, {
        type: "pie",
        data: {
            labels,
            datasets: [{ label: "Languages Used", data: values, backgroundColor: generateReverseRainbow(labels.length), borderWidth: 2 }],
        },
        options: {
            color: "#fff",
            maintainAspectRatio: true,
            aspectRatio: 1,
            responsive: true,
            resizeDelay: 0,
            events: ["mousemove", "mouseout", "click", "touchstart", "touchmove"],
            interaction: { mode: "nearest", intersect: true },
            plugins: {
                legend: { position: "right", labels: { font: { size: 20, family: "'Outfit', sans-serif", weight: "500" } } },
                datalabels: {
                    anchor: "end",
                    align: "start",
                    offset: 10,
                    formatter: (value, ctx) => {
                        const total = ctx.chart.data.datasets[0].data.reduce((a, b) => a + b, 0);
                        return ((value / total) * 100).toFixed(1) + "%";
                    },
                    color: "#fff",
                    font: { size: 16, family: "'Outfit', sans-serif", weight: "500" },
                },
            },
        },
    });

    const totalRepos = report.user.public_repos;
    const totalStars = report.stats.stars;
    const totalForks = report.stats.fork_count;
    repoDisplay.innerText = totalRepos;
    starDisplay.innerText = totalStars;
    forkDisplay.innerText = totalForks;
    const getColor = (val) => {
        const ratio = Math.min(val / 20, 1);
        return `rgb(${Math.floor(255 * (1 - ratio))}, ${Math.floor(255 * ratio)}, 0)`;
    };
    repoDisplay.style.color = getColor(totalRepos);
    starDisplay.style.color = getColor(totalStars);
    forkDisplay.style.color = getColor(totalForks);

    const aiScoreEl = document.getElementById("ai-score-value");
    const aiRecShortEl = document.getElementById("ai-recommendation-short");
    const aiNoReportEl = document.getElementById("ai-no-report");
    const aiNoSwEl = document.getElementById("ai-no-sw");
    const strengthsList = document.getElementById("strengths-list");
    const weaknessesList = document.getElementById("weaknesses-list");
    const aiMoreSection = document.getElementById("ai-report-more");
    const aiRecFullEl = document.getElementById("ai-recommendation-full");
    const highlightsList = document.getElementById("highlights-list");
    const suggestionsList = document.getElementById("suggestions-list");

    [strengthsList, weaknessesList, highlightsList, suggestionsList].forEach((el) => { el.innerHTML = ""; });

    const hasAiData = data.scores != null;
    if (hasAiData) {
        aiScoreEl.textContent = data.scores.overallScore ?? "—";
        aiScoreEl.classList.remove("no-ai");
        const rec = (data.hiringRecommendation || "").trim();
        aiRecShortEl.textContent = rec ? rec.slice(0, 120) + (rec.length > 120 ? "…" : "") : "";
        aiRecShortEl.classList.remove("hidden");
        aiNoReportEl.classList.add("hidden");
        aiNoSwEl.classList.add("hidden");
        (data.strengthsWeaknesses?.strengths || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; strengthsList.appendChild(li); });
        (data.strengthsWeaknesses?.weaknesses || []).forEach((w) => { const li = document.createElement("li"); li.textContent = w; weaknessesList.appendChild(li); });
        aiMoreSection.classList.remove("hidden");
        aiRecFullEl.textContent = rec || "";
        (data.technicalHighlights || []).forEach((h) => { const li = document.createElement("li"); li.textContent = h; highlightsList.appendChild(li); });
        (data.improvementSuggestions || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; suggestionsList.appendChild(li); });
    } else {
        aiScoreEl.textContent = "—";
        aiScoreEl.classList.add("no-ai");
        aiRecShortEl.textContent = "";
        aiRecShortEl.classList.add("hidden");
        aiNoReportEl.classList.remove("hidden");
        aiNoSwEl.classList.remove("hidden");
        aiMoreSection.classList.add("hidden");
        aiRecFullEl.textContent = "";
    }

    const scrollHint = document.getElementById("scroll-indicator");
    if (document.documentElement.scrollHeight > window.innerHeight) scrollHint.classList.add("visible");
    else scrollHint.classList.remove("visible");
}

async function sendToBackend(event) {
    event.preventDefault();
    const usernameInput = document.getElementById("username");
    const submitButton = event.target.querySelector("button") || document.querySelector("#name-form button");
    const username = (usernameInput.value || "").trim();
    if (!username) return;

    usernameInput.disabled = true;
    submitButton.disabled = true;
    submitButton.innerText = "Searching...";
    showAnalyzingState(false);

    try {
        const res = await fetch(`${API_BASE}/api/analyze`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, view: "recruiter" }),
        });

        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
            usernameInput.value = "";
            usernameInput.placeholder = body.error || "Request failed. Try again.";
            usernameInput.classList.add("error-shake");
            setTimeout(() => {
                usernameInput.classList.remove("error-shake");
                usernameInput.placeholder = "Enter a GitHub username...";
            }, 2500);
            return;
        }

        const jobId = body.jobId;
        if (!jobId) {
            usernameInput.placeholder = "No job ID returned. Try again.";
            return;
        }

        usernameInput.value = "";
        submitButton.innerText = "Analyzing…";
        showAnalyzingState(true, 0, `Running AI analysis for ${username}…`);

        const poll = async () => {
            const status = await pollStatus(jobId);
            if (!status) {
                showAnalyzingState(false);
                usernameInput.placeholder = "Could not get status. Try again.";
                return;
            }
            const progress = status.progress != null ? status.progress : (status.status === "processing" ? 50 : status.status === "completed" ? 100 : 0);
            showAnalyzingState(true, progress, status.status === "completed" ? "Almost ready…" : `Running AI analysis for ${username}…`);

            if (status.status === "completed") {
                const data = await fetchReport(jobId);
                showAnalyzingState(false);
                if (data) {
                    renderReport(data);
                } else {
                    usernameInput.placeholder = "Report not found. Try again.";
                }
                return;
            }
            if (status.status === "failed") {
                showAnalyzingState(false);
                usernameInput.placeholder = "Analysis failed. Try again.";
                return;
            }
            setTimeout(poll, POLL_INTERVAL_MS);
        };
        await poll();
    } catch (err) {
        console.error(err);
        showAnalyzingState(false);
        usernameInput.placeholder = "Network error. Try again.";
    } finally {
        usernameInput.disabled = false;
        submitButton.disabled = false;
        submitButton.innerText = "Search";
    }
}

window.onscroll = function () {
    const scrollHint = document.getElementById("scroll-indicator");
    if (window.scrollY > 20) scrollHint.classList.remove("visible");
    else if (document.documentElement.scrollHeight > window.innerHeight) scrollHint.classList.add("visible");
};

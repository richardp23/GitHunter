if (typeof Chart !== "undefined" && typeof ChartDataLabels !== "undefined") {
    Chart.register(ChartDataLabels);
}
let languageChart = null;
let firstSearch = true;

/** Set when a report is rendered; used by the Download PDF button. */
let lastReportUsername = null;

const API_BASE = "http://localhost:5000";
const POLL_INTERVAL_MS = 2000;

/** IDs for the fake loading animation; cleared when analysis completes or fails. */
let fakeProgressIntervalId = null;
let fakeMessageIntervalId = null;

const FAKE_LOADING_MESSAGES = [
    "Asking the AI very nicely…",
    "Counting semicolons…",
    "Reading their README (they have one, right?)…",
    "Checking if they use tabs or spaces…",
    "Evaluating code quality. No pressure…",
    "Consulting the senior engineer in the cloud…",
    "Loading loading loading…",
    "Teaching robots to judge code…",
    "Scanning for TODO comments…",
    "Measuring technical debt in units of regret…",
    "Checking if 'it works on my machine'…",
    "Running the code through the vibe checker…",
    "Convincing the API we're not a bot…",
    "Parsing feelings from commit messages…",
    "Calculating how much coffee was involved…",
    "Waiting for the 847th dependency to install…",
];

document.addEventListener("DOMContentLoaded", () => {
    const center = document.getElementById("center");
    const enterpriseContainer = document.getElementById("enterprise-cards-container");

    if (enterpriseContainer) {
        initEnterprisePortal(enterpriseContainer);
        if (center) setTimeout(() => center.classList.add("fade-in"), 100);
        return;
    }

    const params = new URLSearchParams(window.location.search);
    const usernameFromUrl = params.get("username");
    if (usernameFromUrl && document.getElementById("stats")) {
        loadReportByUsernameFromUrl(usernameFromUrl);
    }

    setTimeout(() => center && center.classList.add("fade-in"), 100);
    const downloadBtn = document.getElementById("download-pdf-btn");
    if (downloadBtn) downloadBtn.addEventListener("click", downloadPdfReport);
    const createSlidesBtn = document.getElementById("create-slides-btn");
    if (createSlidesBtn) createSlidesBtn.addEventListener("click", createSlidesPresentation);
});

/** Load and render report when opening ReportView with ?username= (e.g. from enterprise portal). */
async function loadReportByUsernameFromUrl(username) {
    try {
        const res = await fetch(`${API_BASE}/api/report/latest/${encodeURIComponent(username)}`);
        if (res.ok) {
            const data = await res.json();
            renderReport(data);
        } else {
            const err = await res.json().catch(() => ({}));
            const search = document.getElementById("search");
            if (search) {
                const subtitle = search.querySelector("h2");
                if (subtitle) subtitle.textContent = err.error || "Report not found.";
            }
        }
    } catch (e) {
        console.error(e);
        const search = document.getElementById("search");
        if (search && search.querySelector("h2")) search.querySelector("h2").textContent = "Failed to load report.";
    }
}

/** Enterprise portal: load list, render cards, ensure + navigate on click. */
async function initEnterprisePortal(container) {
    const loadingEl = document.getElementById("enterprise-loading");
    const emptyEl = document.getElementById("enterprise-empty");

    if (loadingEl) loadingEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    container.innerHTML = "";

    try {
        const res = await fetch(`${API_BASE}/api/enterprise/list`);
        const list = res.ok ? await res.json() : [];
        if (loadingEl) loadingEl.classList.add("hidden");
        if (!list || list.length === 0) {
            if (emptyEl) emptyEl.classList.remove("hidden");
            return;
        }
        if (emptyEl) emptyEl.classList.add("hidden");
        list.forEach((entry) => {
            const card = document.createElement("div");
            card.className = "enterprise-card";
            card.dataset.username = entry.username;
            const img = document.createElement("img");
            img.className = "enterprise-card-avatar";
            img.src = entry.avatar_url || "res/logo.png";
            img.alt = entry.username;
            img.loading = "lazy";
            const nameEl = document.createElement("span");
            nameEl.className = "enterprise-card-username";
            nameEl.textContent = entry.username;
            const scoreEl = document.createElement("span");
            scoreEl.className = "enterprise-card-score";
            scoreEl.textContent = entry.score != null ? String(entry.score) : "—";
            card.appendChild(img);
            card.appendChild(nameEl);
            card.appendChild(scoreEl);
            card.addEventListener("click", async () => {
                card.classList.add("enterprise-card-loading");
                try {
                    const ensureRes = await fetch(`${API_BASE}/api/enterprise/ensure/${encodeURIComponent(entry.username)}`);
                    if (ensureRes.ok) {
                        window.location.href = `ReportView.html?username=${encodeURIComponent(entry.username)}`;
                    } else {
                        const err = await ensureRes.json().catch(() => ({}));
                        alert(err.error || "Report not found.");
                    }
                } catch (e) {
                    alert("Failed to load report.");
                } finally {
                    card.classList.remove("enterprise-card-loading");
                }
            });
            container.appendChild(card);
        });
    } catch (e) {
        console.error(e);
        if (loadingEl) loadingEl.classList.add("hidden");
        if (emptyEl) {
            emptyEl.textContent = "Failed to load list.";
            emptyEl.classList.remove("hidden");
        }
    }
}

function clearFakeLoadingIntervals() {
    if (fakeProgressIntervalId != null) {
        clearInterval(fakeProgressIntervalId);
        fakeProgressIntervalId = null;
    }
    if (fakeMessageIntervalId != null) {
        clearInterval(fakeMessageIntervalId);
        fakeMessageIntervalId = null;
    }
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function updateAnalyzingUI(progress, text) {
    const progressEl = document.getElementById("analyzing-progress");
    const fillEl = document.getElementById("analyzing-bar-fill");
    const textEl = document.getElementById("analyzing-text");
    const pct = Math.min(100, Math.max(0, Math.round(progress)));
    if (progressEl) progressEl.textContent = `${pct}%`;
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (textEl && text) textEl.textContent = text;
}

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
        clearFakeLoadingIntervals();
        el.classList.add("hidden");
        if (fillEl) fillEl.style.width = "0%";
    }
}

/**
 * Start the fake progress bar and rotating funny messages. Call clearFakeLoadingIntervals (or showAnalyzingState(false)) to stop.
 * @returns {{ setProgress: (n: number) => void, setMessage: (s: string) => void }}
 */
function startFakeLoadingBar() {
    clearFakeLoadingIntervals();
    let fakeProgress = 0;
    const PROGRESS_CAP = 92;
    const TICK_MS = 320;
    const LOSE_CHANCE = 0.025;   // Rare: ~once every 12–15 sec so it feels intentional
    const LOSE_AMOUNT_MIN = 18;
    const LOSE_AMOUNT_MAX = 35; // Big drop when it happens — clearly a joke
    const GAIN_MIN = 2;
    const GAIN_MAX = 7;         // Substantial progress most of the time

    fakeProgressIntervalId = setInterval(() => {
        if (Math.random() < LOSE_CHANCE) {
            fakeProgress = Math.max(0, fakeProgress - (LOSE_AMOUNT_MIN + Math.random() * (LOSE_AMOUNT_MAX - LOSE_AMOUNT_MIN)));
        } else {
            fakeProgress = Math.min(PROGRESS_CAP, fakeProgress + (GAIN_MIN + Math.random() * (GAIN_MAX - GAIN_MIN)));
        }
        updateAnalyzingUI(fakeProgress, null);
    }, TICK_MS);

    let msgIndex = 0;
    updateAnalyzingUI(0, FAKE_LOADING_MESSAGES[0]);
    fakeMessageIntervalId = setInterval(() => {
        msgIndex = (msgIndex + 1) % FAKE_LOADING_MESSAGES.length;
        const textEl = document.getElementById("analyzing-text");
        if (textEl) textEl.textContent = FAKE_LOADING_MESSAGES[msgIndex];
    }, 2600);

    return {
        setProgress(n) {
            fakeProgress = n;
            updateAnalyzingUI(n, null);
        },
        setMessage(s) {
            const textEl = document.getElementById("analyzing-text");
            if (textEl) textEl.textContent = s;
        },
    };
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
    }

    function updateScrollIndicator() {
        const scrollHint = document.getElementById('scroll-indicator');

        // Check if the body content is taller than the window height
        const isScrollable = document.documentElement.scrollHeight > window.innerHeight;

        if (isScrollable) {
            scrollHint.classList.add('visible');
        } else {
            scrollHint.classList.remove('visible');
        }
    }

    window.onscroll = function() {
        const scrollHint = document.getElementById('scroll-indicator');
        // Hide if user scrolls down more than 20px
        if (window.scrollY > 20) {
            scrollHint.classList.remove('visible');
        } else {
            // Re-check if it should reappear when back at the top
            updateScrollIndicator();
        }
    };

    setTimeout(() => {
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
        const report = data.report || data;
        lastReportUsername = report.user?.login || report.user?.name || null;
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
        const totalForks = report.stats.user_forked_projects;
        const totalCommits = report.stats.commits != null ? report.stats.commits : null;
        const totalPulls = report.stats.pulls != null ? report.stats.pulls : null;
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
        const aiScoreBreakdownEl = document.getElementById("ai-score-breakdown");
        const scoreBreakdownBlock = document.getElementById("score-breakdown-block");
        const aiRecFullEl = document.getElementById("ai-recommendation-full");
        const highlightsList = document.getElementById("highlights-list");
        const techHighlightsList = document.getElementById("tech-highlights-list");
        const suggestionsList = document.getElementById("suggestions-list");
        const improvementSuggestionsList = document.getElementById("improvement-suggestions-list");
        const technicalBreadthEl = document.getElementById("technical-breadth-score");
        const projectComplexityEl = document.getElementById("project-complexity-score");
        const commitsStatEl = document.getElementById("commits-stat");
        const pullsStatEl = document.getElementById("pulls-stat");
        const quickstatsNoAi = document.getElementById("quickstats-no-ai");

        [strengthsList, weaknessesList, techHighlightsList, highlightsList, improvementSuggestionsList, suggestionsList].forEach((el) => { el.innerHTML = ""; });

        const hasAiData = data.scores != null;

        if (technicalBreadthEl) {
            const tb = hasAiData && data.scores.categoryScores && data.scores.categoryScores.technicalBreadth != null
                ? data.scores.categoryScores.technicalBreadth
                : null;
            technicalBreadthEl.textContent = tb != null ? tb : "—";
            technicalBreadthEl.classList.toggle("no-ai", tb == null);
        }
        if (projectComplexityEl) {
            const pc = hasAiData && data.scores.categoryScores && data.scores.categoryScores.projectComplexity != null
                ? data.scores.categoryScores.projectComplexity
                : null;
            projectComplexityEl.textContent = pc != null ? pc : "—";
            projectComplexityEl.classList.toggle("no-ai", pc == null);
        }
        if (commitsStatEl) commitsStatEl.textContent = totalCommits != null ? `Commits (sampled): ${totalCommits}` : "Commits (sampled): —";
        if (pullsStatEl) pullsStatEl.textContent = totalPulls != null ? `PRs: ${totalPulls}` : "PRs: —";
        if (quickstatsNoAi) quickstatsNoAi.classList.toggle("hidden", hasAiData);
        if (hasAiData) {
            console.log(data);

            const categories = [
                "codeQuality",
                "projectComplexity",
                "documentation",
                "consistency",
                "technicalBreadth"
            ];
            const miniCircumference = 213.6;
            categories.forEach(key => {
                const score = data.scores.categoryScores[key] ?? 0;
                const ring = document.getElementById(`${key}-ring`);
                const text = document.getElementById(`${key}-value`);
                if (ring && text) {
                    const offset = miniCircumference - (score / 100) * miniCircumference;
                    const hue = Math.min(Math.max(score * 1.2, 0), 120);
                    const color = `hsl(${hue}, 80%, 60%)`;

                    ring.style.strokeDashoffset = offset;
                    ring.style.stroke = color;
                    text.style.color = color;
            
                    // Animate the number count-up
                    animateValue(text, 0, score, 1000);
                }
            });
            
            const score = data.scores.overallScore ?? 0;
            aiScoreEl.textContent = score;
            aiScoreEl.classList.remove("no-ai");
            const ring = document.getElementById("ai-score-ring");
            const circumference = 502.6;
            const offset = circumference - (score / 100) * circumference;
    
            // 2. Set dynamic colors (Red -> Green)
            const hue = Math.min(Math.max(score * 1.2, 0), 120); 
            const color = `hsl(${hue}, 80%, 60%)`;

            // 3. Apply styles to the Ring
            if (ring) {
                ring.style.strokeDasharray = circumference;
                ring.style.strokeDashoffset = offset;
                ring.style.stroke = color;
                ring.style.filter = `drop-shadow(0 0 4px ${color})`;
            }

            // 4. Apply styles and animate the Number
            if (aiScoreEl) {
                aiScoreEl.classList.remove("no-ai");
                aiScoreEl.style.color = color;
                // Animates from 0 to the final score over 1 second
                animateValue(aiScoreEl, 0, score, 1000); 
            }

            aiScoreEl.style.color = `hsl(${hue}, 80%, 60%)`;
            const rec = (data.hiringRecommendation || "").trim();
            aiRecShortEl.textContent = rec || "";
            aiRecShortEl.classList.remove("hidden");
            aiNoReportEl.classList.add("hidden");
            aiNoSwEl.classList.add("hidden");
            (data.strengthsWeaknesses?.strengths || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; strengthsList.appendChild(li); });
            (data.strengthsWeaknesses?.weaknesses || []).forEach((w) => { const li = document.createElement("li"); li.textContent = w; weaknessesList.appendChild(li); });
            (data.technicalHighlights || []).forEach((h) => { const li = document.createElement("li"); li.textContent = h; techHighlightsList.appendChild(li); });
            aiMoreSection.classList.remove("hidden");
            const breakdown = (data.scoreBreakdown || "").trim();
            if (aiScoreBreakdownEl) aiScoreBreakdownEl.textContent = breakdown || "";
            if (scoreBreakdownBlock) scoreBreakdownBlock.style.display = breakdown ? "block" : "none";
            aiRecFullEl.textContent = rec || "";
            (data.technicalHighlights || []).forEach((h) => { const li = document.createElement("li"); li.textContent = h; highlightsList.appendChild(li); });
            (data.improvementSuggestions || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; suggestionsList.appendChild(li); });
            (data.improvementSuggestions || []).forEach((s) => { const li = document.createElement("li"); li.textContent = s; improvementSuggestionsList.appendChild(li); });
        } else {
            aiScoreEl.textContent = "—";
            aiScoreEl.classList.add("no-ai");
            aiRecShortEl.textContent = "";
            aiRecShortEl.classList.add("hidden");
            aiNoReportEl.classList.remove("hidden");
            aiNoSwEl.classList.remove("hidden");
            aiMoreSection.classList.add("hidden");
            if (aiScoreBreakdownEl) aiScoreBreakdownEl.textContent = "";
            if (scoreBreakdownBlock) scoreBreakdownBlock.style.display = "block";
            aiRecFullEl.textContent = "";
        }

        const downloadWrap = document.getElementById("download-pdf-wrap");
        if (downloadWrap) {
            downloadWrap.classList.remove("hidden");
        }
    }, 400);

    setTimeout(() => {
    const scrollHint = document.getElementById("scroll-indicator");
    const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
    if (isScrollable) {
        scrollHint.classList.add("visible");
    } else {
        scrollHint.classList.remove("visible");
    }
    }, 1200);
}

async function downloadPdfReport() {
    if (!lastReportUsername) return;
    const btn = document.getElementById("download-pdf-btn");
    if (btn) btn.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/api/download/latest/${encodeURIComponent(lastReportUsername)}`);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || "Could not download report.");
            return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `githunter-report-${lastReportUsername}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch (e) {
        alert("Download failed. Check the console.");
        console.error(e);
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function createSlidesPresentation() {
    if (!lastReportUsername) return;
    const btn = document.getElementById("create-slides-btn");
    if (btn) btn.disabled = true;
    const originalText = btn ? btn.textContent : "";
    if (btn) btn.textContent = "Creating…";
    try {
        const res = await fetch(`${API_BASE}/api/slides/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: lastReportUsername }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            alert(data.error || "Could not create presentation.");
            return;
        }
        const link = data.url || data.copyUrl || (data.presentationId
            ? `https://docs.google.com/presentation/d/${data.presentationId}/edit`
            : null);
        if (link) {
            console.log("Presentation made at", link);
            window.open(link, "_blank", "noopener,noreferrer");
        } else {
            alert("No link returned.");
        }
    } catch (e) {
        alert("Request failed. Check the console.");
        console.error(e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
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
        usernameInput.value = "";
        // Use cached full report (including AI) when available, so we don't overwrite Redis with a new job
        const latestRes = await fetch(`${API_BASE}/api/report/latest/${encodeURIComponent(username)}`);
        if (latestRes.ok) {
            const data = await latestRes.json();
            renderReport(data);
            usernameInput.disabled = false;
            submitButton.disabled = false;
            submitButton.innerText = "Search";
            return;
        }

        const gitHubCheck = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`);
        if (gitHubCheck.status === 404) {
            // User definitely does not exist
            usernameInput.value = "";
            usernameInput.placeholder = "GitHub user not found!";
            usernameInput.classList.add("error-shake");
            
            // Reset UI immediately
            usernameInput.disabled = false;
            submitButton.disabled = false;
            submitButton.innerText = "Search";

            setTimeout(() => {
                usernameInput.classList.remove("error-shake");
                usernameInput.placeholder = "Enter a GitHub username...";
            }, 2500);
            return;
        }

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

            usernameInput.disabled = false;
            submitButton.disabled = false;
            submitButton.innerText = "Search";

            setTimeout(() => {
                usernameInput.classList.remove("error-shake");
                usernameInput.placeholder = "Enter a GitHub username...";
            }, 2500);
            return;
        }

        const jobId = body.jobId;
        if (!jobId) {
            usernameInput.placeholder = "No job ID returned. Try again.";
            usernameInput.disabled = false;
            submitButton.disabled = false;
            submitButton.innerText = "Search";
            return;
        }

        usernameInput.value = "";
        submitButton.innerText = "Analyzing…";
        showAnalyzingState(true, 0, FAKE_LOADING_MESSAGES[0]);
        startFakeLoadingBar();

        const poll = async () => {
            const status = await pollStatus(jobId);
            if (!status) {
                showAnalyzingState(false);
                usernameInput.placeholder = "Could not get status. Try again.";
                usernameInput.disabled = false;
                submitButton.disabled = false;
                submitButton.innerText = "Search";
                return;
            }

            if (status.status === "completed") {
                clearFakeLoadingIntervals();
                updateAnalyzingUI(100, "Done! Loading your report…");
                await new Promise((r) => setTimeout(r, 1000));
                const data = await fetchReport(jobId);
                showAnalyzingState(false);
                if (data) {
                    renderReport(data);
                } else {
                    usernameInput.placeholder = "Report not found. Try again.";
                }

                usernameInput.disabled = false;
                submitButton.disabled = false;
                submitButton.innerText = "Search";
                return;
            }
            if (status.status === "failed") {
                showAnalyzingState(false);
                usernameInput.placeholder = "Analysis failed. Try again.";
                usernameInput.disabled = false;
                submitButton.disabled = false;
                submitButton.innerText = "Search";
                return;
            }
            setTimeout(poll, POLL_INTERVAL_MS);
        };
        await poll();
    } catch (err) {
        console.error(err);
        showAnalyzingState(false);
        usernameInput.placeholder = "Network error. Try again.";
        usernameInput.disabled = false;
        submitButton.disabled = false;
        submitButton.innerText = "Search";
    }
}

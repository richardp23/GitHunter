Chart.register(ChartDataLabels);
let languageChart = null;
let firstSearch = true;

document.addEventListener("DOMContentLoaded", () => {
    const center = document.getElementById("center");
    
    // Brief timeout ensures the transition is captured by the browser
    setTimeout(() => {
        center.classList.add("fade-in");
    }, 100);
});

// START OF BACKEND FUNCTION
async function sendToBackend(event) { 
    event.preventDefault();
    const usernameInput = document.getElementById("username");
    const submitButton = event.target.querySelector('button') || document.querySelector('#name-form button');
    const username = usernameInput.value;

    usernameInput.disabled = true;
    submitButton.disabled = true;
    submitButton.innerText = "Searching...";
    
    try {
        const res = await fetch(`http://localhost:5000/api/user/${username}`); 

        if (!res.ok) {
            usernameInput.disabled = false;
            submitButton.disabled = false;
            submitButton.innerText = "Search";

            usernameInput.value = "";
            usernameInput.placeholder = "User not found! Try again.";
            usernameInput.classList.add("error-shake"); // Add a shake effect
            
            // Reset placeholder after 2 seconds
            setTimeout(() => {
                usernameInput.classList.remove("error-shake");
                setTimeout(() => {
                    usernameInput.placeholder = "Enter a GitHub username...";
                }, 100);
            }, 2000);
            
            return; // STOP execution here so nothing else changes
        }
        const data = await res.json(); 
        console.log(data);
    
        usernameInput.value = "";

        // Document vars
        const container = document.getElementById('center');
        const dashboard = document.getElementById('stats');
        const profileCard = document.getElementById('profile-card');
        const avatarImg = document.getElementById('user-avatar');
        const displayName = document.getElementById('user-display-name');
        const centerForm = document.getElementById('center-form');
        const title = document.querySelector('#search h1');
        const subtitle = document.querySelector('#search h2');
        const boxes = document.querySelectorAll('.stats-box');
        const ctx = document.getElementById('language-chart').getContext('2d');
        const repoDisplay = document.getElementById("repo-stat");
        const starDisplay = document.getElementById("star-stat");
        const forkDisplay = document.getElementById("fork-stat");

        // 1. Trigger the layout shift
        if (firstSearch) {
            title.classList.add('text-shrink');
            subtitle.classList.add('text-shrink');
            container.classList.remove('initial-state');
            container.classList.add('results-state');
            dashboard.classList.add('grid-on');
            centerForm.classList.add('expanded');
            profileCard.classList.add('layout-on');
            setTimeout(() => {
                profileCard.classList.add('visible');
            }, 50);

            // After a tiny delay to allow the header to move, show the stats
            setTimeout(() => {
                dashboard.classList.add('visible');

                boxes.forEach((box, index) => {
                    setTimeout(() => {
                        box.classList.add('flipped');
                    }, index * 200); // 200ms between each card
                });
            }, 800);
            firstSearch = false;
        } else {
            boxes.forEach((box, index) => {
            // Reset the class to allow re-triggering
            box.classList.remove('refresh-flip-360');
            void box.offsetHeight; // Force reflow
                setTimeout(() => {
                    box.classList.add('refresh-flip-360');
                }, index * 150);
            });

            if (languageChart) {
                languageChart.destroy();
                ctx.canvas.width = ctx.canvas.width;
            }
            repoDisplay.innerText = "0";
            starDisplay.innerText = "0";
            forkDisplay.innerText = "0";
            repoDisplay.style.color = '#ffffff';
            starDisplay.style.color = '#ffffff';
            forkDisplay.style.color = '#ffffff';
        };

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

        // Name card display
        avatarImg.src = data.report.user.avatar_url;
        displayName.innerText = data.report.user.name || data.report.user.login;

        // Languages used display
        const languages = data.report.stats.language;
        var labels;
        var values;
        var topEntry;

        const topLanguage = document.getElementById("language-header");

        if (Object.keys(languages).length === 0) {
            topLanguage.innerText = "Nothing!";
        } else {
            const sortedEntries = Object.entries(languages)
            .sort(([, a], [, b]) => b - a);

            labels = sortedEntries.map(entry => entry[0]);
            values = sortedEntries.map(entry => entry[1]);

            topEntry = sortedEntries[0][0];
            topLanguage.innerText = topEntry;
        }

        const generateGradients = (count) => {
            const colors = [];
            for (let i = 0; i < count; i++) {
                const lightness = 30 + (i * (50 / count)); 
                colors.push(`hsl(220, 70%, ${lightness}%)`);
            }
            return colors;
        };

        const dynamicColors = generateGradients(labels.length);

        languageChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Languages Used',
                    data: values,
                    backgroundColor: dynamicColors,
                    borderWidth: 2
                }]
            },
            options: {
                color: '#fff',
                maintainAspectRatio: true,
                aspectRatio: 1,
                responsive: true,
                resizeDelay: 0,
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove'],
                interaction: {
                    mode: 'nearest',
                    intersect: true
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 20,
                                family: "'Outfit', sans-serif",
                                weight: '500'
                            },
                        }
                    },
                datalabels: {
                    anchor: 'end',
                    align: 'start',
                    offset: 10,
                    formatter: (value, ctx) => {
                        const data = ctx.chart.data.datasets[0].data;
                        const total = data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return percentage + '%';
                    },
                    color: '#fff',
                    font: {
                        size: 16,
                            family: "'Outfit', sans-serif",
                        weight: '500'
                    }
                }
                }
            }
        });

        const totalRepos = data.report.user.public_repos;
        const totalStars = data.report.stats.stars;
        const totalForks = data.report.stats.fork_count;

        repoDisplay.innerText = totalRepos;
        starDisplay.innerText = totalStars;
        forkDisplay.innerText = totalForks;

        
        const getColor = (val) => {
            const ratio = Math.min(val / 20, 1);
            const r = Math.floor(255 * (1 - ratio));
            const g = Math.floor(255 * ratio);
            return `rgb(${r}, ${g}, 0)`;
        };

        repoDisplay.style.color = getColor(totalRepos);
        starDisplay.style.color = getColor(totalStars);
        forkDisplay.style.color = getColor(totalForks);

        setTimeout(() => {
            updateScrollIndicator();
        }, 2000);

        usernameInput.disabled = false;
        submitButton.disabled = false;
        submitButton.innerText = "Search";

    } catch (error) {
        usernameInput.disabled = false;
        submitButton.disabled = false;
        submitButton.innerText = "Search";
    }
}

Chart.register(ChartDataLabels);
let languageChart = null;

async function sendToBackend(event) { 
    event.preventDefault();
    const username = document.getElementById("username").value; 
    
    // Call backend 
    const res = await fetch(`http://localhost:5000/api/user/${username}`); 
    const data = await res.json(); 

    // TEST DATA THIS IS ONLY ME DONT PUSH TO MAIN
    // const data = testData;

    console.log(data);

    // Languages used display
    const languages = data.report.stats.language;
    const sortedEntries = Object.entries(languages)
        .sort(([, a], [, b]) => b - a);

    const labels = sortedEntries.map(entry => entry[0]);
    const values = sortedEntries.map(entry => entry[1]);

    const topEntry = sortedEntries[0][0];

    const topLanguage = document.getElementById("language-header");
    topLanguage.innerText = topEntry;

    const generateGradients = (count) => {
        const colors = [];
        for (let i = 0; i < count; i++) {
            const lightness = 30 + (i * (50 / count)); 
            colors.push(`hsl(220, 70%, ${lightness}%)`);
        }
        return colors;
    };

    const dynamicColors = generateGradients(labels.length);

    const ctx = document.getElementById('language-chart').getContext('2d');
    if (languageChart) {
        languageChart.destroy();
        ctx.canvas.width = ctx.canvas.width;
    }
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

    // change data to testData to test without API
    const totalRepos = data.report.user.public_repos;
    const totalStars = data.report.stats.stars;
    const totalForks = data.report.stats.fork_count;

    const repoDisplay = document.getElementById("repo-stat");
    const starDisplay = document.getElementById("star-stat");
    const forkDisplay = document.getElementById("fork-stat");

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
}

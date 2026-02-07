let languageChart = null;
async function sendToBackend(event) { 
    event.preventDefault();
    const username = document.getElementById("username").value; 
    // Call backend 
    const res = await fetch(`http://localhost:5000/api/user/${username}`); 
    const data = await res.json(); 

    console.log(data);

    // Languages used display
    const languages = data.report.stats.language;
    console.log(languages);
    const labels = Object.keys(languages);
    const values = Object.values(languages);
    const colors = [
        '#dc3912',
        '#ff9900',
        '#fffc38',
        '#3366cc',
        '#109618',
        '#990099',
    ];
    const ctx = document.getElementById('language-chart').getContext('2d');
    if (languageChart) {
        languageChart.destroy();
    }
    languageChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Languages Used',
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
            legend: {
                position: 'right'
            },
            tooltip: {
                enabled: true
            }
            }
        }
    });
}

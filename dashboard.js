let charts = {};

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("predictionForm")
        .addEventListener("submit", handlePrediction);

    document.getElementById("clearHistory")
        .addEventListener("click", clearHistory);

    loadDashboardData();
    setInterval(loadDashboardData, 30000);
});

/* ---------------- Load Dashboard Data ---------------- */
async function loadDashboardData() {
    try {
        const res = await fetch("/api/stats");
        const data = await res.json();

        updateStatCards(data);
        updateCharts(data);
        updateRecentPredictions(data.recent_predictions);
    } catch (err) {
        console.error("Dashboard load error:", err);
    }
}

/* ---------------- Update Stats ---------------- */
function updateStatCards(data) {
    document.getElementById("totalPredictions").textContent =
        data.total_predictions || 0;

    if (data.avg_confidence_by_model?.length) {
        const avg =
            data.avg_confidence_by_model.reduce(
                (s, x) => s + x.avg_confidence, 0
            ) / data.avg_confidence_by_model.length;

        document.getElementById("avgConfidence").textContent =
            (avg * 100).toFixed(1) + "%";
    }

    document.getElementById("modelsUsed").textContent =
        data.predictions_by_model?.length || 0;

    if (data.predictions_by_class?.length) {
        const top = data.predictions_by_class.reduce(
            (a, b) => b.count > a.count ? b : a
        );
        document.getElementById("topPrediction").textContent =
            capitalize(top._id);
    }
}

/* ---------------- Charts ---------------- */
function updateCharts(data) {

    // Predictions by Class
    if (data.predictions_by_class) {
        createOrUpdateChart("predictionsByClass", {
            type: "bar",
            data: {
                labels: data.predictions_by_class.map(x => capitalize(x._id)),
                datasets: [{
                    label: "Count",
                    data: data.predictions_by_class.map(x => x.count),
                    backgroundColor: [
                        "rgba(102,126,234,0.8)",
                        "rgba(118,75,162,0.8)",
                        "rgba(237,100,166,0.8)"
                    ]
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    // Predictions by Model
    if (data.predictions_by_model) {
        createOrUpdateChart("predictionsByModel", {
            type: "doughnut",
            data: {
                labels: data.predictions_by_model.map(x => prettify(x._id)),
                datasets: [{
                    data: data.predictions_by_model.map(x => x.count),
                    backgroundColor: [
                        "rgba(102,126,234,0.8)",
                        "rgba(118,75,162,0.8)"
                    ]
                }]
            }
        });
    }

    // Confidence Distribution
    if (data.confidence_distribution) {
        createOrUpdateChart("confidenceDistribution", {
            type: "pie",
            data: {
                labels: data.confidence_distribution.map(x => x._id),
                datasets: [{
                    data: data.confidence_distribution.map(x => x.count),
                    backgroundColor: [
                        "rgba(40,167,69,0.8)",
                        "rgba(255,193,7,0.8)",
                        "rgba(220,53,69,0.8)"
                    ]
                }]
            }
        });
    }

    // Model Comparison
    if (data.avg_confidence_by_model) {
        createOrUpdateChart("modelComparison", {
            type: "bar",
            data: {
                labels: data.avg_confidence_by_model.map(x => prettify(x._id)),
                datasets: [{
                    label: "Avg Confidence (%)",
                    data: data.avg_confidence_by_model.map(
                        x => (x.avg_confidence * 100).toFixed(2)
                    ),
                    backgroundColor: "rgba(102,126,234,0.8)"
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, max: 100 }
                }
            }
        });
    }
}

function createOrUpdateChart(id, config) {
    const ctx = document.getElementById(id);
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(ctx, config);
}

/* ---------------- Recent Predictions ---------------- */
function updateRecentPredictions(list) {
    const box = document.getElementById("recentPredictionsList");
    box.innerHTML = "";

    if (!list?.length) {
        box.innerHTML = "<p style='text-align:center;color:#999;'>No predictions yet</p>";
        return;
    }

    list.forEach(p => {
        const t = new Date(p.timestamp.$date || p.timestamp).toLocaleString();
        const div = document.createElement("div");
        div.className = "prediction-item";
        div.innerHTML = `
            <div class="prediction-time">${t}</div>
            <div>${capitalize(p.prediction)}</div>
            <div>${prettify(p.model)}</div>
            <div>${(p.confidence * 100).toFixed(1)}%</div>
        `;
        box.appendChild(div);
    });
}

/* ---------------- Prediction ---------------- */
async function handlePrediction(e) {
    e.preventDefault();

    const features = [
        +sepal_length.value,
        +sepal_width.value,
        +petal_length.value,
        +petal_width.value
    ];

    const model = document.getElementById("model").value;

    const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ features, model })
    });

    const data = await res.json();
    if (!res.ok) return alert(data.error);

    const box = document.getElementById("predictionResult");
    box.style.display = "block";
    box.innerHTML = `
        <strong>Prediction:</strong> ${capitalize(data.prediction)}<br>
        <strong>Confidence:</strong> ${(data.confidence * 100).toFixed(2)}%<br>
        <strong>Model:</strong> ${prettify(data.model_used)}
    `;

    loadDashboardData();
}

/* ---------------- Clear History ---------------- */
async function clearHistory() {
    if (!confirm("Clear all prediction history?")) return;

    const res = await fetch("/api/clear-history", { method: "POST" });
    const data = await res.json();

    alert(`Cleared ${data.deleted_count} records`);
    loadDashboardData();
}

/* ---------------- Helpers ---------------- */
const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
const prettify = s => s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase());

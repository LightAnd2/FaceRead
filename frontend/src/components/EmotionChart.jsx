import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const EMOTION_COLORS = {
  happy:     "#f9ca24",
  sad:       "#4fc3f7",
  angry:     "#ef5350",
  surprised: "#ff9800",
  neutral:   "#90a4ae",
  fear:      "#ab47bc",
  disgust:   "#66bb6a",
};

const EMOTIONS = Object.keys(EMOTION_COLORS);
const HISTORY_LEN = 30;

export default function EmotionChart({ history }) {
  const labels = history.map((_, i) => {
    const secsAgo = (history.length - 1 - i);
    return secsAgo === 0 ? "now" : `-${secsAgo}s`;
  });

  const datasets = EMOTIONS.map((emotion) => ({
    label: emotion,
    data: history.map((h) => (h ? (h[emotion] ?? 0) : null)),
    borderColor: EMOTION_COLORS[emotion],
    backgroundColor: EMOTION_COLORS[emotion] + "18",
    borderWidth: 2,
    pointRadius: 0,
    pointHoverRadius: 4,
    tension: 0.4,
    fill: false,
    spanGaps: true,
  }));

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: {
          color: "#7b7f96",
          font: { size: 10 },
          maxTicksLimit: 7,
        },
      },
      y: {
        min: 0,
        max: 100,
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: {
          color: "#7b7f96",
          font: { size: 10 },
          callback: (v) => `${v}%`,
          stepSize: 25,
        },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#7b7f96",
          font: { size: 11 },
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 12,
        },
      },
      tooltip: {
        backgroundColor: "#1a1d27",
        borderColor: "#2a2d3e",
        borderWidth: 1,
        titleColor: "#e8eaf0",
        bodyColor: "#7b7f96",
        callbacks: {
          label: (ctx) =>
            ` ${ctx.dataset.label}: ${ctx.parsed.y?.toFixed(1) ?? "—"}%`,
        },
      },
    },
  };

  return (
    <div className="chart-card">
      <div className="card-header">
        <span className="card-title">History</span>
        <span className="chart-sub">last {HISTORY_LEN}s</span>
      </div>
      <div style={{ height: 200 }}>
        <Line data={{ labels, datasets }} options={options} />
      </div>
    </div>
  );
}

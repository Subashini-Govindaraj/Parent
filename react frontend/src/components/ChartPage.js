import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import EmployeeDashboard from "./EmployeeDashboard";
import ServiceLineDashboard from "./ServiceLineDashboard";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const tabNames = ["Overall", "Streamline", "Employee", "Upgrade", "Downgrade"];

function ChartPage() {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [months, setMonths] = useState(1);
  const [activeTab, setActiveTab] = useState("Overall");
  const [refreshKey, setRefreshKey] = useState(0);
  const [uploadMonth, setUploadMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
const [selectedServiceLine, setSelectedServiceLine] = useState(""); 
const [serviceLines, setServiceLines] = useState([]); 
const [scores, setScores] = useState(null);
  const chartOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: "Service Line Averages Comparison" },
    },
    scales: {
      y: {
        ticks: {
          stepSize: 1,
          callback: (value) => {
            if (value === 0) return "No Score";
            if (value === 1) return "Bronze";
            if (value === 2) return "Silver";
            if (value === 3) return "Gold";
            return value;
          },
        },
        min: 0,
        max: 3,
      },
    },
  }), []);

  const fetchChartData = useCallback(() => {
    fetch(`http://localhost:8000/timeseries/serviceline?months=${months}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.data) {
          setChartData({ labels: [], datasets: [] });
          return;
        }
        const labels = Object.keys(data.data);
        const datasets = data.months.map((m, idx) => {
          const values = labels.map((sl) => data.data[sl]?.[m] ?? 0);
          const colors = [
            "rgba(99, 102, 241, 0.75)",
            "rgba(56, 189, 248, 0.75)",
            "rgba(248, 113, 113, 0.75)",
            "rgba(34,197,94,0.75)",
          ];
          return {
            label: formatMonth(m),
            data: values,
            backgroundColor: colors[idx % colors.length],
            borderRadius: 12,
            borderWidth: 0,
          };
        });
        setChartData({ labels, datasets });
        setServiceLines(labels); // populate service line filter
      })
      .catch((err) => console.error("Error fetching chart data:", err));
  }, [months, refreshKey]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const handleExcelUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!uploadMonth) {
      setUploadFeedback({ type: "error", message: "Pick the data month before uploading." });
      event.target.value = "";
      setTimeout(() => setUploadFeedback(null), 4000);
      return;
    }

    const formData = new FormData();
    formData.append("month", uploadMonth);
    formData.append("file", file);

    setIsUploading(true);
    setUploadFeedback({ type: "info", message: "Uploading…" });
setTimeout(() => setUploadFeedback(null), 4000);
    try {
      const response = await fetch("http://localhost:8000/upload_excel", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed. Please try again.");
      }

      const payload = await response.json();
if (payload.status === "ok") { 
  setUploadFeedback({ 
    type: "success", 
    message: `Imported ${payload.rows} rows for ${formatMonth(uploadMonth)}.`, 
  }); 
  setRefreshKey((key) => key + 1); 
  setTimeout(() => setUploadFeedback(null), 4000); 
} else { 
  throw new Error(payload.message || "Upload failed"); 
}
    } catch (error) {
      setUploadFeedback({ type: "error", message: error.message || "Upload failed." });
      setTimeout(() => setUploadFeedback(null), 4000);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  function formatMonth(ym) {
    const [year, month] = ym.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  }

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header">
        <div className="brand-cluster">
          <span className="brand-pill">DPS</span>
          <div>
            <p className="brand-title">DPS Tool</p>
            <p className="brand-subtitle">Insights Through Analysis</p>
          </div>
        </div>

        <div className="header-controls">
          <div className="tab-group">
            {tabNames.map((tab) => (
              <button
                key={tab}
                className={`tab-button ${activeTab === tab ? "tab-button--active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="upload-wrapper">
            <input
              type="month"
              value={uploadMonth}
              onChange={(e) => setUploadMonth(e.target.value)}
              className="month-input"
            />
            <label className={`upload-btn ${isUploading ? "upload-btn--loading" : ""}`}>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleExcelUpload}
                disabled={isUploading}
              />
              {isUploading ? "Uploading…" : "Upload Excel"}
            </label>
          </div>
        </div>
      </header>

      {uploadFeedback && (
        <div className={`upload-feedback upload-feedback--${uploadFeedback.type}`}>
          {uploadFeedback.message}
        </div>
      )}

      <main className="dashboard-content">
        {activeTab === "Overall" ? (
          <section className="chart-card">
            <div className="card-header">
              <div>
                <p className="eyebrow">Overview</p>
                <h2>Service line performance trend</h2>
              </div>
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="months-select"
              >
                <option value={1}>Past 1 Month + Current</option>
                <option value={2}>Past 2 Months + Current</option>
                <option value={3}>Past 3 Months + Current</option>
              </select>
            </div>
            <Bar data={chartData} options={chartOptions} />
          </section>
        ) : activeTab === "Streamline" ? (
          <section className="chart-card">
            <div className="card-header" style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <p className="eyebrow">Streamline</p>
                <h2>Streamline Performance Trend</h2>
              </div>

              {/* Month selector */}
              <div style={{ flex: 1 }}>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="months-select"
                >
                  <option value={1}>Past 1 Month + Current</option>
                  <option value={2}>Past 2 Months + Current</option>
                  <option value={3}>Past 3 Months + Current</option>
                </select>
              </div>

              {/* Service line filter only in Streamline tab */}
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: "10px" }}>Service Line Based Filter</h3>
                <select
                  onChange={(e) => {
                    setSelectedServiceLine(e.target.value);
                    setScores(null); // reset employee charts
                  }}
                  value={selectedServiceLine}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: "1px solid #aaa",
                    fontSize: "14px",
                    width: "100%"
                  }}
                >
                  <option value="">Select Service Line</option>
                  {serviceLines.map((sl) => (
                    <option key={sl} value={sl}>
                      {sl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Show ServiceLineDashboard when a service line is selected */}
            {selectedServiceLine && (
              <ServiceLineDashboard
                selectedServiceLine={selectedServiceLine}
                months={months}
                chartOptions={chartOptions}
              />
            )}
          </section>
        ) : (
<section className="chart-card"> 
  <EmployeeDashboard months={months} setMonths={setMonths} /> 
  </section>
        )}
      </main>
    </div>
  );

}

export default ChartPage;

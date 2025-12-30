import React, { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";

const categories = [
  { key: "GenAI_Maturity", label: "GenAI Maturity" },
  { key: "DPS_Ranking", label: "DPS Ranking" },
  { key: "Performance", label: "Performance" },
  { key: "Activity", label: "Activity" },
  { key: "Collaboration", label: "Collaboration" },
  { key: "Efficiency", label: "Efficiency" }
];

export default function ServiceLineDeviation({ selectedServiceLine, months }) {
  const [deviationData, setDeviationData] = useState(null);

  useEffect(() => {
    if (!selectedServiceLine) return;

    fetch(`http://localhost:8000/service-line-deviation?service_line=${selectedServiceLine}&months=${months}`)
      .then((res) => res.json())
      .then((data) => setDeviationData(data))
      .catch((err) => console.error("Error fetching service line deviation:", err));
  }, [selectedServiceLine, months]);

const labelMap = {
  0: "No Score",
  1: "Bronze",
  2: "Silver",
  3: "Gold"
};

const chartOptions = {
  plugins: {
    tooltip: {
      callbacks: {
        label: function (context) {
          const month = context.label;
          const metricKey = context.dataset.metricKey;
          const counts = deviationData.data[month][metricKey].counts;
          return [
            `Avg: ${context.formattedValue}`,
            `No Score: ${counts["No Score"]}`,
            `Bronze: ${counts["Bronze"]}`,
            `Silver: ${counts["Silver"]}`,
            `Gold: ${counts["Gold"]}`
          ];
        }
      }
    }
  },
  scales: {
    y: {
      min: 0,
      max: 3,
      ticks: {
        stepSize: 1,
        callback: function (value) {
          return labelMap[value] || value;
        }
      }
    }
  }
};

  if (!selectedServiceLine || !deviationData) return null;

  return (
    <>
      <h2>Service Line Wise Trade: {selectedServiceLine}</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "30px",
          marginTop: "40px"
        }}
      >
        {/* Employees table */}
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: "8px",
            padding: "8px",
            backgroundColor: "#fff",
            maxHeight: "400px",
            overflowY: "auto"
          }}
        >
          <h3>Employees in {selectedServiceLine}</h3>
          <div style={{ maxHeight: "140px", overflowY: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "13px"
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#f2f2f2" }}>
                  <th style={{ border: "1px solid #ddd", padding: "6px" }}>Employee ID</th>
                  <th style={{ border: "1px solid #ddd", padding: "6px" }}>Name</th>
                </tr>
              </thead>
              <tbody>
                {deviationData.employees?.map((emp) => (
                  <tr key={emp.Employee_id}>
                    <td style={{ border: "1px solid #ddd", padding: "6px" }}>{emp.Employee_id}</td>
                    <td style={{ border: "1px solid #ddd", padding: "6px" }}>{emp.Name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts */}
{categories.map((cat) => {
  if (!deviationData.data) return null;

  const monthsList = Object.keys(deviationData.data).sort();
  const values = monthsList.map((m) => deviationData.data[m]?.[cat.key]?.avg ?? 0);

  const chartData = {
    labels: monthsList,
    datasets: [
      {
        label: cat.label,
        data: values,
        backgroundColor: "rgba(54,162,235,0.6)",
        borderRadius: 8,
        metricKey: cat.key
      }
    ]
  };

  const labelMap = { 0: "No Score", 1: "Bronze", 2: "Silver", 3: "Gold" };

  const chartOptions = {
    plugins: {
      tooltip: {
        callbacks: {
          label: function (context) {
            const month = context.label;
            const metricKey = context.dataset.metricKey;
            const counts = deviationData.data[month][metricKey].counts;
            return [
              `Avg: ${context.formattedValue}`,
              `No Score: ${counts["No Score"]}`,
              `Bronze: ${counts["Bronze"]}`,
              `Silver: ${counts["Silver"]}`,
              `Gold: ${counts["Gold"]}`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: 3,
        ticks: {
          stepSize: 1,
          callback: function (value) {
            return labelMap[value] || value;
          }
        }
      }
    }
  };

  return (
    <div
      key={`deviation-${cat.key}`}
      style={{
        border: "1px solid #ddd",
        borderRadius: "8px",
        padding: "8px",
        backgroundColor: "#fff"
      }}
    >
      <h3 style={{ textAlign: "center" }}>{cat.label}</h3>
      <Bar data={chartData} options={chartOptions} />
    </div>
  );
})}

      </div>
    </>
  );
}

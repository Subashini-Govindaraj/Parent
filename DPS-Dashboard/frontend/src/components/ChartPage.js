import React, { useEffect, useState } from "react";
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function ChartPage() {
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [months, setMonths] = useState(1);
  const [serviceLines, setServiceLines] = useState([]);
  const [selectedServiceLine, setSelectedServiceLine] = useState("");
  const [deviationData, setDeviationData] = useState(null);
  const [name, setName] = useState(null);

  function formatMonth(ym) {
    const [year, month] = ym.split("-");
    const date = new Date(year, month - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  }
  const downloadDecreasedData = () => {
    // We assume 'months' state or a specific month string is available
    // For this example, let's use the current date or a selected month
    const targetMonth = new Date().toISOString().slice(0, 7);
    const url = `http://localhost:8000/download-decreased-performance?month=${targetMonth}`;

    // Trigger download
    window.location.href = url;
  };

  useEffect(() => {
    fetch(`http://localhost:8000/service-line-comparison?months=${months}`)
      .then((res) => res.json())
      .then((data) => {
        const labels = Object.keys(data.data);

        const datasets = data.months.map((m, idx) => {
          const values = labels.map((sl) => data.data[sl][m] ?? 0);
          const colors = [
            "rgba(255,99,132,0.6)",
            "rgba(75,192,192,0.6)",
            "rgba(54,162,235,0.6)",
          ];
          return {
            label: formatMonth(m), // 👈 human-friendly month name
            data: values,
            backgroundColor: colors[idx % colors.length],
            borderRadius: 8,
          };
        });

        setChartData({ labels, datasets });
      })
      .catch((err) => console.error("Error fetching chart data:", err));
  }, [months]);


  useEffect(() => {
    fetch("http://localhost:8000/service-lines")
      .then(res => res.json())
      .then(data => setServiceLines(data))
      .catch(err => console.error("Error fetching service lines:", err));
  }, []);
  const categories = [
    { key: "genai_avg", label: "GenAI" },
    { key: "dps_ranking_avg", label: "DPS Ranking" },
    { key: "performance_avg", label: "Performance" },
    { key: "activity_avg", label: "Activity" },
    { key: "collaboration_avg", label: "Collaboration" },
    { key: "efficiency_avg", label: "Efficiency" },
  ];

  const medalMap = { "No Score": 0, "Bronze": 1, "Silver": 2, "Gold": 3 };
  const reverseMap = ["No Score", "Bronze", "Silver", "Gold"];
  const [searchName, setSearchName] = useState("");
  const [scores, setScores] = useState(null);
  const medalColors = {
    0: "rgba(169,169,169,0.8)", // gray
    1: "rgba(205,127,50,0.8)",  // bronze
    2: "rgba(192,192,192,0.8)", // silver
    3: "rgba(255,215,0,0.8)"    // gold
  };
  const handleSearch = async () => {
    try {
      const res = await fetch(
        `http://localhost:8000/employee-month-compare?name=${encodeURIComponent(searchName)}&months=${months}`
      );
      const data = await res.json();
      console.log("API response:", data);

      if (data.scores) {
        setName(data.employee_name);
        setScores(data.scores);   // 👈 store only the scores dictionary
      } else {
        setScores(null);
      }
    } catch (err) {
      console.error("Error fetching employee data:", err);
      setScores(null);
    }
  };


  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
          label: function (context) {
            const value = context.raw;
            return reverseMap[value] || "No Score";
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
            return reverseMap[value] || "";
          }
        }
      }
    }
  };
  useEffect(() => {
    if (!selectedServiceLine) return;
    fetch(
      `http://localhost:8000/service-line-deviation?service_line=${selectedServiceLine}&months=${months}`
    )
      .then((res) => res.json())
      .then((data) => {
        console.log("Deviation data:", data);
        setDeviationData(data);
      })
      .catch((err) => console.error("Error fetching deviation:", err));
  }, [selectedServiceLine, months]); // 👈 re-run when either changes


  return (
    <div style={{ width: "900px", margin: "50px auto" }}>
      {/* Filters */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "20px",
          marginBottom: "20px",
          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
          display: "flex",
          justifyContent: "space-between",
          gap: "40px"
        }}
      >
        {/* Monthly filter */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "10px" }}>Monthly Based Filter</h3>
          <select
            value={months}
            onChange={(e) => {
              setMonths(Number(e.target.value));
              setScores(null);   // 👈 reset employee charts
            }}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #aaa",
              fontSize: "14px",
              width: "100%"
            }}
          >
            <option value={1}>Past 1 Month</option>
            <option value={2}>Past 2 Months</option>
            <option value={3}>Past 3 Months</option>
          </select>
        </div>

        {/* Service line filter */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "10px" }}>Service Line Based Filter</h3>
          <select
            onChange={(e) => {
              setSelectedServiceLine(e.target.value);
              setScores(null);   // 👈 reset employee charts
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

        {/* Employee search */}
        <div style={{ flex: 1 }}>
          <h3 style={{ marginBottom: "10px" }}>Employee Search</h3>
          <div style={{ display: "flex", alignItems: "center" }}>
            <input
              type="text"
              placeholder="Enter employee name..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              style={{
                marginRight: "10px",
                padding: "8px",
                flex: 1,
                borderRadius: "6px",
                border: "1px solid #aaa",
                fontSize: "14px"
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #aaa",
                backgroundColor: "#f5f5f5",
                cursor: "pointer"
              }}
            >
              Search
            </button>
          </div>
        </div>
      </div>

      {/* // ... inside your return () ... */}
      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <button
          onClick={downloadDecreasedData}
          style={{
            padding: "10px 20px",
            backgroundColor: "#ff4d4f",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
          }}
        >
          Download Decreased Performance
        </button>
      </div>
      {/* Conditionally render charts */}
      {/* Conditionally render charts */}
      {/* Conditionally render charts */}
      {scores ? (() => {
        const months = Object.keys(scores).sort();

        // compute per-month averages
        const monthAverages = months.map((m) => {
          const monthScores = scores[m];
          const sum = categories.reduce((acc, cat) => acc + (monthScores[cat.key] ?? 0), 0);
          return Math.round(sum / categories.length);
        });

        // compute overall average across all months
        const overallAvg = Math.round(monthAverages.reduce((acc, val) => acc + val, 0) / monthAverages.length);

        return (
          <>
            <h2>Employee Wise Trade: {searchName}, {name}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "30px",
                marginTop: "40px"
              }}
            >

              {categories.map((cat) => {
                const values = months.map((m) => scores[m][cat.key] ?? 0);

                const chartData = {
                  labels: months,
                  datasets: [
                    {
                      label: cat.label,
                      data: values,
                      backgroundColor: "rgba(54,162,235,0.6)",
                      borderRadius: 8
                    }
                  ]
                };

                return (
                  <div key={`employee-${cat.key}`}>
                    <h3 style={{ textAlign: "center" }}>{cat.label}</h3>
                    <Bar data={chartData} options={options} />
                  </div>
                );
              })}

              {/* Overall averages chart */}
              <div key="employee-overall">
                <h3 style={{ textAlign: "center" }}>Overall Average</h3>
                <Bar
                  data={{
                    labels: months,
                    datasets: [
                      {
                        label: "Monthly Average",
                        data: monthAverages,
                        backgroundColor: "rgba(255, 159, 64, 0.6)",
                        borderRadius: 8
                      }
                    ]
                  }}
                  options={options}
                />
                <p style={{ textAlign: "center", marginTop: "10px" }}>
                  Grand Average Across Months: {overallAvg.toFixed(2)}
                </p>
              </div>
            </div>
          </>
        );
      })() : selectedServiceLine && deviationData ? (
  <> 
    <h2>Service Line Wise Trade: {selectedServiceLine}</h2> 

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)", // 3 equal columns
        gap: "30px",
        marginTop: "40px"
      }}
    >
      {/* Charts */}
            {/* Employees table as a grid item */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "8px",
          backgroundColor: "#fff",
          maxHeight: "400px",   // fixed height
          overflowY: "auto"     // scroll if too many rows
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
              <th style={{ border: "1px solid #ddd", padding: "6px" }}>
                Employee ID
              </th>
              <th style={{ border: "1px solid #ddd", padding: "6px" }}>
                Name
              </th>
            </tr>
          </thead>
          <tbody>
            {deviationData.employees?.map((emp) => (
              <tr key={emp.Employee_id}>
                <td style={{ border: "1px solid #ddd", padding: "6px" }}>
                  {emp.Employee_id}
                </td>
                <td style={{ border: "1px solid #ddd", padding: "6px" }}>
                  {emp.Name}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
      {categories.map((cat) => {
        if (!deviationData.data) return null;

        const months = Object.keys(deviationData.data).sort();
        const values = months.map((m) => {
          const raw = deviationData.data[m]?.[cat.key] ?? 0;
          return typeof raw === "number" ? Math.round(raw) : medalMap[raw];
        });
        const colors = values.map((val) => medalColors[val]);

        const chartData = {
          labels: months,
          datasets: [
            {
              label: cat.label,
              data: values,
              backgroundColor: colors,
              borderRadius: 8
            }
          ]
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
            <Bar data={chartData} options={options} />
          </div>
        );
      })}
    </div>
  </>) : (
        // Default main chart
        <>
          <h2>Overall Analysis</h2>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: "top" },
                title: { display: true, text: "Service Line Averages Comparison" },
              },
              scales: {
                y: {
                  ticks: {
                    stepSize: 1,
                    callback: function (value) {
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
            }}
          />
        </>
      )}



    </div>
  );

}

export default ChartPage;

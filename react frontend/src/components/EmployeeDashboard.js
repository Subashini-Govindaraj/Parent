// EmployeeDashboard.jsx
import React, { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";

export default function EmployeeDashboard({ months, setMonths }) {
  const [employees, setEmployees] = useState([]);
  const [searchName, setSearchName] = useState("");
  const [employeeId, setEmployeeId] = useState(null);
  const [scores, setScores] = useState(null);
  const [name, setName] = useState("");
  const [monthAverages, setMonthAverages] = useState([]);
  const [overallAvg, setOverallAvg] = useState(0);
  const [filtered, setFiltered] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
    const [showName,setShowName] = useState(null);
  const categories = [
    { key: "genai_avg", label: "GenAI Maturity" },
    { key: "dps_ranking_avg", label: "DPS Ranking" },
    { key: "performance_avg", label: "Performance" },
    { key: "activity_avg", label: "Activity" },
    { key: "collaboration_avg", label: "Collaboration" },
    { key: "efficiency_avg", label: "Efficiency" }
  ];

  // Medal mapping
  const medalMap = { "No Score": 0, Bronze: 1, Silver: 2, Gold: 3 };
  const reverseMap = ["No Score", "Bronze", "Silver", "Gold"];

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      tooltip: {
        callbacks: {
label: function (context) { return `Average: ${context.raw.toFixed(2)}`; }
        }
      }
    },
    scales: {
y: { min: 0, max: 3, 
    ticks: { stepSize: 1, 
        callback: function (value) { // Map 0 → No Score, 1 → Bronze, 2 → Silver, 3 → Gold 
        return reverseMap[value] || ""; 
    } } }
    }
  };

  // Fetch employees list on mount
  useEffect(() => {
    fetch("http://localhost:8000/employees")
      .then((res) => res.json())
      .then((data) => setEmployees(data))
      .catch((err) => console.error("Error fetching employees:", err));
  }, []);

  const handleSearch = async () => {
    if (!employeeId) return;
    setShowName(searchName);
    try {
      const res = await fetch(
        `http://localhost:8000/timeseries/employee/${employeeId}?months=${months}`
      );
      const data = await res.json();
      console.log("API response:", data);

      if (data.scores) {
        setName(data.employee_name);
        setScores(data.scores);

        // compute averages
        const monthKeys = Object.keys(data.scores);
        const averages = monthKeys.map((m) => {
          const vals = Object.values(data.scores[m]);
          return vals.reduce((a, b) => a + b, 0) / vals.length;
        });
        setMonthAverages(averages);
        setOverallAvg(
          averages.reduce((a, b) => a + b, 0) / (averages.length || 1)
        );
      } else {
        setScores(null);
      }
    } catch (err) {
      console.error("Error fetching employee data:", err);
      setScores(null);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchName(value);

    if (value.trim() === "") {
      setFiltered([]);
      setShowDropdown(false);
      return;
    }

    // Filter employees by name OR id
    const results = employees.filter(
      (emp) =>
        emp.Name.toLowerCase().includes(value.toLowerCase()) ||
        emp["Employee id"].toString().includes(value)
    );
    setFiltered(results);
    setShowDropdown(true);
  };

  const handleSelect = (emp) => {
    setSearchName(`${emp.Name} (${emp["Employee id"]})`);
    setEmployeeId(emp["Employee id"]);
    setShowDropdown(false);
  };

  return (
    <>
      <div className="card-header">
        <div>
          <p className="eyebrow">Employee Overview</p>
          <h2> {showName && showName.trim() !== "" ? `Employee Performance Trend of : ${searchName}` : "Employee Performance Trend"} </h2>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", position: "relative" }}>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="months-select"
          >
            <option value={1}>Past 1 Month + Current</option>
            <option value={2}>Past 2 Months + Current</option>
            <option value={3}>Past 3 Months + Current</option>
          </select>

          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              placeholder="Search employee by name or ID..."
              value={searchName}
              onChange={handleInputChange}
              onFocus={() => setShowDropdown(true)}
              style={{ width: "100%", padding: "8px" }}
            />
            {showDropdown && filtered.length > 0 && (
              <ul
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "white",
                  border: "1px solid #ccc",
                  maxHeight: "200px",
                  overflowY: "auto",
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  zIndex: 10
                }}
              >
                {filtered.map((emp) => (
                  <li
                    key={emp["Employee id"]}
                    onClick={() => handleSelect(emp)}
                    style={{
                      padding: "8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #eee"
                    }}
                  >
                    {emp.Name} ({emp["Employee id"]})
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button onClick={handleSearch}>Search</button>
        </div>
      </div>

      {scores && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "30px",
              marginTop: "40px"
            }}
          >
            {categories.map((cat) => {
              const values = Object.keys(scores).map(
                (m) => scores[m][cat.key] ?? 0
              );
              const chartData = {
                labels: Object.keys(scores),
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
                  labels: Object.keys(scores),
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
      )}
    </>
  );
}

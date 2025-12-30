import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

function ExcelUploader() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const validateFile = (selectedFile) => {
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop().toLowerCase();
      if (ext === "xls" || ext === "xlsx") {
        setFile(selectedFile);
      } else {
        alert("Please upload only Excel files (.xls, .xlsx)");
      }
    }
  };

  const handleFileChange = (e) => validateFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    validateFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      alert("No file selected!");
      return;
    }
    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);
        const now = new Date();
const month = now.toISOString().slice(0, 7); // gives "YYYY-MM"
formData.append("month", month);
    console.log(formData);

    try {
      const response = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Upload result:", result);
        setLoading(false);
        navigate("/chart", { state: { data: result } }); // pass response data
      } else {
        setLoading(false);
        alert("Upload failed!");
      }
    } catch (err) {
      setLoading(false);
      alert("Error uploading file!");
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", background: "#f5f5f5" }}>
      <div
        style={{
          width: "400px",
          padding: "30px",
          background: "white",
          borderRadius: "10px",
          boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <h2>Upload Excel File</h2>

        {loading ? (
          <p>Loading... ⏳</p>
        ) : (
          <>
            <div
              style={{
                border: dragActive ? "2px dashed #4CAF50" : "2px dashed #ccc",
                borderRadius: "10px",
                padding: "30px",
                marginBottom: "20px",
                background: dragActive ? "#e8f5e9" : "#fafafa",
                cursor: "pointer",
              }}
              onClick={() => document.getElementById("fileInput").click()}
            >
              {file ? <p>{file.name}</p> : <p>Drag & Drop Excel file here or click to select</p>}
              <input
                id="fileInput"
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </div>

            <button
              onClick={handleUpload}
              style={{
                padding: "10px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
              }}
            >
              Upload
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ExcelUploader;

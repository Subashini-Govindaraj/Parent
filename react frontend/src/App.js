import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./App.css";
import ExcelUploader from "./components/ExcelUploader";
import ChartPage from "./components/ChartPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ChartPage />} />
        {/* <Route path="/upload" element={<ExcelUploader />} /> */}
      </Routes>
    </Router>
  );
}

export default App;

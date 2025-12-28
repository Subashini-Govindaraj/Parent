import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ExcelUploader from "./components/ExcelUploader";
import ChartPage from "./components/ChartPage";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ExcelUploader />} />
        <Route path="/chart" element={<ChartPage />} />
      </Routes>
    </Router>
  );
}

export default App;

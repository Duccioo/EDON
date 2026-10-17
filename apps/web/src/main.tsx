import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/doto";
import "./style.css";
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

if (import.meta.env.DEV) {
  fetch("/api/method/excom.www.excom.get_context_for_dev", {
    method: "POST",
  })
    .then((response) => response.json())
    .then((values) => {
      const v = JSON.parse(values.message);
      // @ts-expect-error
      if (!window.frappe) window.frappe = {};
      // @ts-expect-error
      window.frappe.boot = v;
      ReactDOM.createRoot(
        document.getElementById("root") as HTMLElement
      ).render(
        <React.StrictMode>
          <App />
        </React.StrictMode>
      );
    });
} else {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

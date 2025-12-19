document.addEventListener("DOMContentLoaded", () => {
  const $ = id => document.getElementById(id);

  /* ================= ELEMENTS ================= */
  const fields = {
    project: $("project"),
    client: $("client"),
    date: $("date"),
    method: $("method"),
    severity: $("severity"),
    defectType: $("defectType"),
    result: $("result"),
    acceptance: $("acceptance"),
    specification: $("specification"),
    inspector: $("inspector"),
    status: $("status"),
    defect: $("defect")
  };

  const saveBtn = $("saveBtn");
  const pdfBtn = $("pdfBtn");
  const reportList = $("reportList");
  const yearEl = $("year");
  const themeToggle = $("themeToggle");
  const statusFilter = $("statusFilter");
  const exportBtn = $("exportBtn");

  const openCount = $("openCount");
  const reviewCount = $("reviewCount");
  const closedCount = $("closedCount");
  const totalCount = $("totalCount");

  const canvas = $("signature");
  const ctx = canvas.getContext("2d");

  let statusChart, monthlyChart;

  const STORAGE_KEY = "inspection_reports";
  let editId = null;
  let drawing = false;

  yearEl.textContent = new Date().getFullYear();

  /* ================= SIGNATURE ================= */
  canvas.addEventListener("mousedown", () => drawing = true);
  canvas.addEventListener("mouseup", () => { drawing = false; ctx.beginPath(); });
  canvas.addEventListener("mousemove", e => {
    if (!drawing) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#000";
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
  });

  window.clearSignature = () =>
    ctx.clearRect(0, 0, canvas.width, canvas.height);

  /* ================= STORAGE ================= */
  const getReports = () =>
    JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

  const saveReports = data =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  const generateReportNo = () =>
    "IR-" + new Date().getFullYear() + "-" +
    Math.floor(1000 + Math.random() * 9000);

  /* ================= DASHBOARD ================= */
  function updateDashboard() {
    const reports = getReports();
    openCount.textContent = reports.filter(r => r.status === "Open").length;
    reviewCount.textContent = reports.filter(r => r.status === "In Review").length;
    closedCount.textContent = reports.filter(r => r.status === "Closed").length;
    totalCount.textContent = reports.length;
  }

  /* ================= SAVE / EDIT ================= */
  function saveReport() {
    if (!fields.client.value || !fields.date.value) {
      alert("Client and Date required");
      return;
    }

    const reports = getReports();

    const reportData = {
      id: editId ?? Date.now(),
      reportNo: editId
        ? reports.find(r => r.id === editId).reportNo
        : generateReportNo(),
      signature: canvas.toDataURL(),
      ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.value]))
    };

    const updated = editId
      ? reports.map(r => r.id === editId ? reportData : r)
      : [...reports, reportData];

    saveReports(updated);
    editId = null;
    clearForm();
    refreshAll();
  }

  function clearForm() {
    Object.values(fields).forEach(f => f.value = "");
    clearSignature();
  }

  /* ================= RENDER REPORTS ================= */
  function renderReports() {
    const filter = statusFilter.value;
    reportList.innerHTML = "";

    getReports()
      .filter(r => filter === "All" || r.status === filter)
      .forEach(r => {
        const li = document.createElement("li");
        li.innerHTML = `
          <div>
            <strong>${r.reportNo}</strong> — ${r.project}
            <span class="badge ${r.status.toLowerCase().replace(" ","-")}">${r.status}</span>
          </div>
          <div>
            <button onclick="editReport(${r.id})">Edit</button>
            <button onclick="downloadSavedReport(${r.id})">Download</button>
            <button onclick="deleteReport(${r.id})">Delete</button>
          </div>
        `;
        reportList.appendChild(li);
      });
  }

  /* ================= ANALYTICS ================= */
  function renderStatusChart() {
    const reports = getReports();
    const data = [
      reports.filter(r => r.status === "Open").length,
      reports.filter(r => r.status === "In Review").length,
      reports.filter(r => r.status === "Closed").length
    ];

    if (statusChart) statusChart.destroy();
    statusChart = new Chart($("statusChart"), {
      type: "pie",
      data: {
        labels: ["Open", "In Review", "Closed"],
        datasets: [{ data }]
      }
    });
  }

  function renderMonthlyChart() {
    const reports = getReports();
    const months = {};

    reports.forEach(r => {
      if (!r.date) return;
      const m = r.date.slice(0, 7);
      months[m] = (months[m] || 0) + 1;
    });

    const labels = Object.keys(months).sort();
    const values = labels.map(l => months[l]);

    if (monthlyChart) monthlyChart.destroy();
    monthlyChart = new Chart($("monthlyChart"), {
      type: "bar",
      data: {
        labels,
        datasets: [{ label: "Reports / Month", data: values }]
      }
    });
  }

  function renderInspectorSummary() {
    const list = $("inspectorSummary");
    const reports = getReports();
    const map = {};

    reports.forEach(r => {
      const name = r.inspector || "Unknown";
      map[name] = (map[name] || 0) + 1;
    });

    list.innerHTML = "";
    Object.entries(map).forEach(([name, count]) => {
      const li = document.createElement("li");
      li.textContent = `${name}: ${count} reports`;
      list.appendChild(li);
    });
  }

  function refreshAll() {
    renderReports();
    updateDashboard();
    renderStatusChart();
    renderMonthlyChart();
    renderInspectorSummary();
  }

  /* ================= ACTIONS ================= */
  window.editReport = id => {
    const r = getReports().find(r => r.id === id);
    if (!r) return;

    editId = id;
    Object.keys(fields).forEach(k => fields[k].value = r[k]);

    clearSignature();
    if (r.signature) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = r.signature;
    }
  };

  window.deleteReport = id => {
    if (!confirm("Delete this report?")) return;
    saveReports(getReports().filter(r => r.id !== id));
    refreshAll();
  };

  window.downloadSavedReport = id => {
    const r = getReports().find(r => r.id === id);
    if (!r) return;
    downloadPDF(r);
  };

  /* ================= PDF ================= */
  function downloadPDF(r) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(16);
    doc.text("INSPECTION REPORT", 105, y, { align: "center" });
    y += 15;

    doc.setFontSize(11);
    const row = (l, v) => { doc.text(l + ":", 20, y); doc.text(v || "-", 70, y); y += 8; };

    row("Project", r.project);
    row("Client", r.client);
    row("Date", r.date);
    row("Method", r.method);
    row("Result", r.result);

    y += 6;
    doc.text("Acceptance Criteria:", 20, y); y += 6;
    doc.text(r.acceptance || "N/A", 20, y, { maxWidth: 170 });

    y += 18;
    doc.text("Specification of Code:", 20, y); y += 6;
    doc.text(r.specification || "N/A", 20, y, { maxWidth: 170 });

    y += 18;
    doc.text("Defect Description:", 20, y); y += 6;
    doc.text(r.defect || "NAD", 20, y, { maxWidth: 170 });

    if (r.signature) {
      y += 20;
      doc.text("Inspector Signature:", 20, y);
      doc.addImage(r.signature, "PNG", 70, y - 5, 60, 20);
    }

    doc.save("inspection-report.pdf");
  }

  /* ================= EXPORT ================= */
  function exportToExcel() {
    const rows = getReports();
    if (!rows.length) return alert("No reports to export");

    const headers = Object.keys(rows[0]).join(",");
    const data = rows.map(r =>
      Object.values(r).map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")
    );

    const csv = [headers, ...data].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "inspection-reports.csv";
    a.click();
  }

  /* ================= EVENTS ================= */
  saveBtn.addEventListener("click", saveReport);
  pdfBtn.addEventListener("click", () =>
    downloadPDF(Object.fromEntries(Object.entries(fields).map(([k,v]) => [k,v.value])))
  );
  statusFilter.addEventListener("change", refreshAll);
  exportBtn.addEventListener("click", exportToExcel);

  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("theme",
      document.body.classList.contains("dark") ? "dark" : "light");
  });

  if (localStorage.getItem("theme") === "dark")
    document.body.classList.add("dark");

  refreshAll();
});

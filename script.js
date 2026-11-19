
/* FLOW FINANCE — DASHBOARD LOGIC */
const monthlyTotalCard = document.getElementById("monthly-total-card");
const budgetRemainingCard = document.getElementById("budget-remaining-card");
const transactionCount = document.getElementById("transaction-count");
const todayDate = document.getElementById("today-date");

const $ = id => document.getElementById(id);

const money = value =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);

function thisMonth() {
  const today = new Date();
  return today.getFullYear() + "-" +
    String(today.getMonth() + 1).padStart(2, "0");
}

function readSaved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

let expenses = readSaved("expenses", []);
if (!Array.isArray(expenses)) expenses = [];

let monthlyBudget = Number(readSaved("monthlyBudget", 0)) || 0;

const validDate = date =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  !Number.isNaN(Date.parse(date + "T12:00:00"));

const newId = () =>
  crypto.randomUUID?.() || Date.now() + Math.random();

const amountOf = expense => Number(expense.amount) || 0;

const sum = rows =>
  rows.reduce((total, expense) => total + amountOf(expense), 0);

function expensesForMonth(month) {
  return expenses.filter(expense =>
    (expense.date || "").slice(0, 7) === month
  );
}

function saveExpenses() {
  localStorage.setItem("expenses", JSON.stringify(expenses));
}

/* SIDEBAR NAVIGATION */

const pageNames = {
  overview: "Overview",
  transactions: "Transactions",
  analytics: "Analytics",
  budget: "Budget Planner",
  tools: "Data & Tools"
};

function switchView(name) {
  if (!pageNames[name]) return;

  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active-view", view.id === name);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle("active", active);

    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  $("page-title").textContent = pageNames[name];

  window.scrollTo(0, 0);

  if (name === "analytics" || name === "overview") {
    requestAnimationFrame(updateCharts);
  }
}

document.querySelectorAll("[data-view]").forEach(button => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

$("today-date").textContent = new Date().toLocaleDateString(
  "en-US",
  { month: "short", day: "numeric", year: "numeric" }
);

/* ADD EXPENSE */

$("expense-form").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("expense-name").value.trim();
  const amount = Number($("expense-amount").value);
  const date = $("expense-date").value;
  const category = $("expense-category").value;

  if (!name || !Number.isFinite(amount) ||
      amount <= 0 || !validDate(date)) {
    alert("Enter a valid name, amount and date.");
    return;
  }

  expenses.push({
    id: newId(),
    name,
    amount,
    date,
    category
  });

  saveExpenses();
  $("expense-form").reset();
  updateDashboard();
});

/* DELETE EXPENSE */

$("expense-list").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  expenses = expenses.filter(expense =>
    String(expense.id) !== button.dataset.delete
  );

  saveExpenses();
  updateDashboard();
});

/* MONTH FILTER */

$("filter-month").addEventListener("change", updateDashboard);

$("clear-filter").addEventListener("click", () => {
  $("filter-month").value = "";
  updateDashboard();
});

/* MONTHLY BUDGET */

$("save-budget").addEventListener("click", () => {
  const raw = $("monthly-budget").value.trim();
  const value = Number(raw);

  if (!raw || !Number.isFinite(value) || value < 0) {
    alert("Enter a valid budget.");
    return;
  }

  monthlyBudget = value;

  localStorage.setItem(
    "monthlyBudget",
    JSON.stringify(monthlyBudget)
  );

  updateDashboard();
});

function updateBudget(monthlySpent) {
  const remaining = monthlyBudget - monthlySpent;

  $("monthly-budget").value =
    monthlyBudget > 0 ? monthlyBudget : "";

  $("overview-remaining").textContent =
    monthlyBudget > 0 ? money(remaining) : "Not set";

  $("budget-status").textContent =
    monthlyBudget > 0
      ? `${money(monthlySpent)} spent of ${money(monthlyBudget)}`
      : "Set a monthly budget to get started.";

  $("budget-remaining").textContent =
    monthlyBudget > 0
      ? remaining >= 0
        ? `${money(remaining)} remaining`
        : `${money(-remaining)} over budget`
      : `Spent this month: ${money(monthlySpent)}`;

  const percentage = monthlyBudget > 0
    ? monthlySpent / monthlyBudget * 100
    : 0;

  $("budget-fill").style.width =
    Math.min(100, percentage) + "%";

  document.querySelector(".budget-progress")
    .setAttribute(
      "aria-valuenow",
      String(Math.min(100, Math.round(percentage)))
    );
}

/* TRANSACTION ROWS */

function createTransaction(expense, canDelete = false) {
  const row = document.createElement(
    canDelete ? "li" : "div"
  );

  row.className = "expense-item";

  const details = document.createElement("span");
  details.textContent =
    `${expense.name} · ${expense.category || "Other"} · ` +
    (expense.date || "Undated");

  const amount = document.createElement("strong");
  amount.textContent = money(amountOf(expense));

  row.append(details, amount);

  if (canDelete) {
    const button = document.createElement("button");
    button.textContent = "Delete";
    button.className = "delete-button";
    button.dataset.delete = String(expense.id);
    row.append(button);
  }

  return row;
}

/* CATEGORY BREAKDOWN */

function updateCategoryBars() {
  const totals = {};

  expenses.forEach(expense => {
    const category = expense.category || "Other";
    totals[category] =
      (totals[category] || 0) + amountOf(expense);
  });

  const allSpending = sum(expenses);
  const container = $("category-chart");

  container.replaceChildren();

  Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, amount]) => {
      const row = document.createElement("div");
      row.className = "chart-row";

      const label = document.createElement("div");
      label.className = "chart-label";
      label.textContent = `${category} — ${money(amount)}`;

      const background = document.createElement("div");
      background.className = "chart-bar-background";

      const bar = document.createElement("div");
      bar.className = "chart-bar";

      bar.style.width =
        (allSpending ? amount / allSpending * 100 : 0) + "%";

      background.append(bar);
      row.append(label, background);
      container.append(row);
    });

  if (!allSpending) {
    container.textContent = "No spending data yet.";
  }
}

/* INTERACTIVE CHARTS */

const charts = {};

function updateCharts() {
  if (typeof Chart === "undefined") return;

  const categories = {};
  const months = {};

  expenses.forEach(expense => {
    const amount = amountOf(expense);
    const category = expense.category || "Other";

    categories[category] =
      (categories[category] || 0) + amount;

    if (validDate(expense.date || "")) {
      const month = expense.date.slice(0, 7);
      months[month] = (months[month] || 0) + amount;
    }
  });

  const monthLabels = Object.keys(months).sort();
  const monthValues = monthLabels.map(month => months[month]);

  function drawChart(id, type, labels, values, options) {
    const canvas = $(id);
    if (!canvas || !canvas.offsetWidth) return;

    if (charts[id]) charts[id].destroy();

    charts[id] = new Chart(canvas, {
      type,
      data: {
        labels,
        datasets: [{
          label: "Spending",
          data: values,
          borderColor: "#6058ec",
          backgroundColor: type === "doughnut"
            ? ["#6058ec", "#0eae87", "#f3a84e",
               "#56a0ec", "#e77aa0"]
            : type === "bar"
              ? "#0eae87"
              : "rgba(96, 88, 236, 0.15)",
          fill: type === "line",
          tension: 0.3,
          borderWidth: type === "doughnut" ? 0 : 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...options
      }
    });
  }

  const axisOptions = {
    plugins: { legend: { display: false } },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: value => "$" + value }
      }
    }
  };

  drawChart(
    "overviewLineChart", "line",
    monthLabels, monthValues, axisOptions
  );

  drawChart(
    "monthlyLineChart", "line",
    monthLabels, monthValues, axisOptions
  );

  drawChart(
    "monthlyBarChart", "bar",
    monthLabels, monthValues, axisOptions
  );

  drawChart(
    "categoryDoughnutChart", "doughnut",
    Object.keys(categories),
    Object.values(categories),
    { plugins: { legend: { position: "bottom" } } }
  );
}

/* CSV IMPORT */

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(value => value.trim())) rows.push(row);

  if (quoted) throw new Error("Invalid CSV quotes.");

  return rows;
}

$("import-button").addEventListener("click", async () => {
  const file = $("csv-file").files[0];

  if (!file) {
    $("import-message").textContent = "Choose a CSV file.";
    return;
  }

  try {
    const rows = parseCSV(
      (await file.text()).replace(/^\uFEFF/, "")
    );

    const headers = (rows.shift() || [])
      .map(value => value.trim().toLowerCase());

    const column = name => headers.indexOf(name);

    if (column("description") < 0 || column("amount") < 0) {
      throw new Error("CSV needs Description and Amount.");
    }

    let count = 0;

    rows.forEach(fields => {
      const name = fields[column("description")]?.trim();
      const amount = Number(fields[column("amount")]);

      const category = column("category") >= 0
        ? fields[column("category")]?.trim() || "Other"
        : "Other";

      const date = column("date") >= 0
        ? fields[column("date")]?.trim() || ""
        : "";

      if (!name || !Number.isFinite(amount) ||
          amount <= 0 || (date && !validDate(date))) return;

      const duplicate = expenses.some(expense =>
        expense.name === name &&
        amountOf(expense) === amount &&
        expense.category === category &&
        (expense.date || "") === date
      );

      if (duplicate) return;

      expenses.push({
        id: newId(), name, amount, category, date
      });

      count++;
    });

    saveExpenses();
    updateDashboard();

    $("import-message").textContent =
      `Imported ${count} transaction(s).`;

    $("csv-file").value = "";
  } catch (error) {
    $("import-message").textContent = error.message;
  }
});

/* CSV EXPORT */

$("export-button").addEventListener("click", () => {
  const escapeCell = value =>
    '"' + String(value ?? "").replace(/"/g, '""') + '"';

  const rows = [
    ["Date", "Description", "Amount", "Category"],
    ...expenses.map(expense => [
      expense.date || "",
      expense.name,
      expense.amount,
      expense.category
    ])
  ];

  const csv = rows
    .map(row => row.map(escapeCell).join(","))
    .join("\r\n");

  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv" })
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = "flow-expenses.csv";
  link.click();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/* UPDATE ALL DASHBOARD DATA */

function updateDashboard() {
  const monthlyExpenses = expensesForMonth(thisMonth());
  const monthlySpent = sum(monthlyExpenses);
  const filteredMonth = $("filter-month").value;

  const visibleExpenses = filteredMonth
    ? expensesForMonth(filteredMonth)
    : expenses;

  $("total-spending").textContent = money(sum(expenses));

  const monthlyCard =
  document.getElementById("monthly-total-card") ||
  document.getElementById("overview-monthly-spending") ||
  document.getElementById("monthly-spending");

if (monthlyCard) {
  monthlyCard.textContent = money(monthlySpent);
}

  $("transaction-count").textContent =
    String(expenses.length);

  $("monthly-total").textContent =
    `${visibleExpenses.length} transactions · ` +
    money(sum(visibleExpenses));

  $("expense-list").replaceChildren();

  [...visibleExpenses]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .forEach(expense => {
      $("expense-list").append(
        createTransaction(expense, true)
      );
    });

  if (!visibleExpenses.length) {
    $("expense-list").textContent = "No transactions found.";
  }

  $("recent-transactions").replaceChildren();

  [...expenses]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, 5)
    .forEach(expense => {
      $("recent-transactions").append(
        createTransaction(expense)
      );
    });

  if (!expenses.length) {
    $("recent-transactions").textContent =
      "No transactions yet.";
  }

  updateBudget(monthlySpent);
  updateCategoryBars();

  requestAnimationFrame(updateCharts);
}

/* INITIALIZE APP */

updateDashboard();
switchView("overview");

function setTodayDate() {
  const dateElement = document.getElementById("today-date");

  if (!dateElement) return;

  dateElement.textContent = new Date().toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric"
    }
  );
}

setTodayDate();

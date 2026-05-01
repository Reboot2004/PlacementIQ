const portfolio = [
  {
    id: 1,
    name: "Ravi K.",
    city: "Hyderabad",
    course: "B.Tech CSE",
    institute: "Tier-2 Institute",
    loan: 18,
    daysLeft: 62,
    cgpa: 7.0,
    internships: 0,
    certifications: 0,
    tier: 2,
    demand: "low",
    placementCell: "average",
  },
  {
    id: 2,
    name: "Ananya S.",
    city: "Pune",
    course: "MBA",
    institute: "Tier-1 Business School",
    loan: 22,
    daysLeft: 118,
    cgpa: 8.4,
    internships: 2,
    certifications: 3,
    tier: 1,
    demand: "high",
    placementCell: "strong",
  },
  {
    id: 3,
    name: "Mohit R.",
    city: "Indore",
    course: "Core Engineering",
    institute: "Tier-3 College",
    loan: 12,
    daysLeft: 41,
    cgpa: 6.6,
    internships: 0,
    certifications: 1,
    tier: 3,
    demand: "low",
    placementCell: "weak",
  },
  {
    id: 4,
    name: "Nisha P.",
    city: "Bengaluru",
    course: "B.Tech CSE",
    institute: "NIT Program",
    loan: 16,
    daysLeft: 142,
    cgpa: 8.1,
    internships: 2,
    certifications: 2,
    tier: 1,
    demand: "high",
    placementCell: "strong",
  },
  {
    id: 5,
    name: "Aman V.",
    city: "Jaipur",
    course: "Arts / Commerce",
    institute: "Tier-2 University",
    loan: 9,
    daysLeft: 86,
    cgpa: 7.3,
    internships: 1,
    certifications: 0,
    tier: 2,
    demand: "medium",
    placementCell: "average",
  },
  {
    id: 6,
    name: "Meera I.",
    city: "Chennai",
    course: "MBA",
    institute: "Tier-2 Business School",
    loan: 20,
    daysLeft: 57,
    cgpa: 7.7,
    internships: 1,
    certifications: 2,
    tier: 2,
    demand: "medium",
    placementCell: "strong",
  },
];

const weights = {
  tier: { 1: 16, 2: 1, 3: -14 },
  demand: { high: 12, medium: 2, low: -12 },
  placementCell: { strong: 9, average: 0, weak: -11 },
  course: {
    "B.Tech CSE": 8,
    MBA: 7,
    "Core Engineering": -7,
    "Arts / Commerce": -5,
  },
};

let selectedId = 1;
let sortDescending = false;

const table = document.querySelector("#borrowerTable");
const searchInput = document.querySelector("#searchInput");
const riskFilter = document.querySelector("#riskFilter");
const sortButton = document.querySelector("#sortButton");
const navItems = document.querySelectorAll(".nav-item");
const screens = document.querySelectorAll(".screen");
const scoreForm = document.querySelector("#scoreForm");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function scoreBorrower(input) {
  const courseLabel = input.courseLabel || input.course;
  const cgpaContribution = (input.cgpa - 7) * 7;
  const internshipContribution = Math.min(input.internships, 3) * 7 - (input.internships === 0 ? 9 : 0);
  const certificationContribution = Math.min(input.certifications, 4) * 3 - (input.certifications === 0 ? 5 : 0);
  const tierContribution = weights.tier[input.tier];
  const demandContribution = weights.demand[input.demand];
  const placementCellContribution = weights.placementCell[input.placementCell];
  const courseContribution = weights.course[courseLabel] || 0;
  const moratoriumContribution = input.daysLeft < 90 ? -6 : input.daysLeft > 180 ? 5 : 0;

  const rawScore =
    58 +
    cgpaContribution +
    internshipContribution +
    certificationContribution +
    tierContribution +
    demandContribution +
    placementCellContribution +
    courseContribution +
    moratoriumContribution;

  const prs = Math.round(clamp(rawScore, 8, 96));
  const risk = prs < 50 ? "High" : prs < 72 ? "Medium" : "Low";
  const prob3 = clamp(Math.round(prs * 0.58 - 6), 5, 88);
  const prob6 = clamp(Math.round(prs * 0.72 + 10), 12, 94);
  const prob12 = clamp(Math.round(prs * 0.55 + 44), 25, 98);
  const salaryBand = getSalaryBand(prs, courseLabel);

  const drivers = [
    { label: "Institute tier", value: tierContribution },
    { label: "Sector demand", value: demandContribution },
    { label: "Internships", value: internshipContribution },
    { label: "Certifications", value: certificationContribution },
    { label: "CGPA", value: Math.round(cgpaContribution) },
    { label: "Placement cell", value: placementCellContribution },
    { label: "Course prior", value: courseContribution },
    { label: "Moratorium timing", value: moratoriumContribution },
  ]
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5);

  return {
    prs,
    risk,
    prob3,
    prob6,
    prob12,
    salaryBand,
    drivers,
    recommendation: getRecommendation(risk, drivers),
    narrative: getNarrative(risk, drivers),
  };
}

function getSalaryBand(prs, course) {
  if (course === "MBA" && prs >= 70) return "₹10-16 LPA";
  if (course === "B.Tech CSE" && prs >= 70) return "₹8-12 LPA";
  if (prs >= 75) return "₹7-10 LPA";
  if (prs >= 55) return "₹5-8 LPA";
  return "₹3-5 LPA";
}

function getRecommendation(risk, drivers) {
  const weakDriver = drivers.find((driver) => driver.value < 0)?.label || "placement confidence";
  if (risk === "High") return `Trigger skill-up referral and EMI restructure review; weakest signal: ${weakDriver}.`;
  if (risk === "Medium") return `Monitor monthly and request placement-cell update; watch ${weakDriver}.`;
  return "Keep in normal monitoring queue and refresh score after confirmed offer activity.";
}

function getNarrative(risk, drivers) {
  const top = drivers[0];
  if (risk === "High") return `High repayment stress risk because ${top.label.toLowerCase()} is pulling the placement score down.`;
  if (risk === "Medium") return `Mixed employability signal; ${top.label.toLowerCase()} is the largest driver to monitor.`;
  return `Strong placement confidence with ${top.label.toLowerCase()} supporting the score.`;
}

function enrichBorrower(borrower) {
  return { ...borrower, ...scoreBorrower(borrower) };
}

function filteredBorrowers() {
  const search = searchInput.value.trim().toLowerCase();
  return portfolio
    .map(enrichBorrower)
    .filter((borrower) => {
      const matchesRisk = riskFilter.value === "all" || borrower.risk === riskFilter.value;
      const haystack = `${borrower.name} ${borrower.city} ${borrower.course} ${borrower.institute}`.toLowerCase();
      return matchesRisk && haystack.includes(search);
    })
    .sort((a, b) => (sortDescending ? b.prs - a.prs : a.prs - b.prs));
}

function renderTable() {
  const rows = filteredBorrowers();
  table.innerHTML = rows
    .map(
      (borrower) => `
        <tr class="${borrower.id === selectedId ? "selected" : ""}" data-id="${borrower.id}" tabindex="0">
          <td><strong>${borrower.name}</strong><br><span>${borrower.city}</span></td>
          <td>${borrower.course}</td>
          <td>${borrower.institute}</td>
          <td>${borrower.daysLeft} days</td>
          <td>
            <div class="prs-cell">
              <strong>${borrower.prs}</strong>
              <span class="mini-bar"><span style="width:${borrower.prs}%"></span></span>
            </div>
          </td>
          <td><span class="risk-pill ${borrower.risk.toLowerCase()}">${borrower.risk}</span></td>
        </tr>
      `,
    )
    .join("");

  table.querySelectorAll("tr").forEach((row) => {
    row.addEventListener("click", () => selectBorrower(Number(row.dataset.id)));
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") selectBorrower(Number(row.dataset.id));
    });
  });
}

function selectBorrower(id) {
  selectedId = id;
  const borrower = enrichBorrower(portfolio.find((item) => item.id === id));
  renderDetail(borrower);
  renderTable();
}

function renderDetail(borrower) {
  document.querySelector("#riskPill").textContent = borrower.risk;
  document.querySelector("#riskPill").className = `risk-pill ${borrower.risk.toLowerCase()}`;
  document.querySelector("#borrowerName").textContent = borrower.name;
  document.querySelector("#borrowerMeta").textContent = `${borrower.course}, ${borrower.city} | ${borrower.institute}`;
  document.querySelector("#loanChip").textContent = `₹${borrower.loan}L loan`;
  document.querySelector("#scoreValue").textContent = borrower.prs;
  document.querySelector("#scoreNarrative").textContent = borrower.narrative;
  document.querySelector("#prob3").textContent = `${borrower.prob3}%`;
  document.querySelector("#prob6").textContent = `${borrower.prob6}%`;
  document.querySelector("#prob12").textContent = `${borrower.prob12}%`;
  document.querySelector("#salaryBand").textContent = borrower.salaryBand;
  document.querySelector("#recommendationText").textContent = borrower.recommendation;
  renderDrivers(document.querySelector("#driverList"), borrower.drivers);
}

function renderDrivers(container, drivers) {
  container.innerHTML = drivers
    .map((driver) => {
      const width = clamp(Math.abs(driver.value) * 5, 8, 100);
      const sign = driver.value >= 0 ? "+" : "";
      return `
        <div class="driver ${driver.value >= 0 ? "positive" : "negative"}">
          <strong>${driver.label}</strong>
          <span class="driver-track"><span style="width:${width}%"></span></span>
          <span class="driver-value">${sign}${driver.value}</span>
        </div>
      `;
    })
    .join("");
}

function renderMetrics() {
  document.querySelector("#totalLoans").textContent = "2,847";
  document.querySelector("#highRiskCount").textContent = "312";
  document.querySelector("#avgPrs").textContent = "67";
  document.querySelector("#exposure").textContent = "₹41.8Cr";
}

function formValues() {
  const data = new FormData(scoreForm);
  const courseMap = {
    cse: "B.Tech CSE",
    mba: "MBA",
    core: "Core Engineering",
    arts: "Arts / Commerce",
  };
  return {
    cgpa: Number(data.get("cgpa")),
    internships: Number(data.get("internships")),
    certifications: Number(data.get("certifications")),
    tier: Number(data.get("tier")),
    demand: data.get("demand"),
    placementCell: data.get("placementCell"),
    daysLeft: Number(data.get("daysLeft")),
    course: courseMap[data.get("course")],
  };
}

function renderLab() {
  const values = formValues();
  const result = scoreBorrower(values);
  document.querySelector("#cgpaOut").textContent = values.cgpa.toFixed(1);
  document.querySelector("#labRiskPill").textContent = result.risk;
  document.querySelector("#labRiskPill").className = `risk-pill ${result.risk.toLowerCase()}`;
  document.querySelector("#labScore").textContent = result.prs;
  document.querySelector("#labProb3").textContent = `${result.prob3}%`;
  document.querySelector("#labProb6").textContent = `${result.prob6}%`;
  document.querySelector("#labProb12").textContent = `${result.prob12}%`;
  document.querySelector("#labSalary").textContent = result.salaryBand;
  renderDrivers(document.querySelector("#labDrivers"), result.drivers);
  document.querySelector("#apiPreview").textContent = JSON.stringify(
    {
      endpoint: "POST /score",
      request: values,
      response: {
        placementRiskScore: result.prs,
        riskFlag: result.risk,
        placementProbability: {
          threeMonth: result.prob3,
          sixMonth: result.prob6,
          twelveMonth: result.prob12,
        },
        expectedSalaryBand: result.salaryBand,
        topDrivers: result.drivers,
        recommendedAction: result.recommendation,
      },
    },
    null,
    2,
  );
}

navItems.forEach((item) => {
  item.addEventListener("click", () => {
    navItems.forEach((nav) => nav.classList.remove("active"));
    screens.forEach((screen) => screen.classList.remove("active"));
    item.classList.add("active");
    document.querySelector(`#${item.dataset.section}`).classList.add("active");
  });
});

searchInput.addEventListener("input", renderTable);
riskFilter.addEventListener("change", renderTable);
sortButton.addEventListener("click", () => {
  sortDescending = !sortDescending;
  renderTable();
});
scoreForm.addEventListener("input", renderLab);
document.querySelector("#resetForm").addEventListener("click", () => {
  scoreForm.reset();
  renderLab();
});

renderMetrics();
renderTable();
selectBorrower(selectedId);
renderLab();

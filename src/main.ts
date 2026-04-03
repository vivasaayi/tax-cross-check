import { invoke } from "@tauri-apps/api/core";
import "./styles.css";

type FilingStatus = "single" | "marriedFilingJointly" | "marriedFilingSeparately" | "headOfHousehold";
type TaxYear = "y2024" | "y2025";
type StateCode = "nj" | "ny";

type TaxCalculationInput = {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  residentState: StateCode;
  wages: number;
  federalWithholding: number;
  stateWithholding: number;
  taxableInterest: number;
  ordinaryDividends: number;
  qualifiedDividends: number;
  miscIncome: number;
  shortTermGains: number;
  longTermGains: number;
};

type TaxBreakdown = {
  tax: number;
  taxableIncome: number;
  withholding: number;
  refundOrDue: number;
  effectiveRate: number;
  marginalRate: number;
};

type IncomeSummary = {
  totalIncome: number;
  agi: number;
  standardDeduction: number;
  taxableIncome: number;
  preferredIncome: number;
  ordinaryTaxableIncome: number;
};

type CombinedSummary = {
  totalTax: number;
  totalWithholding: number;
  netRefundOrDue: number;
};

type TaxCalculationResult = {
  yearLabel: string;
  income: IncomeSummary;
  federal: TaxBreakdown;
  state: TaxBreakdown;
  combined: CombinedSummary;
  assumptions: string[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container not found.");
}

app.innerHTML = `
  <main class="shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Rust + Tauri</p>
        <h1>Tax Cross Check</h1>
        <p class="lede">
          A desktop calculator to sanity-check TurboTax numbers for federal tax and NJ or NY returns.
          This version stays intentionally summary-level.
        </p>
      </div>
      <div class="hero-card">
        <p>Included inputs</p>
        <ul>
          <li>W-2 wages</li>
          <li>1099-INT</li>
          <li>1099-DIV</li>
          <li>1099-MISC</li>
          <li>1099-B gains summary</li>
        </ul>
      </div>
    </section>

    <section class="grid">
      <form id="tax-form" class="panel form-panel">
        <div class="form-header">
          <h2>Inputs</h2>
          <p>Use summary numbers from your tax documents or the TurboTax worksheet screens.</p>
        </div>

        <div class="form-grid">
          <label>
            <span>Tax year</span>
            <select name="taxYear">
              <option value="y2024">2024</option>
              <option value="y2025">2025</option>
            </select>
          </label>

          <label>
            <span>Filing status</span>
            <select name="filingStatus">
              <option value="single">Single</option>
              <option value="marriedFilingJointly">Married filing jointly</option>
              <option value="marriedFilingSeparately">Married filing separately</option>
              <option value="headOfHousehold">Head of household</option>
            </select>
          </label>

          <label>
            <span>Resident state</span>
            <select name="residentState">
              <option value="nj">New Jersey</option>
              <option value="ny">New York</option>
            </select>
          </label>

          <label>
            <span>Federal withholding</span>
            <input name="federalWithholding" type="number" min="0" step="0.01" value="0" />
          </label>

          <label>
            <span>State withholding</span>
            <input name="stateWithholding" type="number" min="0" step="0.01" value="0" />
          </label>

          <label>
            <span>W-2 wages</span>
            <input name="wages" type="number" step="0.01" value="100000" />
          </label>

          <label>
            <span>1099-INT taxable interest</span>
            <input name="taxableInterest" type="number" step="0.01" value="500" />
          </label>

          <label>
            <span>1099-DIV ordinary dividends</span>
            <input name="ordinaryDividends" type="number" step="0.01" value="1200" />
          </label>

          <label>
            <span>1099-DIV qualified dividends</span>
            <input name="qualifiedDividends" type="number" step="0.01" value="900" />
          </label>

          <label>
            <span>1099-MISC income</span>
            <input name="miscIncome" type="number" step="0.01" value="0" />
          </label>

          <label>
            <span>1099-B short-term gains or losses</span>
            <input name="shortTermGains" type="number" step="0.01" value="0" readonly />
          </label>

          <label>
            <span>1099-B long-term gains or losses</span>
            <input name="longTermGains" type="number" step="0.01" value="2500" readonly />
          </label>
        </div>

        <div class="b1099-section">
          <h3>1099-B Details</h3>
          <p>Enter details from your trading accounts to calculate and verify gains/losses.</p>

          <div class="tabs">
            <button type="button" class="tab-button active" data-tab="short-term">Short-Term</button>
            <button type="button" class="tab-button" data-tab="long-term">Long-Term</button>
          </div>

          <div id="short-term-tab" class="tab-content active">
            <table class="b1099-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="short-term-rows">
                <tr class="data-row">
                  <td><input type="text" placeholder="Account name" /></td>
                  <td><input type="number" step="0.01" class="proceeds" /></td>
                  <td><input type="number" step="0.01" class="cost-basis" /></td>
                  <td><input type="number" step="0.01" class="wash-sale" /></td>
                  <td><input type="number" step="0.01" class="gain-loss" /></td>
                  <td class="calculated">0.00</td>
                  <td><button type="button" class="remove-row">×</button></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td><button type="button" id="add-short-term">Add Account</button></td>
                  <td class="sum" id="short-proceeds-sum">0.00</td>
                  <td class="sum" id="short-cost-sum">0.00</td>
                  <td class="sum" id="short-wash-sum">0.00</td>
                  <td class="sum" id="short-gain-sum">0.00</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div id="long-term-tab" class="tab-content">
            <table class="b1099-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="long-term-rows">
                <tr class="data-row">
                  <td><input type="text" placeholder="Account name" /></td>
                  <td><input type="number" step="0.01" class="proceeds" /></td>
                  <td><input type="number" step="0.01" class="cost-basis" /></td>
                  <td><input type="number" step="0.01" class="wash-sale" /></td>
                  <td><input type="number" step="0.01" class="gain-loss" /></td>
                  <td class="calculated">0.00</td>
                  <td><button type="button" class="remove-row">×</button></td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td><button type="button" id="add-long-term">Add Account</button></td>
                  <td class="sum" id="long-proceeds-sum">0.00</td>
                  <td class="sum" id="long-cost-sum">0.00</td>
                  <td class="sum" id="long-wash-sum">0.00</td>
                  <td class="sum" id="long-gain-sum">0.00</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div class="actions">
          <button type="submit">Calculate</button>
          <p class="microcopy">This is an estimate tool, not a filing engine.</p>
        </div>
      </form>

      <section class="panel results-panel">
        <div class="form-header">
          <h2>Results</h2>
          <p>Use these numbers to spot-check your tax software output.</p>
        </div>
        <div id="results" class="results-empty">
          Enter your numbers and run the estimate.
        </div>
      </section>
    </section>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#tax-form");
const results = document.querySelector<HTMLDivElement>("#results");

if (!form || !results) {
  throw new Error("Required UI elements are missing.");
}

const shortTermGainsInput = form.querySelector<HTMLInputElement>('input[name="shortTermGains"]');
const longTermGainsInput = form.querySelector<HTMLInputElement>('input[name="longTermGains"]');

if (!shortTermGainsInput || !longTermGainsInput) {
  throw new Error("Gain inputs not found.");
}

// Tab switching
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.getAttribute('data-tab');
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`${tab}-tab`)?.classList.add('active');
  });
});

// Function to calculate row
function calculateRow(row: HTMLTableRowElement) {
  const proceeds = parseFloat(row.querySelector<HTMLInputElement>('.proceeds')?.value || '0');
  const costBasis = parseFloat(row.querySelector<HTMLInputElement>('.cost-basis')?.value || '0');
  const washSale = parseFloat(row.querySelector<HTMLInputElement>('.wash-sale')?.value || '0');
  const gainLossInput = row.querySelector<HTMLInputElement>('.gain-loss');
  const calculated = row.querySelector('.calculated') as HTMLElement;

  const calculatedValue = proceeds - costBasis - washSale;
  calculated.textContent = calculatedValue.toFixed(2);

  const inputValue = parseFloat(gainLossInput?.value || '0');
  if (Math.abs(calculatedValue - inputValue) > 0.01) {
    row.classList.add('mismatch');
  } else {
    row.classList.remove('mismatch');
  }
}

// Function to update sums
function updateSums(type: 'short' | 'long') {
  const rows = document.querySelectorAll(`#${type}-term-rows .data-row`) as NodeListOf<HTMLTableRowElement>;
  let totalProceeds = 0;
  let totalCost = 0;
  let totalWash = 0;
  let totalGain = 0;

  rows.forEach(row => {
    totalProceeds += parseFloat(row.querySelector<HTMLInputElement>('.proceeds')?.value || '0');
    totalCost += parseFloat(row.querySelector<HTMLInputElement>('.cost-basis')?.value || '0');
    totalWash += parseFloat(row.querySelector<HTMLInputElement>('.wash-sale')?.value || '0');
    totalGain += parseFloat(row.querySelector<HTMLInputElement>('.gain-loss')?.value || '0');
  });

  (document.getElementById(`${type}-proceeds-sum`) as HTMLElement).textContent = totalProceeds.toFixed(2);
  (document.getElementById(`${type}-cost-sum`) as HTMLElement).textContent = totalCost.toFixed(2);
  (document.getElementById(`${type}-wash-sum`) as HTMLElement).textContent = totalWash.toFixed(2);
  (document.getElementById(`${type}-gain-sum`) as HTMLElement).textContent = totalGain.toFixed(2);

  if (type === 'short') {
    shortTermGainsInput!.value = totalGain.toFixed(2);
  } else {
    longTermGainsInput!.value = totalGain.toFixed(2);
  }
}

// Add row function
function addRow(type: 'short' | 'long') {
  const tbody = document.getElementById(`${type}-term-rows`);
  if (!tbody) return;

  const row = document.createElement('tr');
  row.className = 'data-row';
  row.innerHTML = `
    <td><input type="text" placeholder="Account name" /></td>
    <td><input type="number" step="0.01" class="proceeds" /></td>
    <td><input type="number" step="0.01" class="cost-basis" /></td>
    <td><input type="number" step="0.01" class="wash-sale" /></td>
    <td><input type="number" step="0.01" class="gain-loss" /></td>
    <td class="calculated">0.00</td>
    <td><button type="button" class="remove-row">×</button></td>
  `;

  tbody.appendChild(row);
  attachRowEvents(row, type);
}

// Attach events to row
function attachRowEvents(row: HTMLTableRowElement, type: 'short' | 'long') {
  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      calculateRow(row);
      updateSums(type);
    });
  });

  row.querySelector('.remove-row')?.addEventListener('click', () => {
    row.remove();
    updateSums(type);
  });
}

// Initial setup
document.querySelectorAll('.data-row').forEach(row => {
  attachRowEvents(row as HTMLTableRowElement, row.closest('.tab-content')?.id === 'short-term-tab' ? 'short' : 'long');
});

document.getElementById('add-short-term')?.addEventListener('click', () => addRow('short'));
document.getElementById('add-long-term')?.addEventListener('click', () => addRow('long'));

// Initial calculation
updateSums('short');
updateSums('long');

const readNumber = (value: FormDataEntryValue | null): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInput = (formData: FormData): TaxCalculationInput => ({
  taxYear: String(formData.get("taxYear")) as TaxYear,
  filingStatus: String(formData.get("filingStatus")) as FilingStatus,
  residentState: String(formData.get("residentState")) as StateCode,
  wages: readNumber(formData.get("wages")),
  federalWithholding: readNumber(formData.get("federalWithholding")),
  stateWithholding: readNumber(formData.get("stateWithholding")),
  taxableInterest: readNumber(formData.get("taxableInterest")),
  ordinaryDividends: readNumber(formData.get("ordinaryDividends")),
  qualifiedDividends: readNumber(formData.get("qualifiedDividends")),
  miscIncome: readNumber(formData.get("miscIncome")),
  shortTermGains: readNumber(formData.get("shortTermGains")),
  longTermGains: readNumber(formData.get("longTermGains")),
});

const money = (value: number): string => currency.format(value);
const rate = (value: number): string => percent.format(value);

const refundLabel = (value: number): string => (value >= 0 ? "Refund estimate" : "Balance due");
const refundValue = (value: number): string => money(Math.abs(value));

const renderBreakdown = (label: string, breakdown: TaxBreakdown) => `
  <article class="metric-card">
    <h3>${label}</h3>
    <dl>
      <div><dt>Taxable income</dt><dd>${money(breakdown.taxableIncome)}</dd></div>
      <div><dt>Estimated tax</dt><dd>${money(breakdown.tax)}</dd></div>
      <div><dt>Withholding</dt><dd>${money(breakdown.withholding)}</dd></div>
      <div><dt>${refundLabel(breakdown.refundOrDue)}</dt><dd>${refundValue(breakdown.refundOrDue)}</dd></div>
      <div><dt>Effective rate</dt><dd>${rate(breakdown.effectiveRate)}</dd></div>
      <div><dt>Marginal rate</dt><dd>${rate(breakdown.marginalRate)}</dd></div>
    </dl>
  </article>
`;

const renderResults = (result: TaxCalculationResult): void => {
  results.className = "results-ready";
  results.innerHTML = `
    <div class="summary-strip">
      <div>
        <span>Year</span>
        <strong>${result.yearLabel}</strong>
      </div>
      <div>
        <span>AGI</span>
        <strong>${money(result.income.agi)}</strong>
      </div>
      <div>
        <span>Total tax</span>
        <strong>${money(result.combined.totalTax)}</strong>
      </div>
      <div>
        <span>${refundLabel(result.combined.netRefundOrDue)}</span>
        <strong>${refundValue(result.combined.netRefundOrDue)}</strong>
      </div>
    </div>

    <div class="metric-grid">
      <article class="metric-card wide-card">
        <h3>Income summary</h3>
        <dl>
          <div><dt>Total income</dt><dd>${money(result.income.totalIncome)}</dd></div>
          <div><dt>AGI</dt><dd>${money(result.income.agi)}</dd></div>
          <div><dt>Standard deduction</dt><dd>${money(result.income.standardDeduction)}</dd></div>
          <div><dt>Federal taxable income</dt><dd>${money(result.income.taxableIncome)}</dd></div>
          <div><dt>Preferential income</dt><dd>${money(result.income.preferredIncome)}</dd></div>
          <div><dt>Ordinary taxable income</dt><dd>${money(result.income.ordinaryTaxableIncome)}</dd></div>
        </dl>
      </article>
      ${renderBreakdown("Federal", result.federal)}
      ${renderBreakdown("State", result.state)}
      <article class="metric-card">
        <h3>Combined</h3>
        <dl>
          <div><dt>Total tax</dt><dd>${money(result.combined.totalTax)}</dd></div>
          <div><dt>Total withholding</dt><dd>${money(result.combined.totalWithholding)}</dd></div>
          <div><dt>${refundLabel(result.combined.netRefundOrDue)}</dt><dd>${refundValue(result.combined.netRefundOrDue)}</dd></div>
        </dl>
      </article>
    </div>

    <article class="assumptions">
      <h3>Assumptions</h3>
      <ul>
        ${result.assumptions.map((entry) => `<li>${entry}</li>`).join("")}
      </ul>
    </article>
  `;
};

const renderError = (message: string): void => {
  results.className = "results-error";
  results.innerHTML = `<p>${message}</p>`;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  results.className = "results-loading";
  results.textContent = "Running estimate...";

  try {
    const formData = new FormData(form);
    const input = toInput(formData);
    const result = await invoke<TaxCalculationResult>("calculate_tax", { input });
    renderResults(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    renderError(`Unable to calculate taxes: ${message}`);
  }
});

form.requestSubmit();

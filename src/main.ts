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

type B1099Entry = {
  proceeds: number;
  costBasis: number;
  washSale: number;
  gainLoss: number;
};

type IntEntry = {
  taxableInterest: number;
  treasuryInterest: number;
  taxExemptInterest: number;
  privateActivityBondInterest: number;
  earlyWithdrawalPenalty: number;
  foreignTaxPaid: number;
  marketDiscount: number;
  bondPremium: number;
  treasuryBondPremium: number;
};

type DivEntry = {
  ordinaryDividends: number;
  qualifiedDividends: number;
  capitalGainDistributions: number;
  section199ADividends: number;
  foreignTaxPaid: number;
  exemptInterestDividends: number;
  privateActivityBondInterestDividends: number;
  liquidationDistributions: number;
};

type AccountDetails = {
  interest: IntEntry;
  dividends: DivEntry;
  miscIncome: number;
  b1099: {
    shortCovered: B1099Entry;
    shortNoncovered: B1099Entry;
    longCovered: B1099Entry;
    longNoncovered: B1099Entry;
  };
};

type W2Form = {
  id: string;
  employerName: string;
  employerEin: string;
  employeeName: string;
  employeeSsn: string;
  box1Wages: number;
  box2FederalWithholding: number;
  box3SocialSecurityWages: number;
  box4SocialSecurityTax: number;
  box5MedicareWages: number;
  box6MedicareTax: number;
  box7SocialSecurityTips: number;
  box8AllocatedTips: number;
  box10DependentCareBenefits: number;
  box11NonqualifiedPlans: number;
  box12aCode: string;
  box12aAmount: number;
  box12bCode: string;
  box12bAmount: number;
  box12cCode: string;
  box12cAmount: number;
  box12dCode: string;
  box12dAmount: number;
  box13StatutoryEmployee: boolean;
  box13RetirementPlan: boolean;
  box13ThirdPartySickPay: boolean;
  box14OtherLabel: string;
  box14OtherAmount: number;
  box15State: string;
  box15EmployerStateId: string;
  box16StateWages: number;
  box17StateIncomeTax: number;
  box18LocalWages: number;
  box19LocalIncomeTax: number;
  box20LocalityName: string;
};

type FormSettings = {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  residentState: StateCode;
};

type AppSnapshot = {
  version: 1;
  formSettings: FormSettings;
  w2Forms: W2Form[];
  accounts: string[];
  accountDetails: Record<string, AccountDetails>;
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
          <li>1099-INT with box detail</li>
          <li>1099-DIV with box detail</li>
          <li>1099-MISC</li>
          <li>1099-B covered and noncovered detail</li>
        </ul>
      </div>
    </section>

    <div class="main-tabs">
      <button type="button" class="main-tab-button active" data-tab="calculator">Tax Calculator</button>
      <button type="button" class="main-tab-button" data-tab="w2">W-2</button>
      <button type="button" class="main-tab-button" data-tab="accounts">Accounts</button>
      <button type="button" class="main-tab-button" data-tab="interest">Interest</button>
      <button type="button" class="main-tab-button" data-tab="dividends">Dividends</button>
      <button type="button" class="main-tab-button" data-tab="misc">Misc Income</button>
      <button type="button" class="main-tab-button" data-tab="b1099">1099-B Details</button>
      <button type="button" class="main-tab-button" data-tab="data">Data</button>
    </div>

    <div id="calculator-tab" class="main-tab-content active">
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
              <input name="federalWithholding" type="number" min="0" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>State withholding</span>
              <input name="stateWithholding" type="number" min="0" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>W-2 wages</span>
              <input name="wages" type="number" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>1099-INT taxable interest</span>
              <input name="taxableInterest" type="number" min="0" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>1099-DIV ordinary dividends</span>
              <input name="ordinaryDividends" type="number" min="0" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>1099-DIV qualified dividends</span>
              <input name="qualifiedDividends" type="number" min="0" step="0.01" value="0" readonly />
            </label>

            <label>
              <span>1099-MISC income</span>
              <input name="miscIncome" type="number" min="0" step="0.01" value="0" readonly />
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
    </div>

    <div id="w2-tab" class="main-tab-content">
      <section class="panel w2-panel">
        <div class="form-header">
          <h2>W-2 Forms</h2>
          <p>Enter each W-2 in full. Box 1 wages, box 2 federal withholding, and box 17 state income tax flow into the estimate automatically.</p>
        </div>

        <div class="w2-summary" id="w2-summary">
          <div><span>W-2 wages</span><strong id="w2-wages-total">0.00</strong></div>
          <div><span>Federal withholding</span><strong id="w2-federal-total">0.00</strong></div>
          <div><span>State withholding</span><strong id="w2-state-total">0.00</strong></div>
        </div>

        <div class="actions">
          <button type="button" id="add-w2-btn">Add W-2</button>
        </div>

        <div id="w2-forms" class="w2-forms">
          <!-- W-2 cards will be added dynamically -->
        </div>
      </section>
    </div>

    <div id="accounts-tab" class="main-tab-content">
      <section class="panel accounts-panel">
        <div class="form-header">
          <h2>Trading Accounts</h2>
          <p>Manage your trading account names. These will be pre-populated in the 1099-B details tables.</p>
        </div>

        <div class="account-setup">
          <div class="add-account">
            <input type="text" id="new-account-name" placeholder="Enter account name or ID" />
            <button type="button" id="add-account-btn">Add Account</button>
          </div>

          <div class="accounts-list" id="accounts-list">
            <!-- Accounts will be added here -->
          </div>
        </div>
      </section>
    </div>

    <div id="interest-tab" class="main-tab-content">
      <section class="panel accounts-panel">
        <div class="form-header">
          <h2>1099-INT Interest</h2>
          <p>Capture common 1099-INT boxes by account. Box 1 taxable interest feeds the current estimate.</p>
        </div>

        <div class="table-scroll">
          <table class="b1099-table wide-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Box 1 Taxable Interest</th>
                <th>Box 3 Treasury Interest</th>
                <th>Box 8 Tax-Exempt Interest</th>
                <th>Box 9 Private Activity Bond Interest</th>
                <th>Box 2 Early Withdrawal Penalty</th>
                <th>Box 6 Foreign Tax Paid</th>
                <th>Box 10 Market Discount</th>
                <th>Box 11 Bond Premium</th>
                <th>Box 12 Treasury Bond Premium</th>
              </tr>
            </thead>
            <tbody id="interest-rows">
              <!-- Rows will be added dynamically -->
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td class="sum" id="interest-taxable-total">0.00</td>
                <td class="sum" id="interest-treasury-total">0.00</td>
                <td class="sum" id="interest-tax-exempt-total">0.00</td>
                <td class="sum" id="interest-private-activity-total">0.00</td>
                <td class="sum" id="interest-penalty-total">0.00</td>
                <td class="sum" id="interest-foreign-tax-total">0.00</td>
                <td class="sum" id="interest-market-discount-total">0.00</td>
                <td class="sum" id="interest-bond-premium-total">0.00</td>
                <td class="sum" id="interest-treasury-bond-premium-total">0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>

    <div id="dividends-tab" class="main-tab-content">
      <section class="panel accounts-panel">
        <div class="form-header">
          <h2>1099-DIV Dividends</h2>
          <p>Capture common 1099-DIV boxes by account. Boxes 1a and 1b feed the current estimate.</p>
        </div>

        <div class="table-scroll">
          <table class="b1099-table wide-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Box 1a Ordinary Dividends</th>
                <th>Box 1b Qualified Dividends</th>
                <th>Box 2a Capital Gain Distributions</th>
                <th>Box 5 Section 199A Dividends</th>
                <th>Box 7 Foreign Tax Paid</th>
                <th>Box 11 Exempt-Interest Dividends</th>
                <th>Box 12 Private Activity Bond Interest Dividends</th>
                <th>Liquidation Distributions</th>
              </tr>
            </thead>
            <tbody id="dividends-rows">
              <!-- Rows will be added dynamically -->
            </tbody>
            <tfoot>
              <tr>
                <td><strong>Total</strong></td>
                <td class="sum" id="ordinary-dividends-total">0.00</td>
                <td class="sum" id="qualified-dividends-total">0.00</td>
                <td class="sum" id="capital-gain-distributions-total">0.00</td>
                <td class="sum" id="section-199a-dividends-total">0.00</td>
                <td class="sum" id="dividends-foreign-tax-total">0.00</td>
                <td class="sum" id="exempt-interest-dividends-total">0.00</td>
                <td class="sum" id="private-activity-dividends-total">0.00</td>
                <td class="sum" id="liquidation-distributions-total">0.00</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>

    <div id="misc-tab" class="main-tab-content">
      <section class="panel accounts-panel">
        <div class="form-header">
          <h2>1099-MISC Income</h2>
          <p>Enter miscellaneous income from each account.</p>
        </div>

        <table class="b1099-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Miscellaneous Income</th>
            </tr>
          </thead>
          <tbody id="misc-rows">
            <!-- Rows will be added dynamically -->
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td class="sum" id="misc-income-total">0.00</td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>

    <div id="b1099-tab" class="main-tab-content">
      <section class="panel b1099-panel">
        <div class="form-header">
          <h2>1099-B Details</h2>
          <p>Track covered and noncovered sales separately. Short-term totals roll into short-term gains, and long-term totals roll into long-term gains.</p>
        </div>

        <div class="tabs">
          <button type="button" class="tab-button active" data-tab="short-covered">Short-Term Covered</button>
          <button type="button" class="tab-button" data-tab="short-noncovered">Short-Term Noncovered</button>
          <button type="button" class="tab-button" data-tab="long-covered">Long-Term Covered</button>
          <button type="button" class="tab-button" data-tab="long-noncovered">Long-Term Noncovered</button>
        </div>

        <div id="short-covered-tab" class="tab-content active">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody id="short-covered-rows">
                <!-- Rows will be added dynamically -->
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td class="sum" id="short-covered-proceeds-sum">0.00</td>
                  <td class="sum" id="short-covered-cost-sum">0.00</td>
                  <td class="sum" id="short-covered-wash-sum">0.00</td>
                  <td class="sum" id="short-covered-gain-sum">0.00</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div id="short-noncovered-tab" class="tab-content">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody id="short-noncovered-rows">
                <!-- Rows will be added dynamically -->
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td class="sum" id="short-noncovered-proceeds-sum">0.00</td>
                  <td class="sum" id="short-noncovered-cost-sum">0.00</td>
                  <td class="sum" id="short-noncovered-wash-sum">0.00</td>
                  <td class="sum" id="short-noncovered-gain-sum">0.00</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div id="long-covered-tab" class="tab-content">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody id="long-covered-rows">
                <!-- Rows will be added dynamically -->
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td class="sum" id="long-covered-proceeds-sum">0.00</td>
                  <td class="sum" id="long-covered-cost-sum">0.00</td>
                  <td class="sum" id="long-covered-wash-sum">0.00</td>
                  <td class="sum" id="long-covered-gain-sum">0.00</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div id="long-noncovered-tab" class="tab-content">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale</th>
                  <th>Gain/Loss</th>
                  <th>Calculated</th>
                </tr>
              </thead>
              <tbody id="long-noncovered-rows">
                <!-- Rows will be added dynamically -->
              </tbody>
              <tfoot>
                <tr>
                  <td></td>
                  <td class="sum" id="long-noncovered-proceeds-sum">0.00</td>
                  <td class="sum" id="long-noncovered-cost-sum">0.00</td>
                  <td class="sum" id="long-noncovered-wash-sum">0.00</td>
                  <td class="sum" id="long-noncovered-gain-sum">0.00</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>
    </div>

    <div id="data-tab" class="main-tab-content">
      <section class="panel data-panel">
        <div class="form-header">
          <h2>Data</h2>
          <p>Use Save to export your data to a JSON file. Use Open to import from a JSON file.</p>
        </div>

        <div class="actions">
          <button type="button" id="export-json-btn">Save</button>
          <button type="button" id="import-json-btn">Open</button>
        </div>

        <p id="data-status" class="microcopy">Data is not auto-saved. Use Save/Open for persistence.</p>
      </section>
    </div>
  </main>
`;

const form = document.querySelector<HTMLFormElement>("#tax-form");
const results = document.querySelector<HTMLDivElement>("#results");

if (!form || !results) {
  throw new Error("Required UI elements are missing.");
}

const shortTermGainsInput = form.querySelector<HTMLInputElement>('input[name="shortTermGains"]');
const longTermGainsInput = form.querySelector<HTMLInputElement>('input[name="longTermGains"]');
const taxableInterestInput = form.querySelector<HTMLInputElement>('input[name="taxableInterest"]');
const ordinaryDividendsInput = form.querySelector<HTMLInputElement>('input[name="ordinaryDividends"]');
const qualifiedDividendsInput = form.querySelector<HTMLInputElement>('input[name="qualifiedDividends"]');
const miscIncomeInput = form.querySelector<HTMLInputElement>('input[name="miscIncome"]');
const wagesInput = form.querySelector<HTMLInputElement>('input[name="wages"]');
const federalWithholdingInput = form.querySelector<HTMLInputElement>('input[name="federalWithholding"]');
const stateWithholdingInput = form.querySelector<HTMLInputElement>('input[name="stateWithholding"]');

if (
  !shortTermGainsInput
  || !longTermGainsInput
  || !taxableInterestInput
  || !ordinaryDividendsInput
  || !qualifiedDividendsInput
  || !miscIncomeInput
  || !wagesInput
  || !federalWithholdingInput
  || !stateWithholdingInput
) {
  throw new Error("Required summary inputs are missing.");
}

const b1099Configs = [
  { key: "shortCovered", tabId: "short-covered", term: "short", label: "Short-Term Covered" },
  { key: "shortNoncovered", tabId: "short-noncovered", term: "short", label: "Short-Term Noncovered" },
  { key: "longCovered", tabId: "long-covered", term: "long", label: "Long-Term Covered" },
  { key: "longNoncovered", tabId: "long-noncovered", term: "long", label: "Long-Term Noncovered" },
] as const;

type B1099Category = (typeof b1099Configs)[number]["key"];

const accountTableConfigs: Array<{ tbodyId: string; colspan: number; message: string }> = [
  { tbodyId: "interest-rows", colspan: 10, message: "Add accounts in the Accounts tab to enter 1099-INT details." },
  { tbodyId: "dividends-rows", colspan: 9, message: "Add accounts in the Accounts tab to enter 1099-DIV details." },
  { tbodyId: "misc-rows", colspan: 2, message: "Add accounts in the Accounts tab to enter 1099-MISC details." },
  ...b1099Configs.map(({ tabId, label }) => ({
    tbodyId: `${tabId}-rows`,
    colspan: 6,
    message: `Add accounts in the Accounts tab to enter ${label.toLowerCase()} 1099-B details.`,
  })),
];

const readStoredNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatInputValue = (value: number): string => (Math.abs(value) < 0.005 ? "" : String(value));

const createEmptyB1099Entry = (): B1099Entry => ({
  proceeds: 0,
  costBasis: 0,
  washSale: 0,
  gainLoss: 0,
});

const createEmptyInterestEntry = (): IntEntry => ({
  taxableInterest: 0,
  treasuryInterest: 0,
  taxExemptInterest: 0,
  privateActivityBondInterest: 0,
  earlyWithdrawalPenalty: 0,
  foreignTaxPaid: 0,
  marketDiscount: 0,
  bondPremium: 0,
  treasuryBondPremium: 0,
});

const createEmptyDividendsEntry = (): DivEntry => ({
  ordinaryDividends: 0,
  qualifiedDividends: 0,
  capitalGainDistributions: 0,
  section199ADividends: 0,
  foreignTaxPaid: 0,
  exemptInterestDividends: 0,
  privateActivityBondInterestDividends: 0,
  liquidationDistributions: 0,
});

const createEmptyAccountDetails = (): AccountDetails => ({
  interest: createEmptyInterestEntry(),
  dividends: createEmptyDividendsEntry(),
  miscIncome: 0,
  b1099: {
    shortCovered: createEmptyB1099Entry(),
    shortNoncovered: createEmptyB1099Entry(),
    longCovered: createEmptyB1099Entry(),
    longNoncovered: createEmptyB1099Entry(),
  },
});

const createEmptyW2Form = (): W2Form => ({
  id: crypto.randomUUID(),
  employerName: "",
  employerEin: "",
  employeeName: "",
  employeeSsn: "",
  box1Wages: 0,
  box2FederalWithholding: 0,
  box3SocialSecurityWages: 0,
  box4SocialSecurityTax: 0,
  box5MedicareWages: 0,
  box6MedicareTax: 0,
  box7SocialSecurityTips: 0,
  box8AllocatedTips: 0,
  box10DependentCareBenefits: 0,
  box11NonqualifiedPlans: 0,
  box12aCode: "",
  box12aAmount: 0,
  box12bCode: "",
  box12bAmount: 0,
  box12cCode: "",
  box12cAmount: 0,
  box12dCode: "",
  box12dAmount: 0,
  box13StatutoryEmployee: false,
  box13RetirementPlan: false,
  box13ThirdPartySickPay: false,
  box14OtherLabel: "",
  box14OtherAmount: 0,
  box15State: "",
  box15EmployerStateId: "",
  box16StateWages: 0,
  box17StateIncomeTax: 0,
  box18LocalWages: 0,
  box19LocalIncomeTax: 0,
  box20LocalityName: "",
});

function normalizeB1099Entry(value: unknown): B1099Entry {
  const entry = (value ?? {}) as Partial<B1099Entry>;
  return {
    proceeds: readStoredNumber(entry.proceeds),
    costBasis: readStoredNumber(entry.costBasis),
    washSale: readStoredNumber(entry.washSale),
    gainLoss: readStoredNumber(entry.gainLoss),
  };
}

function normalizeInterestEntry(value: unknown): IntEntry {
  const entry = (value ?? {}) as Partial<IntEntry>;
  return {
    taxableInterest: readStoredNumber(entry.taxableInterest),
    treasuryInterest: readStoredNumber(entry.treasuryInterest),
    taxExemptInterest: readStoredNumber(entry.taxExemptInterest),
    privateActivityBondInterest: readStoredNumber(entry.privateActivityBondInterest),
    earlyWithdrawalPenalty: readStoredNumber(entry.earlyWithdrawalPenalty),
    foreignTaxPaid: readStoredNumber(entry.foreignTaxPaid),
    marketDiscount: readStoredNumber(entry.marketDiscount),
    bondPremium: readStoredNumber(entry.bondPremium),
    treasuryBondPremium: readStoredNumber(entry.treasuryBondPremium),
  };
}

function normalizeDividendsEntry(value: unknown): DivEntry {
  const entry = (value ?? {}) as Partial<DivEntry>;
  return {
    ordinaryDividends: readStoredNumber(entry.ordinaryDividends),
    qualifiedDividends: readStoredNumber(entry.qualifiedDividends),
    capitalGainDistributions: readStoredNumber(entry.capitalGainDistributions),
    section199ADividends: readStoredNumber(entry.section199ADividends),
    foreignTaxPaid: readStoredNumber(entry.foreignTaxPaid),
    exemptInterestDividends: readStoredNumber(entry.exemptInterestDividends),
    privateActivityBondInterestDividends: readStoredNumber(entry.privateActivityBondInterestDividends),
    liquidationDistributions: readStoredNumber(entry.liquidationDistributions),
  };
}

function normalizeAccountDetails(value: unknown): AccountDetails {
  const entry = (value ?? {}) as Partial<AccountDetails> & { b1099?: Partial<AccountDetails["b1099"]> };
  return {
    interest: normalizeInterestEntry(entry.interest),
    dividends: normalizeDividendsEntry(entry.dividends),
    miscIncome: readStoredNumber(entry.miscIncome),
    b1099: {
      shortCovered: normalizeB1099Entry(entry.b1099?.shortCovered),
      shortNoncovered: normalizeB1099Entry(entry.b1099?.shortNoncovered),
      longCovered: normalizeB1099Entry(entry.b1099?.longCovered),
      longNoncovered: normalizeB1099Entry(entry.b1099?.longNoncovered),
    },
  };
}

function normalizeW2Form(value: unknown): W2Form {
  const entry = (value ?? {}) as Partial<W2Form>;
  return {
    id: typeof entry.id === 'string' && entry.id ? entry.id : crypto.randomUUID(),
    employerName: String(entry.employerName ?? ''),
    employerEin: String(entry.employerEin ?? ''),
    employeeName: String(entry.employeeName ?? ''),
    employeeSsn: String(entry.employeeSsn ?? ''),
    box1Wages: readStoredNumber(entry.box1Wages),
    box2FederalWithholding: readStoredNumber(entry.box2FederalWithholding),
    box3SocialSecurityWages: readStoredNumber(entry.box3SocialSecurityWages),
    box4SocialSecurityTax: readStoredNumber(entry.box4SocialSecurityTax),
    box5MedicareWages: readStoredNumber(entry.box5MedicareWages),
    box6MedicareTax: readStoredNumber(entry.box6MedicareTax),
    box7SocialSecurityTips: readStoredNumber(entry.box7SocialSecurityTips),
    box8AllocatedTips: readStoredNumber(entry.box8AllocatedTips),
    box10DependentCareBenefits: readStoredNumber(entry.box10DependentCareBenefits),
    box11NonqualifiedPlans: readStoredNumber(entry.box11NonqualifiedPlans),
    box12aCode: String(entry.box12aCode ?? ''),
    box12aAmount: readStoredNumber(entry.box12aAmount),
    box12bCode: String(entry.box12bCode ?? ''),
    box12bAmount: readStoredNumber(entry.box12bAmount),
    box12cCode: String(entry.box12cCode ?? ''),
    box12cAmount: readStoredNumber(entry.box12cAmount),
    box12dCode: String(entry.box12dCode ?? ''),
    box12dAmount: readStoredNumber(entry.box12dAmount),
    box13StatutoryEmployee: Boolean(entry.box13StatutoryEmployee),
    box13RetirementPlan: Boolean(entry.box13RetirementPlan),
    box13ThirdPartySickPay: Boolean(entry.box13ThirdPartySickPay),
    box14OtherLabel: String(entry.box14OtherLabel ?? ''),
    box14OtherAmount: readStoredNumber(entry.box14OtherAmount),
    box15State: String(entry.box15State ?? ''),
    box15EmployerStateId: String(entry.box15EmployerStateId ?? ''),
    box16StateWages: readStoredNumber(entry.box16StateWages),
    box17StateIncomeTax: readStoredNumber(entry.box17StateIncomeTax),
    box18LocalWages: readStoredNumber(entry.box18LocalWages),
    box19LocalIncomeTax: readStoredNumber(entry.box19LocalIncomeTax),
    box20LocalityName: String(entry.box20LocalityName ?? ''),
  };
}

function readFormSettings(): FormSettings {
  const safeForm = form!;
  const taxYearField = safeForm.elements.namedItem('taxYear');
  const filingStatusField = safeForm.elements.namedItem('filingStatus');
  const residentStateField = safeForm.elements.namedItem('residentState');

  return {
    taxYear: String(taxYearField instanceof HTMLSelectElement ? taxYearField.value : 'y2024') as TaxYear,
    filingStatus: String(filingStatusField instanceof HTMLSelectElement ? filingStatusField.value : 'single') as FilingStatus,
    residentState: String(residentStateField instanceof HTMLSelectElement ? residentStateField.value : 'nj') as StateCode,
  };
}

function applyFormSettings(settings: FormSettings) {
  const safeForm = form!;
  const taxYearSelect = safeForm.elements.namedItem('taxYear');
  const filingStatusSelect = safeForm.elements.namedItem('filingStatus');
  const residentStateSelect = safeForm.elements.namedItem('residentState');

  if (taxYearSelect instanceof HTMLSelectElement) {
    taxYearSelect.value = settings.taxYear;
  }
  if (filingStatusSelect instanceof HTMLSelectElement) {
    filingStatusSelect.value = settings.filingStatus;
  }
  if (residentStateSelect instanceof HTMLSelectElement) {
    residentStateSelect.value = settings.residentState;
  }
}

function buildSnapshot(): AppSnapshot {
  return {
    version: 1,
    formSettings: readFormSettings(),
    w2Forms,
    accounts,
    accountDetails,
  };
}

function normalizeSnapshot(value: unknown): AppSnapshot {
  const snapshot = (value ?? {}) as Partial<AppSnapshot>;
  return {
    version: 1,
    formSettings: {
      taxYear: String(snapshot.formSettings?.taxYear ?? 'y2024') as TaxYear,
      filingStatus: String(snapshot.formSettings?.filingStatus ?? 'single') as FilingStatus,
      residentState: String(snapshot.formSettings?.residentState ?? 'nj') as StateCode,
    },
    w2Forms: Array.isArray(snapshot.w2Forms) ? snapshot.w2Forms.map((entry) => normalizeW2Form(entry)) : [],
    accounts: Array.isArray(snapshot.accounts)
      ? snapshot.accounts.map((value) => String(value).trim()).filter((value, index, values) => value.length > 0 && values.indexOf(value) === index)
      : [],
    accountDetails: snapshot.accountDetails && typeof snapshot.accountDetails === 'object'
      ? Object.fromEntries(Object.entries(snapshot.accountDetails).map(([accountName, entry]) => [accountName, normalizeAccountDetails(entry)]))
      : {},
  };
}

function getB1099Config(category: B1099Category) {
  return b1099Configs.find((config) => config.key === category)!;
}

function setTextContent(id: string, value: number) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value.toFixed(2);
  }
}

function calculateB1099Value(entry: B1099Entry): number {
  return entry.proceeds - entry.costBasis - entry.washSale;
}

// Main tab switching
document.querySelectorAll('.main-tab-button').forEach(button => {
  button.addEventListener('click', () => {
    const tab = button.getAttribute('data-tab');
    document.querySelectorAll('.main-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.main-tab-content').forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(`${tab}-tab`)?.classList.add('active');
  });
});

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

const w2FormsContainer = document.getElementById('w2-forms') as HTMLElement;
const addW2Btn = document.getElementById('add-w2-btn') as HTMLButtonElement;
const exportJsonBtn = document.getElementById('export-json-btn') as HTMLButtonElement;
const importJsonBtn = document.getElementById('import-json-btn') as HTMLButtonElement;
const dataStatus = document.getElementById('data-status') as HTMLParagraphElement;

let w2Forms: W2Form[] = [];

function setDataStatus(message: string, isError = false) {
  dataStatus.textContent = message;
  dataStatus.classList.toggle('data-error', isError);
}

function updateW2SummaryInputs() {
  let wages = 0;
  let federalWithholding = 0;
  let stateWithholding = 0;

  w2Forms.forEach((entry) => {
    wages += entry.box1Wages;
    federalWithholding += entry.box2FederalWithholding;
    stateWithholding += entry.box17StateIncomeTax;
  });

  setTextContent('w2-wages-total', wages);
  setTextContent('w2-federal-total', federalWithholding);
  setTextContent('w2-state-total', stateWithholding);
  wagesInput!.value = wages.toFixed(2);
  federalWithholdingInput!.value = federalWithholding.toFixed(2);
  stateWithholdingInput!.value = stateWithholding.toFixed(2);
}

function removeW2Form(id: string) {
  w2Forms = w2Forms.filter((entry) => entry.id !== id);
  renderW2Forms();
  updateW2SummaryInputs();
}

function renderW2Forms() {
  w2FormsContainer.innerHTML = '';

  if (w2Forms.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-card';
    emptyState.textContent = 'Add a W-2 to start capturing box-level payroll detail.';
    w2FormsContainer.appendChild(emptyState);
    return;
  }

  w2Forms.forEach((entry, index) => {
    const card = document.createElement('article');
    card.className = 'w2-card';
    card.innerHTML = `
      <div class="w2-card-header">
        <div>
          <h3>W-2 ${index + 1}</h3>
          <p>Employer and box-level detail for one W-2.</p>
        </div>
        <button type="button" class="danger-button" data-remove-w2="${entry.id}">Remove</button>
      </div>

      <div class="w2-grid">
        <label><span>Employer name</span><input type="text" data-string-field="employerName" value="${entry.employerName}" /></label>
        <label><span>Employer EIN</span><input type="text" data-string-field="employerEin" value="${entry.employerEin}" /></label>
        <label><span>Employee name</span><input type="text" data-string-field="employeeName" value="${entry.employeeName}" /></label>
        <label><span>Employee SSN</span><input type="text" data-string-field="employeeSsn" value="${entry.employeeSsn}" /></label>

        <label><span>Box 1 Wages, tips, other comp</span><input type="number" step="0.01" data-number-field="box1Wages" value="${formatInputValue(entry.box1Wages)}" /></label>
        <label><span>Box 2 Federal income tax withheld</span><input type="number" step="0.01" data-number-field="box2FederalWithholding" value="${formatInputValue(entry.box2FederalWithholding)}" /></label>
        <label><span>Box 3 Social Security wages</span><input type="number" step="0.01" data-number-field="box3SocialSecurityWages" value="${formatInputValue(entry.box3SocialSecurityWages)}" /></label>
        <label><span>Box 4 Social Security tax withheld</span><input type="number" step="0.01" data-number-field="box4SocialSecurityTax" value="${formatInputValue(entry.box4SocialSecurityTax)}" /></label>
        <label><span>Box 5 Medicare wages and tips</span><input type="number" step="0.01" data-number-field="box5MedicareWages" value="${formatInputValue(entry.box5MedicareWages)}" /></label>
        <label><span>Box 6 Medicare tax withheld</span><input type="number" step="0.01" data-number-field="box6MedicareTax" value="${formatInputValue(entry.box6MedicareTax)}" /></label>
        <label><span>Box 7 Social Security tips</span><input type="number" step="0.01" data-number-field="box7SocialSecurityTips" value="${formatInputValue(entry.box7SocialSecurityTips)}" /></label>
        <label><span>Box 8 Allocated tips</span><input type="number" step="0.01" data-number-field="box8AllocatedTips" value="${formatInputValue(entry.box8AllocatedTips)}" /></label>
        <label><span>Box 10 Dependent care benefits</span><input type="number" step="0.01" data-number-field="box10DependentCareBenefits" value="${formatInputValue(entry.box10DependentCareBenefits)}" /></label>
        <label><span>Box 11 Nonqualified plans</span><input type="number" step="0.01" data-number-field="box11NonqualifiedPlans" value="${formatInputValue(entry.box11NonqualifiedPlans)}" /></label>

        <label><span>Box 12a code</span><input type="text" data-string-field="box12aCode" value="${entry.box12aCode}" /></label>
        <label><span>Box 12a amount</span><input type="number" step="0.01" data-number-field="box12aAmount" value="${formatInputValue(entry.box12aAmount)}" /></label>
        <label><span>Box 12b code</span><input type="text" data-string-field="box12bCode" value="${entry.box12bCode}" /></label>
        <label><span>Box 12b amount</span><input type="number" step="0.01" data-number-field="box12bAmount" value="${formatInputValue(entry.box12bAmount)}" /></label>
        <label><span>Box 12c code</span><input type="text" data-string-field="box12cCode" value="${entry.box12cCode}" /></label>
        <label><span>Box 12c amount</span><input type="number" step="0.01" data-number-field="box12cAmount" value="${formatInputValue(entry.box12cAmount)}" /></label>
        <label><span>Box 12d code</span><input type="text" data-string-field="box12dCode" value="${entry.box12dCode}" /></label>
        <label><span>Box 12d amount</span><input type="number" step="0.01" data-number-field="box12dAmount" value="${formatInputValue(entry.box12dAmount)}" /></label>

        <label class="checkbox-field"><input type="checkbox" data-boolean-field="box13StatutoryEmployee" ${entry.box13StatutoryEmployee ? 'checked' : ''} /><span>Box 13 Statutory employee</span></label>
        <label class="checkbox-field"><input type="checkbox" data-boolean-field="box13RetirementPlan" ${entry.box13RetirementPlan ? 'checked' : ''} /><span>Box 13 Retirement plan</span></label>
        <label class="checkbox-field"><input type="checkbox" data-boolean-field="box13ThirdPartySickPay" ${entry.box13ThirdPartySickPay ? 'checked' : ''} /><span>Box 13 Third-party sick pay</span></label>
        <div></div>

        <label><span>Box 14 other label</span><input type="text" data-string-field="box14OtherLabel" value="${entry.box14OtherLabel}" /></label>
        <label><span>Box 14 other amount</span><input type="number" step="0.01" data-number-field="box14OtherAmount" value="${formatInputValue(entry.box14OtherAmount)}" /></label>
        <label><span>Box 15 state</span><input type="text" data-string-field="box15State" value="${entry.box15State}" /></label>
        <label><span>Box 15 employer state ID</span><input type="text" data-string-field="box15EmployerStateId" value="${entry.box15EmployerStateId}" /></label>
        <label><span>Box 16 state wages</span><input type="number" step="0.01" data-number-field="box16StateWages" value="${formatInputValue(entry.box16StateWages)}" /></label>
        <label><span>Box 17 state income tax</span><input type="number" step="0.01" data-number-field="box17StateIncomeTax" value="${formatInputValue(entry.box17StateIncomeTax)}" /></label>
        <label><span>Box 18 local wages</span><input type="number" step="0.01" data-number-field="box18LocalWages" value="${formatInputValue(entry.box18LocalWages)}" /></label>
        <label><span>Box 19 local income tax</span><input type="number" step="0.01" data-number-field="box19LocalIncomeTax" value="${formatInputValue(entry.box19LocalIncomeTax)}" /></label>
        <label><span>Box 20 locality name</span><input type="text" data-string-field="box20LocalityName" value="${entry.box20LocalityName}" /></label>
      </div>
    `;

    card.querySelector('[data-remove-w2]')?.addEventListener('click', () => removeW2Form(entry.id));

    card.querySelectorAll<HTMLInputElement>('input[data-string-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.stringField as keyof W2Form;
        const target = w2Forms.find((item) => item.id === entry.id);
        if (!target) {
          return;
        }
        (target[field] as string) = input.value;
      });
    });

    card.querySelectorAll<HTMLInputElement>('input[data-number-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.numberField as keyof W2Form;
        const target = w2Forms.find((item) => item.id === entry.id);
        if (!target) {
          return;
        }
        (target[field] as number) = readStoredNumber(input.value);
        updateW2SummaryInputs();
      });
    });

    card.querySelectorAll<HTMLInputElement>('input[data-boolean-field]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.booleanField as keyof W2Form;
        const target = w2Forms.find((item) => item.id === entry.id);
        if (!target) {
          return;
        }
        (target[field] as boolean) = input.checked;
      });
    });

    w2FormsContainer.appendChild(card);
  });
}

function addW2Form() {
  w2Forms.push(createEmptyW2Form());
  renderW2Forms();
  updateW2SummaryInputs();
}

function applySnapshot(snapshot: AppSnapshot) {
  applyFormSettings(snapshot.formSettings);
  w2Forms = snapshot.w2Forms.map((entry) => normalizeW2Form(entry));
  accounts = snapshot.accounts;
  accountDetails = snapshot.accountDetails;
  syncStateWithAccounts();
  renderW2Forms();
  renderAccounts();
  syncAccountTables();
  updateW2SummaryInputs();
  form!.requestSubmit();
}

async function exportSnapshot() {
  try {
    const suggestedFileName = `tax-cross-check-${new Date().toISOString().slice(0, 10)}.json`;
    const savedPath = await invoke<string | null>('save_export_json', {
      contents: JSON.stringify(buildSnapshot(), null, 2),
      suggestedFileName,
    });

    if (!savedPath) {
      setDataStatus('Export canceled.');
      return;
    }

    setDataStatus(`Exported JSON to ${savedPath}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDataStatus(`Unable to export JSON: ${message}`, true);
  }
}

async function importSnapshot() {
  try {
    const contents = await invoke<string | null>('open_import_json');
    if (!contents) {
      setDataStatus('Import canceled.');
      return;
    }

    const parsed = JSON.parse(contents);
    const snapshot = normalizeSnapshot(parsed);
    applySnapshot(snapshot);
    setDataStatus('Imported JSON snapshot successfully.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDataStatus(`Unable to import JSON: ${message}`, true);
  }
}

// Account management
const accountsList = document.getElementById('accounts-list') as HTMLElement;
const newAccountInput = document.getElementById('new-account-name') as HTMLInputElement;
const addAccountBtn = document.getElementById('add-account-btn') as HTMLButtonElement;

let accounts: string[] = [];
let accountDetails: Record<string, AccountDetails> = {};

function syncStateWithAccounts() {
  const nextDetails: Record<string, AccountDetails> = {};

  accounts.forEach((accountName) => {
    nextDetails[accountName] = accountDetails[accountName]
      ? normalizeAccountDetails(accountDetails[accountName])
      : createEmptyAccountDetails();
  });

  accountDetails = nextDetails;
}

function getAccountDetails(accountName: string): AccountDetails {
  if (!accountDetails[accountName]) {
    accountDetails[accountName] = createEmptyAccountDetails();
  }

  return accountDetails[accountName];
}

function renderEmptyState(tbodyId: string, colspan: number, message: string) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody || tbody.querySelector('.empty-state-row')) {
    return;
  }

  const row = document.createElement('tr');
  row.className = 'empty-state-row';
  const cell = document.createElement('td');
  cell.colSpan = colspan;
  cell.textContent = message;
  row.appendChild(cell);
  tbody.appendChild(row);
}

function removeEmptyState(tbodyId: string) {
  document.getElementById(tbodyId)?.querySelector('.empty-state-row')?.remove();
}

function refreshEmptyStates() {
  accountTableConfigs.forEach(({ tbodyId, colspan, message }) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) {
      return;
    }

    if (tbody.querySelector('.data-row')) {
      removeEmptyState(tbodyId);
    } else {
      renderEmptyState(tbodyId, colspan, message);
    }
  });
}

function updateInterestTotals() {
  let taxable = 0;
  let treasury = 0;
  let taxExempt = 0;
  let privateActivity = 0;
  let penalty = 0;
  let foreignTax = 0;
  let marketDiscount = 0;
  let bondPremium = 0;
  let treasuryBondPremium = 0;

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).interest;
    taxable += entry.taxableInterest;
    treasury += entry.treasuryInterest;
    taxExempt += entry.taxExemptInterest;
    privateActivity += entry.privateActivityBondInterest;
    penalty += entry.earlyWithdrawalPenalty;
    foreignTax += entry.foreignTaxPaid;
    marketDiscount += entry.marketDiscount;
    bondPremium += entry.bondPremium;
    treasuryBondPremium += entry.treasuryBondPremium;
  });

  setTextContent('interest-taxable-total', taxable);
  setTextContent('interest-treasury-total', treasury);
  setTextContent('interest-tax-exempt-total', taxExempt);
  setTextContent('interest-private-activity-total', privateActivity);
  setTextContent('interest-penalty-total', penalty);
  setTextContent('interest-foreign-tax-total', foreignTax);
  setTextContent('interest-market-discount-total', marketDiscount);
  setTextContent('interest-bond-premium-total', bondPremium);
  setTextContent('interest-treasury-bond-premium-total', treasuryBondPremium);
  taxableInterestInput!.value = taxable.toFixed(2);
}

function updateDividendsTotals() {
  let ordinary = 0;
  let qualified = 0;
  let capitalGain = 0;
  let section199A = 0;
  let foreignTax = 0;
  let exemptInterest = 0;
  let privateActivity = 0;
  let liquidation = 0;

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).dividends;
    ordinary += entry.ordinaryDividends;
    qualified += entry.qualifiedDividends;
    capitalGain += entry.capitalGainDistributions;
    section199A += entry.section199ADividends;
    foreignTax += entry.foreignTaxPaid;
    exemptInterest += entry.exemptInterestDividends;
    privateActivity += entry.privateActivityBondInterestDividends;
    liquidation += entry.liquidationDistributions;
  });

  setTextContent('ordinary-dividends-total', ordinary);
  setTextContent('qualified-dividends-total', qualified);
  setTextContent('capital-gain-distributions-total', capitalGain);
  setTextContent('section-199a-dividends-total', section199A);
  setTextContent('dividends-foreign-tax-total', foreignTax);
  setTextContent('exempt-interest-dividends-total', exemptInterest);
  setTextContent('private-activity-dividends-total', privateActivity);
  setTextContent('liquidation-distributions-total', liquidation);
  ordinaryDividendsInput!.value = ordinary.toFixed(2);
  qualifiedDividendsInput!.value = qualified.toFixed(2);
}

function updateMiscTotal() {
  let total = 0;
  accounts.forEach((accountName) => {
    total += getAccountDetails(accountName).miscIncome;
  });

  setTextContent('misc-income-total', total);
  miscIncomeInput!.value = total.toFixed(2);
}

function updateB1099CategoryTotals(category: B1099Category) {
  const config = getB1099Config(category);
  let proceeds = 0;
  let costBasis = 0;
  let washSale = 0;
  let gainLoss = 0;

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).b1099[category];
    proceeds += entry.proceeds;
    costBasis += entry.costBasis;
    washSale += entry.washSale;
    gainLoss += entry.gainLoss;
  });

  setTextContent(`${config.tabId}-proceeds-sum`, proceeds);
  setTextContent(`${config.tabId}-cost-sum`, costBasis);
  setTextContent(`${config.tabId}-wash-sum`, washSale);
  setTextContent(`${config.tabId}-gain-sum`, gainLoss);
}

function updateB1099SummaryInputs() {
  let shortTermTotal = 0;
  let longTermTotal = 0;

  b1099Configs.forEach((config) => {
    let categoryTotal = 0;
    accounts.forEach((accountName) => {
      categoryTotal += getAccountDetails(accountName).b1099[config.key].gainLoss;
    });

    if (config.term === 'short') {
      shortTermTotal += categoryTotal;
    } else {
      longTermTotal += categoryTotal;
    }

    updateB1099CategoryTotals(config.key);
  });

  shortTermGainsInput!.value = shortTermTotal.toFixed(2);
  longTermGainsInput!.value = longTermTotal.toFixed(2);
}

function renderInterestRows() {
  const tbody = document.getElementById('interest-rows');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).interest;
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${accountName}" readonly /></td>
      <td><input type="number" step="0.01" data-field="taxableInterest" value="${formatInputValue(entry.taxableInterest)}" /></td>
      <td><input type="number" step="0.01" data-field="treasuryInterest" value="${formatInputValue(entry.treasuryInterest)}" /></td>
      <td><input type="number" step="0.01" data-field="taxExemptInterest" value="${formatInputValue(entry.taxExemptInterest)}" /></td>
      <td><input type="number" step="0.01" data-field="privateActivityBondInterest" value="${formatInputValue(entry.privateActivityBondInterest)}" /></td>
      <td><input type="number" step="0.01" data-field="earlyWithdrawalPenalty" value="${formatInputValue(entry.earlyWithdrawalPenalty)}" /></td>
      <td><input type="number" step="0.01" data-field="foreignTaxPaid" value="${formatInputValue(entry.foreignTaxPaid)}" /></td>
      <td><input type="number" step="0.01" data-field="marketDiscount" value="${formatInputValue(entry.marketDiscount)}" /></td>
      <td><input type="number" step="0.01" data-field="bondPremium" value="${formatInputValue(entry.bondPremium)}" /></td>
      <td><input type="number" step="0.01" data-field="treasuryBondPremium" value="${formatInputValue(entry.treasuryBondPremium)}" /></td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof IntEntry;
        getAccountDetails(accountName).interest[field] = readStoredNumber(input.value);
        updateInterestTotals();
      });
    });

    tbody.appendChild(row);
  });
}

function renderDividendsRows() {
  const tbody = document.getElementById('dividends-rows');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).dividends;
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${accountName}" readonly /></td>
      <td><input type="number" step="0.01" data-field="ordinaryDividends" value="${formatInputValue(entry.ordinaryDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="qualifiedDividends" value="${formatInputValue(entry.qualifiedDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="capitalGainDistributions" value="${formatInputValue(entry.capitalGainDistributions)}" /></td>
      <td><input type="number" step="0.01" data-field="section199ADividends" value="${formatInputValue(entry.section199ADividends)}" /></td>
      <td><input type="number" step="0.01" data-field="foreignTaxPaid" value="${formatInputValue(entry.foreignTaxPaid)}" /></td>
      <td><input type="number" step="0.01" data-field="exemptInterestDividends" value="${formatInputValue(entry.exemptInterestDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="privateActivityBondInterestDividends" value="${formatInputValue(entry.privateActivityBondInterestDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="liquidationDistributions" value="${formatInputValue(entry.liquidationDistributions)}" /></td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof DivEntry;
        getAccountDetails(accountName).dividends[field] = readStoredNumber(input.value);
        updateDividendsTotals();
      });
    });

    tbody.appendChild(row);
  });
}

function renderMiscRows() {
  const tbody = document.getElementById('misc-rows');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  accounts.forEach((accountName) => {
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${accountName}" readonly /></td>
      <td><input type="number" step="0.01" value="${formatInputValue(getAccountDetails(accountName).miscIncome)}" /></td>
    `;

    row.querySelector<HTMLInputElement>('input[type="number"]')?.addEventListener('input', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      getAccountDetails(accountName).miscIncome = readStoredNumber(input.value);
      updateMiscTotal();
    });

    tbody.appendChild(row);
  });
}

function applyB1099RowState(row: HTMLTableRowElement, entry: B1099Entry) {
  const calculatedValue = calculateB1099Value(entry);
  const calculatedCell = row.querySelector<HTMLElement>('.calculated');
  if (calculatedCell) {
    calculatedCell.textContent = calculatedValue.toFixed(2);
  }

  if (Math.abs(calculatedValue - entry.gainLoss) > 0.01) {
    row.classList.add('mismatch');
  } else {
    row.classList.remove('mismatch');
  }
}

function renderB1099Rows(category: B1099Category) {
  const config = getB1099Config(category);
  const tbody = document.getElementById(`${config.tabId}-rows`);
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  accounts.forEach((accountName) => {
    const entry = getAccountDetails(accountName).b1099[category];
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${accountName}" readonly /></td>
      <td><input type="number" step="0.01" data-field="proceeds" value="${formatInputValue(entry.proceeds)}" /></td>
      <td><input type="number" step="0.01" data-field="costBasis" value="${formatInputValue(entry.costBasis)}" /></td>
      <td><input type="number" step="0.01" data-field="washSale" value="${formatInputValue(entry.washSale)}" /></td>
      <td><input type="number" step="0.01" data-field="gainLoss" value="${formatInputValue(entry.gainLoss)}" /></td>
      <td class="calculated">0.00</td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof B1099Entry;
        getAccountDetails(accountName).b1099[category][field] = readStoredNumber(input.value);
        applyB1099RowState(row, getAccountDetails(accountName).b1099[category]);
        updateB1099SummaryInputs();
      });
    });

    applyB1099RowState(row, entry);
    tbody.appendChild(row);
  });
}

function syncAccountTables() {
  syncStateWithAccounts();
  renderInterestRows();
  renderDividendsRows();
  renderMiscRows();
  b1099Configs.forEach((config) => renderB1099Rows(config.key));
  refreshEmptyStates();
  updateInterestTotals();
  updateDividendsTotals();
  updateMiscTotal();
  updateB1099SummaryInputs();
}

function renderAccounts() {
  accountsList.innerHTML = '';
  accounts.forEach((account, index) => {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.innerHTML = `
      <span>${account}</span>
      <button type="button" data-index="${index}">×</button>
    `;
    item.querySelector('button')?.addEventListener('click', () => removeAccount(index));
    accountsList.appendChild(item);
  });
}

function addAccount(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName || accounts.includes(trimmedName)) {
    return;
  }

  accounts.push(trimmedName);
  renderAccounts();
  syncAccountTables();
  newAccountInput.value = '';
}

function removeAccount(index: number) {
  const accountName = accounts[index];
  if (!accountName) {
    return;
  }

  accounts.splice(index, 1);
  renderAccounts();
  syncAccountTables();
}

addW2Btn.addEventListener('click', addW2Form);
addAccountBtn.addEventListener('click', () => addAccount(newAccountInput.value));
newAccountInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addAccount(newAccountInput.value);
  }
});

exportJsonBtn.addEventListener('click', () => {
  void exportSnapshot();
});
importJsonBtn.addEventListener('click', () => {
  void importSnapshot();
});

syncStateWithAccounts();
renderW2Forms();
renderAccounts();
syncAccountTables();

// Initial calculation
updateInterestTotals();
updateDividendsTotals();
updateMiscTotal();
updateB1099SummaryInputs();
updateW2SummaryInputs();
setDataStatus('Data is not auto-saved. Use Save/Open for persistence.');

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

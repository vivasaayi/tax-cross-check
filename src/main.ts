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
  includeWashSale: boolean;
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
  box1aOrdinaryDividends: number;
  box1bQualifiedDividends: number;
  box2aCapitalGainDistributions: number;
  box2bUnrecapturedSection1250Gain: number;
  box2cSection1202Gain: number;
  box2dCollectiblesGain: number;
  box2eSection897OrdinaryDividends: number;
  box2fSection897CapitalGain: number;
  box3NondividendDistributions: number;
  box4FederalIncomeTaxWithheld: number;
  box5Section199ADividends: number;
  box6InvestmentExpenses: number;
  box7ForeignTaxPaid: number;
  box8CashLiquidationDistributions: number;
  box9NoncashLiquidationDistributions: number;
  box10ExemptInterestDividends: number;
  box11SpecifiedPrivateActivityBondInterestDividends: number;
  box12StateTaxWithheld: number;
  box13StateIdentificationNumber: number;
};

type MiscEntry = {
  box2Royalties: number;
  box3OtherIncome: number;
  box4FederalIncomeTaxWithheld: number;
  box8SubstitutePayments: number;
};

type AccountDetails = {
  interest: IntEntry;
  dividends: DivEntry;
  misc: MiscEntry;
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
  box15State2: string;
  box15EmployerStateId2: string;
  box16StateWages2: number;
  box17StateIncomeTax2: number;
  box18LocalWages2: number;
  box19LocalIncomeTax2: number;
  box20LocalityName2: string;
};

type FormSettings = {
  taxYear: TaxYear;
  filingStatus: FilingStatus;
  residentState: StateCode;
};

type AccountRecord = {
  id: string;
  name: string;
  order: number;
};

type AppSnapshot = {
  version: 1;
  formSettings: FormSettings;
  w2Forms: W2Form[];
  accounts: AccountRecord[];
  accountDetails: Record<string, AccountDetails>;
};

type OpenSnapshotResult = {
  path: string;
  contents: string;
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
    <div id="startup-gate" class="startup-gate active">
      <section class="startup-card">
        <p class="eyebrow">Document Workflow</p>
        <h2>Open an existing tax file or start a new one</h2>
        <p class="lede">
          Work with one JSON file at a time. Open once, save repeatedly to the same file, or use Save As to create a copy.
        </p>
        <div class="startup-actions">
          <button type="button" id="startup-open-btn">Open File</button>
          <button type="button" id="startup-new-btn" class="secondary-button">New File</button>
        </div>
      </section>
    </div>

    <section class="hero">
      <div>
        <p class="eyebrow">Rust + Tauri</p>
        <h1>Tax Cross Check</h1>
        <p class="lede">
          A desktop calculator to cross-check federal tax and NJ or NY return numbers from your W-2s and 1099s.
        </p>
      </div>
    </section>

    <section class="document-bar panel">
      <div class="document-meta">
        <p class="eyebrow">Current File</p>
        <h2 id="document-name">No file open</h2>
        <p id="document-path" class="document-path">Choose Open File or New File to begin.</p>
      </div>
      <div class="document-actions">
        <button type="button" id="new-file-btn" class="secondary-button">New</button>
        <button type="button" id="open-file-btn" class="secondary-button">Open</button>
        <button type="button" id="save-file-btn">Save</button>
        <button type="button" id="save-as-file-btn" class="secondary-button">Save As</button>
      </div>
      <p id="data-status" class="microcopy">Open an existing file or create a new one.</p>
    </section>

    <div class="main-tabs">
      <button type="button" class="main-tab-button active" data-tab="calculator">Tax Calculator</button>
      <button type="button" class="main-tab-button" data-tab="w2">W-2</button>
      <button type="button" class="main-tab-button" data-tab="accounts">Accounts</button>
      <button type="button" class="main-tab-button" data-tab="interest">Interest</button>
      <button type="button" class="main-tab-button" data-tab="dividends">Dividends</button>
      <button type="button" class="main-tab-button" data-tab="misc">Misc Income</button>
      <button type="button" class="main-tab-button" data-tab="b1099">1099-B Details</button>
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
          <table class="b1099-table wide-table interest-table">
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
          <p>Capture 1099-DIV boxes by account through box 13. Boxes 1a and 1b feed the current estimate.</p>
        </div>

        <div class="table-scroll">
          <table class="b1099-table wide-table dividends-table">
            <thead>
              <tr>
                <th>Account Name</th>
                <th>Box 1a Ordinary Dividends</th>
                <th>Box 1b Qualified Dividends</th>
                <th>Box 2a Capital Gain Distributions</th>
                <th>Box 2b</th>
                <th>Box 2c</th>
                <th>Box 2d</th>
                <th>Box 2e</th>
                <th>Box 2f</th>
                <th>Box 3</th>
                <th>Box 4</th>
                <th>Box 5</th>
                <th>Box 6</th>
                <th>Box 7</th>
                <th>Box 8</th>
                <th>Box 9</th>
                <th>Box 10</th>
                <th>Box 11</th>
                <th>Box 12</th>
                <th>Box 13</th>
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
                <td class="sum" id="box-2b-dividends-total">0.00</td>
                <td class="sum" id="box-2c-dividends-total">0.00</td>
                <td class="sum" id="box-2d-dividends-total">0.00</td>
                <td class="sum" id="box-2e-dividends-total">0.00</td>
                <td class="sum" id="box-2f-dividends-total">0.00</td>
                <td class="sum" id="box-3-dividends-total">0.00</td>
                <td class="sum" id="box-4-dividends-total">0.00</td>
                <td class="sum" id="section-199a-dividends-total">0.00</td>
                <td class="sum" id="box-6-dividends-total">0.00</td>
                <td class="sum" id="dividends-foreign-tax-total">0.00</td>
                <td class="sum" id="box-8-dividends-total">0.00</td>
                <td class="sum" id="box-9-dividends-total">0.00</td>
                <td class="sum" id="exempt-interest-dividends-total">0.00</td>
                <td class="sum" id="private-activity-dividends-total">0.00</td>
                <td class="sum" id="box-12-dividends-total">0.00</td>
                <td class="sum" id="box-13-dividends-total">0.00</td>
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
          <p>Capture 1099-MISC boxes 2, 3, 4, and 8 by account. Boxes 2, 3, and 8 feed misc income, and box 4 adds to federal withholding.</p>
        </div>

        <table class="b1099-table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Box 2 Royalties</th>
              <th>Box 3 Other Income</th>
              <th>Box 4 Federal Income Tax Withheld</th>
              <th>Box 8 Substitute Payments</th>
            </tr>
          </thead>
          <tbody id="misc-rows">
            <!-- Rows will be added dynamically -->
          </tbody>
          <tfoot>
            <tr>
              <td><strong>Total</strong></td>
              <td class="sum" id="misc-box-2-total">0.00</td>
              <td class="sum" id="misc-box-3-total">0.00</td>
              <td class="sum" id="misc-box-4-total">0.00</td>
              <td class="sum" id="misc-box-8-total">0.00</td>
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
          <button type="button" class="tab-button" data-tab="b1099-summary">Summary by Account</button>
        </div>

        <div id="short-covered-tab" class="tab-content active">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Wash Sale (Add?)</th>
                  <th>Reported Gain/Loss</th>
                  <th>Calculated Gain/Loss</th>
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
                  <td class="sum" id="short-covered-calculated-sum">0.00</td>
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
                  <th>Wash Sale (Add?)</th>
                  <th>Reported Gain/Loss</th>
                  <th>Calculated Gain/Loss</th>
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
                  <td class="sum" id="short-noncovered-calculated-sum">0.00</td>
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
                  <th>Wash Sale (Add?)</th>
                  <th>Reported Gain/Loss</th>
                  <th>Calculated Gain/Loss</th>
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
                  <td class="sum" id="long-covered-calculated-sum">0.00</td>
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
                  <th>Wash Sale (Add?)</th>
                  <th>Reported Gain/Loss</th>
                  <th>Calculated Gain/Loss</th>
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
                  <td class="sum" id="long-noncovered-calculated-sum">0.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div id="b1099-summary-tab" class="tab-content">
          <div class="table-scroll">
            <table class="b1099-table wide-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Total Proceeds</th>
                  <th>Total Cost Basis</th>
                  <th>Total Wash Sale</th>
                  <th>Net Gain/Loss</th>
                </tr>
              </thead>
              <tbody id="b1099-account-summary-rows">
                <!-- Rows will be added dynamically -->
              </tbody>
              <tfoot>
                <tr>
                  <td><strong>Total</strong></td>
                  <td class="sum" id="b1099-account-summary-proceeds-sum">0.00</td>
                  <td class="sum" id="b1099-account-summary-cost-sum">0.00</td>
                  <td class="sum" id="b1099-account-summary-wash-sum">0.00</td>
                  <td class="sum" id="b1099-account-summary-gain-sum">0.00</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
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
  { tbodyId: "dividends-rows", colspan: 20, message: "Add accounts in the Accounts tab to enter 1099-DIV details." },
  { tbodyId: "misc-rows", colspan: 5, message: "Add accounts in the Accounts tab to enter 1099-MISC details." },
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

const roundMoney = (value: number): number => Math.round(value * 100) / 100;

const formatInputValue = (value: number): string => (Math.abs(value) < 0.005 ? "" : String(value));

const createEmptyB1099Entry = (): B1099Entry => ({
  proceeds: 0,
  costBasis: 0,
  washSale: 0,
  includeWashSale: false,
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
  box1aOrdinaryDividends: 0,
  box1bQualifiedDividends: 0,
  box2aCapitalGainDistributions: 0,
  box2bUnrecapturedSection1250Gain: 0,
  box2cSection1202Gain: 0,
  box2dCollectiblesGain: 0,
  box2eSection897OrdinaryDividends: 0,
  box2fSection897CapitalGain: 0,
  box3NondividendDistributions: 0,
  box4FederalIncomeTaxWithheld: 0,
  box5Section199ADividends: 0,
  box6InvestmentExpenses: 0,
  box7ForeignTaxPaid: 0,
  box8CashLiquidationDistributions: 0,
  box9NoncashLiquidationDistributions: 0,
  box10ExemptInterestDividends: 0,
  box11SpecifiedPrivateActivityBondInterestDividends: 0,
  box12StateTaxWithheld: 0,
  box13StateIdentificationNumber: 0,
});

const createEmptyMiscEntry = (): MiscEntry => ({
  box2Royalties: 0,
  box3OtherIncome: 0,
  box4FederalIncomeTaxWithheld: 0,
  box8SubstitutePayments: 0,
});

const createEmptyAccountDetails = (): AccountDetails => ({
  interest: createEmptyInterestEntry(),
  dividends: createEmptyDividendsEntry(),
  misc: createEmptyMiscEntry(),
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
  box15State2: "",
  box15EmployerStateId2: "",
  box16StateWages2: 0,
  box17StateIncomeTax2: 0,
  box18LocalWages2: 0,
  box19LocalIncomeTax2: 0,
  box20LocalityName2: "",
});

function normalizeB1099Entry(value: unknown): B1099Entry {
  const entry = (value ?? {}) as Partial<B1099Entry>;
  return {
    proceeds: readStoredNumber(entry.proceeds),
    costBasis: readStoredNumber(entry.costBasis),
    washSale: readStoredNumber(entry.washSale),
    gainLoss: readStoredNumber(entry.gainLoss),
    includeWashSale: typeof entry.includeWashSale === 'boolean' ? entry.includeWashSale : false,
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
    box1aOrdinaryDividends: readStoredNumber(entry.box1aOrdinaryDividends ?? (entry as Partial<Record<'ordinaryDividends', number>>).ordinaryDividends),
    box1bQualifiedDividends: readStoredNumber(entry.box1bQualifiedDividends ?? (entry as Partial<Record<'qualifiedDividends', number>>).qualifiedDividends),
    box2aCapitalGainDistributions: readStoredNumber(entry.box2aCapitalGainDistributions ?? (entry as Partial<Record<'capitalGainDistributions', number>>).capitalGainDistributions),
    box2bUnrecapturedSection1250Gain: readStoredNumber(entry.box2bUnrecapturedSection1250Gain),
    box2cSection1202Gain: readStoredNumber(entry.box2cSection1202Gain),
    box2dCollectiblesGain: readStoredNumber(entry.box2dCollectiblesGain),
    box2eSection897OrdinaryDividends: readStoredNumber(entry.box2eSection897OrdinaryDividends),
    box2fSection897CapitalGain: readStoredNumber(entry.box2fSection897CapitalGain),
    box3NondividendDistributions: readStoredNumber(entry.box3NondividendDistributions),
    box4FederalIncomeTaxWithheld: readStoredNumber(entry.box4FederalIncomeTaxWithheld),
    box5Section199ADividends: readStoredNumber(entry.box5Section199ADividends ?? (entry as Partial<Record<'section199ADividends', number>>).section199ADividends),
    box6InvestmentExpenses: readStoredNumber(entry.box6InvestmentExpenses),
    box7ForeignTaxPaid: readStoredNumber(entry.box7ForeignTaxPaid ?? (entry as Partial<Record<'foreignTaxPaid', number>>).foreignTaxPaid),
    box8CashLiquidationDistributions: readStoredNumber(entry.box8CashLiquidationDistributions ?? (entry as Partial<Record<'liquidationDistributions', number>>).liquidationDistributions),
    box9NoncashLiquidationDistributions: readStoredNumber(entry.box9NoncashLiquidationDistributions),
    box10ExemptInterestDividends: readStoredNumber(entry.box10ExemptInterestDividends ?? (entry as Partial<Record<'exemptInterestDividends', number>>).exemptInterestDividends),
    box11SpecifiedPrivateActivityBondInterestDividends: readStoredNumber(entry.box11SpecifiedPrivateActivityBondInterestDividends ?? (entry as Partial<Record<'privateActivityBondInterestDividends', number>>).privateActivityBondInterestDividends),
    box12StateTaxWithheld: readStoredNumber(entry.box12StateTaxWithheld),
    box13StateIdentificationNumber: readStoredNumber(entry.box13StateIdentificationNumber),
  };
}

function normalizeMiscEntry(value: unknown): MiscEntry {
  const entry = (value ?? {}) as Partial<MiscEntry>;
  return {
    box2Royalties: readStoredNumber(entry.box2Royalties),
    box3OtherIncome: readStoredNumber(entry.box3OtherIncome ?? (entry as Partial<Record<'miscIncome', number>>).miscIncome),
    box4FederalIncomeTaxWithheld: readStoredNumber(entry.box4FederalIncomeTaxWithheld),
    box8SubstitutePayments: readStoredNumber(entry.box8SubstitutePayments),
  };
}

function normalizeAccountDetails(value: unknown): AccountDetails {
  const entry = (value ?? {}) as Partial<AccountDetails> & {
    b1099?: Partial<AccountDetails["b1099"]>;
    miscIncome?: number;
  };
  return {
    interest: normalizeInterestEntry(entry.interest),
    dividends: normalizeDividendsEntry(entry.dividends),
    misc: normalizeMiscEntry(entry.misc ?? { miscIncome: entry.miscIncome }),
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
    box15State2: String(entry.box15State2 ?? ''),
    box15EmployerStateId2: String(entry.box15EmployerStateId2 ?? ''),
    box16StateWages2: readStoredNumber(entry.box16StateWages2),
    box17StateIncomeTax2: readStoredNumber(entry.box17StateIncomeTax2),
    box18LocalWages2: readStoredNumber(entry.box18LocalWages2),
    box19LocalIncomeTax2: readStoredNumber(entry.box19LocalIncomeTax2),
    box20LocalityName2: String(entry.box20LocalityName2 ?? ''),
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

function createAccountRecord(name: string, order: number): AccountRecord {
  return {
    id: crypto.randomUUID(),
    name,
    order,
  };
}

function normalizeAccountRecord(value: unknown, index: number): AccountRecord | null {
  if (typeof value === 'string') {
    const name = value.trim();
    return name ? createAccountRecord(name, index + 1) : null;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const account = value as Partial<AccountRecord>;
  const name = String(account.name ?? '').trim();
  if (!name) {
    return null;
  }

  const parsedOrder = Number(account.order ?? index + 1);
  return {
    id: typeof account.id === 'string' && account.id ? account.id : crypto.randomUUID(),
    name,
    order: Number.isFinite(parsedOrder) ? Math.max(1, Math.round(parsedOrder)) : index + 1,
  };
}

function sortAccounts(items: AccountRecord[]): AccountRecord[] {
  return [...items].sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.name.localeCompare(right.name);
  });
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
  const normalizedAccounts = Array.isArray(snapshot.accounts)
    ? snapshot.accounts
        .map((entry, index) => normalizeAccountRecord(entry, index))
        .filter((entry): entry is AccountRecord => entry !== null)
    : [];

  const rawAccountDetails = snapshot.accountDetails && typeof snapshot.accountDetails === 'object'
    ? snapshot.accountDetails
    : {};

  const normalizedAccountDetails = Object.fromEntries(
    normalizedAccounts.map((account) => {
      const byId = rawAccountDetails[account.id];
      const byLegacyName = rawAccountDetails[account.name];
      return [account.id, normalizeAccountDetails(byId ?? byLegacyName)];
    }),
  );

  return {
    version: 1,
    formSettings: {
      taxYear: String(snapshot.formSettings?.taxYear ?? 'y2024') as TaxYear,
      filingStatus: String(snapshot.formSettings?.filingStatus ?? 'single') as FilingStatus,
      residentState: String(snapshot.formSettings?.residentState ?? 'nj') as StateCode,
    },
    w2Forms: Array.isArray(snapshot.w2Forms) ? snapshot.w2Forms.map((entry) => normalizeW2Form(entry)) : [],
    accounts: sortAccounts(normalizedAccounts),
    accountDetails: normalizedAccountDetails,
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
  return roundMoney(entry.proceeds - entry.costBasis + (entry.includeWashSale ? Math.abs(entry.washSale) : 0));
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
const startupGate = document.getElementById('startup-gate') as HTMLDivElement;
const startupOpenBtn = document.getElementById('startup-open-btn') as HTMLButtonElement;
const startupNewBtn = document.getElementById('startup-new-btn') as HTMLButtonElement;
const newFileBtn = document.getElementById('new-file-btn') as HTMLButtonElement;
const openFileBtn = document.getElementById('open-file-btn') as HTMLButtonElement;
const saveFileBtn = document.getElementById('save-file-btn') as HTMLButtonElement;
const saveAsFileBtn = document.getElementById('save-as-file-btn') as HTMLButtonElement;
const documentName = document.getElementById('document-name') as HTMLHeadingElement;
const documentPath = document.getElementById('document-path') as HTMLParagraphElement;
const dataStatus = document.getElementById('data-status') as HTMLParagraphElement;

let w2Forms: W2Form[] = [];
let currentFilePath: string | null = null;
let hasUnsavedChanges = false;
let sessionStarted = false;

function buildEmptySnapshot(): AppSnapshot {
  return {
    version: 1,
    formSettings: {
      taxYear: 'y2024',
      filingStatus: 'single',
      residentState: 'nj',
    },
    w2Forms: [],
    accounts: [],
    accountDetails: {},
  };
}

function getFileName(filePath: string | null): string {
  if (!filePath) {
    return 'Untitled';
  }

  return filePath.split(/[/\\]/).pop() || filePath;
}

function updateDocumentChrome() {
  const baseName = sessionStarted ? getFileName(currentFilePath) : 'No file open';
  documentName.textContent = sessionStarted && hasUnsavedChanges ? `${baseName} *` : baseName;
  documentPath.textContent = !sessionStarted
    ? 'Choose Open File or New File to begin.'
    : currentFilePath ?? 'New unsaved file';
  saveFileBtn.disabled = !sessionStarted;
  saveAsFileBtn.disabled = !sessionStarted;
}

function markDirty() {
  if (!sessionStarted) {
    return;
  }

  hasUnsavedChanges = true;
  updateDocumentChrome();
}

function markSaved(savedPath?: string | null) {
  if (savedPath) {
    currentFilePath = savedPath;
  }

  hasUnsavedChanges = false;
  sessionStarted = true;
  startupGate.classList.remove('active');
  updateDocumentChrome();
}

function beginSession() {
  sessionStarted = true;
  startupGate.classList.remove('active');
  updateDocumentChrome();
}

function confirmDiscardChanges(actionLabel: string): boolean {
  if (!sessionStarted || !hasUnsavedChanges) {
    return true;
  }

  return window.confirm(`You have unsaved changes. ${actionLabel} and discard them?`);
}

function setDataStatus(message: string, isError = false) {
  dataStatus.textContent = message;
  dataStatus.classList.toggle('data-error', isError);
}

function updateW2SummaryInputs() {
  let wages = 0;
  let federalWithholding = 0;
  let stateWithholding = 0;
  let miscFederalWithholding = 0;
  const residentStateField = form!.elements.namedItem('residentState');
  const residentStateCode = String(residentStateField instanceof HTMLSelectElement ? residentStateField.value : '').toUpperCase();

  w2Forms.forEach((entry) => {
    wages += entry.box1Wages;
    federalWithholding += entry.box2FederalWithholding;

    if (entry.box15State.trim().toUpperCase() === residentStateCode) {
      stateWithholding += entry.box17StateIncomeTax;
    }

    if (entry.box15State2.trim().toUpperCase() === residentStateCode) {
      stateWithholding += entry.box17StateIncomeTax2;
    }
  });

  getSortedAccounts().forEach((account) => {
    miscFederalWithholding += getAccountDetails(account.id).misc.box4FederalIncomeTaxWithheld;
  });

  setTextContent('w2-wages-total', wages);
  setTextContent('w2-federal-total', federalWithholding);
  setTextContent('w2-state-total', stateWithholding);
  wagesInput!.value = wages.toFixed(2);
  federalWithholdingInput!.value = (federalWithholding + miscFederalWithholding).toFixed(2);
  stateWithholdingInput!.value = stateWithholding.toFixed(2);
}

function removeW2Form(id: string) {
  w2Forms = w2Forms.filter((entry) => entry.id !== id);
  renderW2Forms();
  updateW2SummaryInputs();
  markDirty();
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
        <label><span>Box 15 state line 1</span><input type="text" data-string-field="box15State" value="${entry.box15State}" /></label>
        <label><span>Box 15 employer state ID line 1</span><input type="text" data-string-field="box15EmployerStateId" value="${entry.box15EmployerStateId}" /></label>
        <label><span>Box 16 state wages line 1</span><input type="number" step="0.01" data-number-field="box16StateWages" value="${formatInputValue(entry.box16StateWages)}" /></label>
        <label><span>Box 17 state income tax line 1</span><input type="number" step="0.01" data-number-field="box17StateIncomeTax" value="${formatInputValue(entry.box17StateIncomeTax)}" /></label>
        <label><span>Box 18 local wages line 1</span><input type="number" step="0.01" data-number-field="box18LocalWages" value="${formatInputValue(entry.box18LocalWages)}" /></label>
        <label><span>Box 19 local income tax line 1</span><input type="number" step="0.01" data-number-field="box19LocalIncomeTax" value="${formatInputValue(entry.box19LocalIncomeTax)}" /></label>
        <label><span>Box 20 locality name line 1</span><input type="text" data-string-field="box20LocalityName" value="${entry.box20LocalityName}" /></label>

        <label><span>Box 15 state line 2</span><input type="text" data-string-field="box15State2" value="${entry.box15State2}" /></label>
        <label><span>Box 15 employer state ID line 2</span><input type="text" data-string-field="box15EmployerStateId2" value="${entry.box15EmployerStateId2}" /></label>
        <label><span>Box 16 state wages line 2</span><input type="number" step="0.01" data-number-field="box16StateWages2" value="${formatInputValue(entry.box16StateWages2)}" /></label>
        <label><span>Box 17 state income tax line 2</span><input type="number" step="0.01" data-number-field="box17StateIncomeTax2" value="${formatInputValue(entry.box17StateIncomeTax2)}" /></label>
        <label><span>Box 18 local wages line 2</span><input type="number" step="0.01" data-number-field="box18LocalWages2" value="${formatInputValue(entry.box18LocalWages2)}" /></label>
        <label><span>Box 19 local income tax line 2</span><input type="number" step="0.01" data-number-field="box19LocalIncomeTax2" value="${formatInputValue(entry.box19LocalIncomeTax2)}" /></label>
        <label><span>Box 20 locality name line 2</span><input type="text" data-string-field="box20LocalityName2" value="${entry.box20LocalityName2}" /></label>
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
        markDirty();
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
        markDirty();
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
        markDirty();
      });
    });

    w2FormsContainer.appendChild(card);
  });
}

function addW2Form() {
  w2Forms.push(createEmptyW2Form());
  renderW2Forms();
  updateW2SummaryInputs();
  markDirty();
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

async function saveSnapshotAs() {
  try {
    const suggestedFileName = currentFilePath
      ? getFileName(currentFilePath)
      : `tax-cross-check-${new Date().toISOString().slice(0, 10)}.json`;
    const savedPath = await invoke<string | null>('save_export_json', {
      contents: JSON.stringify(buildSnapshot(), null, 2),
      suggestedFileName,
      currentFilePath,
    });

    if (!savedPath) {
      setDataStatus('Save As canceled.');
      return;
    }

    markSaved(savedPath);
    setDataStatus(`Saved ${getFileName(savedPath)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDataStatus(`Unable to save file: ${message}`, true);
  }
}

async function saveSnapshot() {
  try {
    if (!currentFilePath) {
      await saveSnapshotAs();
      return;
    }

    const savedPath = await invoke<string>('save_snapshot_to_path', {
      path: currentFilePath,
      contents: JSON.stringify(buildSnapshot(), null, 2),
    });

    markSaved(savedPath);
    setDataStatus(`Saved ${getFileName(savedPath)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDataStatus(`Unable to save file: ${message}`, true);
  }
}

async function openSnapshot() {
  try {
    const result = await invoke<OpenSnapshotResult | null>('open_import_json');
    if (!result) {
      setDataStatus('Open canceled.');
      return;
    }

    const parsed = JSON.parse(result.contents);
    const snapshot = normalizeSnapshot(parsed);
    applySnapshot(snapshot);
    currentFilePath = result.path;
    hasUnsavedChanges = false;
    beginSession();
    setDataStatus(`Opened ${getFileName(result.path)}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDataStatus(`Unable to open file: ${message}`, true);
  }
}

function newSnapshot() {
  applySnapshot(buildEmptySnapshot());
  currentFilePath = null;
  hasUnsavedChanges = false;
  beginSession();
  setDataStatus('Started a new file. Use Save to choose where it lives.');
}

// Account management
const accountsList = document.getElementById('accounts-list') as HTMLElement;
const newAccountInput = document.getElementById('new-account-name') as HTMLInputElement;
const addAccountBtn = document.getElementById('add-account-btn') as HTMLButtonElement;

let accounts: AccountRecord[] = [];
let accountDetails: Record<string, AccountDetails> = {};

function getSortedAccounts(): AccountRecord[] {
  return sortAccounts(accounts);
}

function getNextAccountOrder(): number {
  return accounts.reduce((maxOrder, account) => Math.max(maxOrder, account.order), 0) + 1;
}

function syncStateWithAccounts() {
  const nextDetails: Record<string, AccountDetails> = {};

  accounts.forEach((account) => {
    nextDetails[account.id] = accountDetails[account.id]
      ? normalizeAccountDetails(accountDetails[account.id])
      : createEmptyAccountDetails();
  });

  accountDetails = nextDetails;
}

function getAccountDetails(accountId: string): AccountDetails {
  if (!accountDetails[accountId]) {
    accountDetails[accountId] = createEmptyAccountDetails();
  }

  return accountDetails[accountId];
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

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).interest;
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
  let box2b = 0;
  let box2c = 0;
  let box2d = 0;
  let box2e = 0;
  let box2f = 0;
  let box3 = 0;
  let box4 = 0;
  let section199A = 0;
  let box6 = 0;
  let foreignTax = 0;
  let box8 = 0;
  let box9 = 0;
  let exemptInterest = 0;
  let privateActivity = 0;
  let box12 = 0;
  let box13 = 0;

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).dividends;
    ordinary += entry.box1aOrdinaryDividends;
    qualified += entry.box1bQualifiedDividends;
    capitalGain += entry.box2aCapitalGainDistributions;
    box2b += entry.box2bUnrecapturedSection1250Gain;
    box2c += entry.box2cSection1202Gain;
    box2d += entry.box2dCollectiblesGain;
    box2e += entry.box2eSection897OrdinaryDividends;
    box2f += entry.box2fSection897CapitalGain;
    box3 += entry.box3NondividendDistributions;
    box4 += entry.box4FederalIncomeTaxWithheld;
    section199A += entry.box5Section199ADividends;
    box6 += entry.box6InvestmentExpenses;
    foreignTax += entry.box7ForeignTaxPaid;
    box8 += entry.box8CashLiquidationDistributions;
    box9 += entry.box9NoncashLiquidationDistributions;
    exemptInterest += entry.box10ExemptInterestDividends;
    privateActivity += entry.box11SpecifiedPrivateActivityBondInterestDividends;
    box12 += entry.box12StateTaxWithheld;
    box13 += entry.box13StateIdentificationNumber;
  });

  setTextContent('ordinary-dividends-total', ordinary);
  setTextContent('qualified-dividends-total', qualified);
  setTextContent('capital-gain-distributions-total', capitalGain);
  setTextContent('box-2b-dividends-total', box2b);
  setTextContent('box-2c-dividends-total', box2c);
  setTextContent('box-2d-dividends-total', box2d);
  setTextContent('box-2e-dividends-total', box2e);
  setTextContent('box-2f-dividends-total', box2f);
  setTextContent('box-3-dividends-total', box3);
  setTextContent('box-4-dividends-total', box4);
  setTextContent('section-199a-dividends-total', section199A);
  setTextContent('box-6-dividends-total', box6);
  setTextContent('dividends-foreign-tax-total', foreignTax);
  setTextContent('box-8-dividends-total', box8);
  setTextContent('box-9-dividends-total', box9);
  setTextContent('exempt-interest-dividends-total', exemptInterest);
  setTextContent('private-activity-dividends-total', privateActivity);
  setTextContent('box-12-dividends-total', box12);
  setTextContent('box-13-dividends-total', box13);
  ordinaryDividendsInput!.value = ordinary.toFixed(2);
  qualifiedDividendsInput!.value = qualified.toFixed(2);
}

function updateMiscTotal() {
  let box2 = 0;
  let box3 = 0;
  let box4 = 0;
  let box8 = 0;

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).misc;
    box2 += entry.box2Royalties;
    box3 += entry.box3OtherIncome;
    box4 += entry.box4FederalIncomeTaxWithheld;
    box8 += entry.box8SubstitutePayments;
  });

  setTextContent('misc-box-2-total', box2);
  setTextContent('misc-box-3-total', box3);
  setTextContent('misc-box-4-total', box4);
  setTextContent('misc-box-8-total', box8);
  miscIncomeInput!.value = (box2 + box3 + box8).toFixed(2);

  let w2FederalWithholding = 0;
  w2Forms.forEach((entry) => {
    w2FederalWithholding += entry.box2FederalWithholding;
  });
  federalWithholdingInput!.value = (w2FederalWithholding + box4).toFixed(2);
}

function updateB1099CategoryTotals(category: B1099Category) {
  const config = getB1099Config(category);
  let proceeds = 0;
  let costBasis = 0;
  let washSale = 0;
  let gainLoss = 0;
  let calculatedGainLoss = 0;

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).b1099[category];
    proceeds += entry.proceeds;
    costBasis += entry.costBasis;
    washSale += entry.washSale;
    gainLoss += entry.gainLoss;
    calculatedGainLoss += calculateB1099Value(entry);
  });

  setTextContent(`${config.tabId}-proceeds-sum`, proceeds);
  setTextContent(`${config.tabId}-cost-sum`, costBasis);
  setTextContent(`${config.tabId}-wash-sum`, washSale);
  setTextContent(`${config.tabId}-gain-sum`, gainLoss);
  setTextContent(`${config.tabId}-calculated-sum`, calculatedGainLoss);
}

function updateB1099SummaryInputs() {
  let shortTermTotal = 0;
  let longTermTotal = 0;

  b1099Configs.forEach((config) => {
    let categoryTotal = 0;
    getSortedAccounts().forEach((account) => {
      categoryTotal += calculateB1099Value(getAccountDetails(account.id).b1099[config.key]);
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
  
  renderB1099AccountSummary();
}

function renderB1099AccountSummary() {
  const tbody = document.getElementById('b1099-account-summary-rows');
  if (!tbody) return;

  tbody.innerHTML = '';
  
  let grandProceeds = 0;
  let grandCostBasis = 0;
  let grandWashSale = 0;
  let grandGainLoss = 0;

  getSortedAccounts().forEach((account) => {
    const b1099 = getAccountDetails(account.id).b1099;
    let accountProceeds = 0;
    let accountCostBasis = 0;
    let accountWashSale = 0;
    let accountGainLoss = 0;

    b1099Configs.forEach((config) => {
      const entry = b1099[config.key];
      accountProceeds += entry.proceeds;
      accountCostBasis += entry.costBasis;
      accountWashSale += entry.washSale;
      accountGainLoss += calculateB1099Value(entry);
    });
    
    grandProceeds += accountProceeds;
    grandCostBasis += accountCostBasis;
    grandWashSale += accountWashSale;
    grandGainLoss += accountGainLoss;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${account.name}</td>
      <td>${accountProceeds.toFixed(2)}</td>
      <td>${accountCostBasis.toFixed(2)}</td>
      <td>${accountWashSale.toFixed(2)}</td>
      <td class="calculated">${accountGainLoss.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });

  setTextContent('b1099-account-summary-proceeds-sum', grandProceeds);
  setTextContent('b1099-account-summary-cost-sum', grandCostBasis);
  setTextContent('b1099-account-summary-wash-sum', grandWashSale);
  setTextContent('b1099-account-summary-gain-sum', grandGainLoss);
}

function renderInterestRows() {
  const tbody = document.getElementById('interest-rows');
  if (!tbody) {
    return;
  }

  tbody.innerHTML = '';

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).interest;
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${account.name}" readonly /></td>
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
        getAccountDetails(account.id).interest[field] = readStoredNumber(input.value);
        updateInterestTotals();
        markDirty();
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

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).dividends;
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${account.name}" readonly /></td>
      <td><input type="number" step="0.01" data-field="box1aOrdinaryDividends" value="${formatInputValue(entry.box1aOrdinaryDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box1bQualifiedDividends" value="${formatInputValue(entry.box1bQualifiedDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box2aCapitalGainDistributions" value="${formatInputValue(entry.box2aCapitalGainDistributions)}" /></td>
      <td><input type="number" step="0.01" data-field="box2bUnrecapturedSection1250Gain" value="${formatInputValue(entry.box2bUnrecapturedSection1250Gain)}" /></td>
      <td><input type="number" step="0.01" data-field="box2cSection1202Gain" value="${formatInputValue(entry.box2cSection1202Gain)}" /></td>
      <td><input type="number" step="0.01" data-field="box2dCollectiblesGain" value="${formatInputValue(entry.box2dCollectiblesGain)}" /></td>
      <td><input type="number" step="0.01" data-field="box2eSection897OrdinaryDividends" value="${formatInputValue(entry.box2eSection897OrdinaryDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box2fSection897CapitalGain" value="${formatInputValue(entry.box2fSection897CapitalGain)}" /></td>
      <td><input type="number" step="0.01" data-field="box3NondividendDistributions" value="${formatInputValue(entry.box3NondividendDistributions)}" /></td>
      <td><input type="number" step="0.01" data-field="box4FederalIncomeTaxWithheld" value="${formatInputValue(entry.box4FederalIncomeTaxWithheld)}" /></td>
      <td><input type="number" step="0.01" data-field="box5Section199ADividends" value="${formatInputValue(entry.box5Section199ADividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box6InvestmentExpenses" value="${formatInputValue(entry.box6InvestmentExpenses)}" /></td>
      <td><input type="number" step="0.01" data-field="box7ForeignTaxPaid" value="${formatInputValue(entry.box7ForeignTaxPaid)}" /></td>
      <td><input type="number" step="0.01" data-field="box8CashLiquidationDistributions" value="${formatInputValue(entry.box8CashLiquidationDistributions)}" /></td>
      <td><input type="number" step="0.01" data-field="box9NoncashLiquidationDistributions" value="${formatInputValue(entry.box9NoncashLiquidationDistributions)}" /></td>
      <td><input type="number" step="0.01" data-field="box10ExemptInterestDividends" value="${formatInputValue(entry.box10ExemptInterestDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box11SpecifiedPrivateActivityBondInterestDividends" value="${formatInputValue(entry.box11SpecifiedPrivateActivityBondInterestDividends)}" /></td>
      <td><input type="number" step="0.01" data-field="box12StateTaxWithheld" value="${formatInputValue(entry.box12StateTaxWithheld)}" /></td>
      <td><input type="number" step="0.01" data-field="box13StateIdentificationNumber" value="${formatInputValue(entry.box13StateIdentificationNumber)}" /></td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof DivEntry;
        getAccountDetails(account.id).dividends[field] = readStoredNumber(input.value);
        updateDividendsTotals();
        markDirty();
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

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).misc;
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${account.name}" readonly /></td>
      <td><input type="number" step="0.01" data-field="box2Royalties" value="${formatInputValue(entry.box2Royalties)}" /></td>
      <td><input type="number" step="0.01" data-field="box3OtherIncome" value="${formatInputValue(entry.box3OtherIncome)}" /></td>
      <td><input type="number" step="0.01" data-field="box4FederalIncomeTaxWithheld" value="${formatInputValue(entry.box4FederalIncomeTaxWithheld)}" /></td>
      <td><input type="number" step="0.01" data-field="box8SubstitutePayments" value="${formatInputValue(entry.box8SubstitutePayments)}" /></td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof MiscEntry;
        getAccountDetails(account.id).misc[field] = readStoredNumber(input.value);
        updateMiscTotal();
        markDirty();
      });
    });

    tbody.appendChild(row);
  });
}

function applyB1099RowState(row: HTMLTableRowElement, entry: B1099Entry) {
  const reportedValue = entry.gainLoss;
  const calculatedValue = calculateB1099Value(entry);
  const calculatedCell = row.querySelector<HTMLElement>('.calculated');
  if (calculatedCell) {
    calculatedCell.textContent = calculatedValue.toFixed(2);
  }

  const reportedDisplayValue = reportedValue.toFixed(2);
  const calculatedDisplayValue = calculatedValue.toFixed(2);

  if (reportedDisplayValue !== calculatedDisplayValue) {
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

  getSortedAccounts().forEach((account) => {
    const entry = getAccountDetails(account.id).b1099[category];
    const row = document.createElement('tr');
    row.className = 'data-row';
    row.innerHTML = `
      <td><input type="text" value="${account.name}" readonly /></td>
      <td><input type="number" step="0.01" data-field="proceeds" value="${formatInputValue(entry.proceeds)}" /></td>
      <td><input type="number" step="0.01" data-field="costBasis" value="${formatInputValue(entry.costBasis)}" /></td>
      <td>
        <div style="display: flex; align-items: center; gap: 4px;">
          <input type="checkbox" data-checkbox-field="includeWashSale" ${entry.includeWashSale ? 'checked' : ''} title="Include Wash Sale in Calculation?" style="margin:0; cursor:pointer;" />
          <input type="number" step="0.01" data-field="washSale" value="${formatInputValue(entry.washSale)}" style="flex: 1;" />
        </div>
      </td>
      <td><input type="number" step="0.01" data-field="gainLoss" value="${formatInputValue(entry.gainLoss)}" /></td>
      <td class="calculated">0.00</td>
    `;

    row.querySelectorAll<HTMLInputElement>('input[data-field]').forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.dataset.field as keyof B1099Entry;
        (getAccountDetails(account.id).b1099[category][field] as number) = readStoredNumber(input.value);
        applyB1099RowState(row, getAccountDetails(account.id).b1099[category]);
        updateB1099SummaryInputs();
        markDirty();
      });
    });

    row.querySelectorAll<HTMLInputElement>('input[data-checkbox-field]').forEach((input) => {
      input.addEventListener('change', () => {
        const field = input.dataset.checkboxField as keyof B1099Entry;
        (getAccountDetails(account.id).b1099[category][field] as boolean) = input.checked;
        applyB1099RowState(row, getAccountDetails(account.id).b1099[category]);
        updateB1099SummaryInputs();
        markDirty();
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
  getSortedAccounts().forEach((account) => {
    const item = document.createElement('div');
    item.className = 'account-item';
    item.innerHTML = `
      <div class="account-item-fields">
        <label>
          <span>Order</span>
          <input type="number" min="1" step="1" value="${account.order}" data-account-order="${account.id}" />
        </label>
        <label class="account-name-field">
          <span>Account Name</span>
          <input type="text" value="${account.name}" data-account-name="${account.id}" />
        </label>
      </div>
      <button type="button" data-account-remove="${account.id}">×</button>
    `;

    item.querySelector<HTMLInputElement>(`input[data-account-order="${account.id}"]`)?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const target = accounts.find((entry) => entry.id === account.id);
      if (!target) {
        return;
      }

      const parsedOrder = Number(input.value);
      target.order = Number.isFinite(parsedOrder) ? Math.max(1, Math.round(parsedOrder)) : target.order;
      renderAccounts();
      syncAccountTables();
      markDirty();
    });

    item.querySelector<HTMLInputElement>(`input[data-account-name="${account.id}"]`)?.addEventListener('change', (event) => {
      const input = event.currentTarget as HTMLInputElement;
      const target = accounts.find((entry) => entry.id === account.id);
      if (!target) {
        return;
      }

      const trimmedName = input.value.trim();
      if (!trimmedName) {
        input.value = target.name;
        return;
      }

      target.name = trimmedName;
      renderAccounts();
      syncAccountTables();
      markDirty();
    });

    item.querySelector<HTMLButtonElement>(`button[data-account-remove="${account.id}"]`)?.addEventListener('click', () => removeAccount(account.id));
    accountsList.appendChild(item);
  });
}

function addAccount(name: string) {
  const trimmedName = name.trim();
  if (!trimmedName || accounts.some((account) => account.name === trimmedName)) {
    return;
  }

  accounts.push(createAccountRecord(trimmedName, getNextAccountOrder()));
  renderAccounts();
  syncAccountTables();
  newAccountInput.value = '';
  markDirty();
}

function removeAccount(accountId: string) {
  const nextAccounts = accounts.filter((account) => account.id !== accountId);
  if (nextAccounts.length === accounts.length) {
    return;
  }

  accounts = nextAccounts;
  renderAccounts();
  syncAccountTables();
  markDirty();
}

addW2Btn.addEventListener('click', addW2Form);
addAccountBtn.addEventListener('click', () => addAccount(newAccountInput.value));
newAccountInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addAccount(newAccountInput.value);
  }
});

startupNewBtn.addEventListener('click', () => {
  newSnapshot();
});
startupOpenBtn.addEventListener('click', () => {
  void openSnapshot();
});
newFileBtn.addEventListener('click', () => {
  if (!confirmDiscardChanges('Create a new file')) {
    return;
  }

  newSnapshot();
});
openFileBtn.addEventListener('click', () => {
  if (!confirmDiscardChanges('Open another file')) {
    return;
  }

  void openSnapshot();
});
saveFileBtn.addEventListener('click', () => {
  void saveSnapshot();
});
saveAsFileBtn.addEventListener('click', () => {
  void saveSnapshotAs();
});

['taxYear', 'filingStatus', 'residentState'].forEach((name) => {
  const element = form.elements.namedItem(name);
  if (element instanceof HTMLSelectElement) {
    element.addEventListener('change', () => {
      if (name === 'residentState') {
        updateW2SummaryInputs();
      }
      markDirty();
    });
  }
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
updateDocumentChrome();
setDataStatus('Open an existing file or create a new one to start working.');

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

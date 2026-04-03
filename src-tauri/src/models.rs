use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum TaxYear {
    Y2024,
    Y2025,
}

impl TaxYear {
    pub fn label(self) -> &'static str {
        match self {
            Self::Y2024 => "2024",
            Self::Y2025 => "2025",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FilingStatus {
    Single,
    MarriedFilingJointly,
    MarriedFilingSeparately,
    HeadOfHousehold,
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize, Eq, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum StateCode {
    Nj,
    Ny,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxCalculationInput {
    pub tax_year: TaxYear,
    pub filing_status: FilingStatus,
    pub resident_state: StateCode,
    pub wages: f64,
    pub federal_withholding: f64,
    pub state_withholding: f64,
    pub taxable_interest: f64,
    pub ordinary_dividends: f64,
    pub qualified_dividends: f64,
    pub misc_income: f64,
    pub short_term_gains: f64,
    pub long_term_gains: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IncomeSummary {
    pub total_income: f64,
    pub agi: f64,
    pub standard_deduction: f64,
    pub taxable_income: f64,
    pub preferred_income: f64,
    pub ordinary_taxable_income: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxBreakdown {
    pub tax: f64,
    pub taxable_income: f64,
    pub withholding: f64,
    pub refund_or_due: f64,
    pub effective_rate: f64,
    pub marginal_rate: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CombinedSummary {
    pub total_tax: f64,
    pub total_withholding: f64,
    pub net_refund_or_due: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxCalculationResult {
    pub year_label: String,
    pub income: IncomeSummary,
    pub federal: TaxBreakdown,
    pub state: TaxBreakdown,
    pub combined: CombinedSummary,
    pub assumptions: Vec<String>,
}

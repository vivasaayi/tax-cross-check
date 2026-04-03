use crate::models::{FilingStatus, TaxCalculationInput};

use super::super::{marginal_rate, progressive_tax, ComputedTax};

pub fn calculate(input: &TaxCalculationInput, agi: f64) -> ComputedTax {
    let taxable_income = agi.max(0.0);
    let brackets = brackets(input.filing_status);

    ComputedTax {
        tax: progressive_tax(taxable_income, brackets),
        taxable_income,
        marginal_rate: marginal_rate(taxable_income, brackets),
    }
}

fn brackets(status: FilingStatus) -> &'static [(f64, f64)] {
    match status {
        FilingStatus::MarriedFilingJointly => &[
            (20_000.0, 0.014),
            (50_000.0, 0.0175),
            (70_000.0, 0.0245),
            (80_000.0, 0.035),
            (150_000.0, 0.05525),
            (500_000.0, 0.0637),
            (1_000_000.0, 0.0897),
            (f64::INFINITY, 0.1075),
        ],
        FilingStatus::Single | FilingStatus::MarriedFilingSeparately | FilingStatus::HeadOfHousehold => &[
            (20_000.0, 0.014),
            (35_000.0, 0.0175),
            (40_000.0, 0.035),
            (75_000.0, 0.05525),
            (500_000.0, 0.0637),
            (1_000_000.0, 0.0897),
            (f64::INFINITY, 0.1075),
        ],
    }
}

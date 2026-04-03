use crate::models::{FilingStatus, TaxCalculationInput};

use super::super::{marginal_rate, progressive_tax, ComputedTax};

pub fn calculate(input: &TaxCalculationInput, agi: f64) -> ComputedTax {
    let standard_deduction = standard_deduction(input.filing_status);
    let taxable_income = (agi - standard_deduction).max(0.0);
    let brackets = brackets(input.filing_status);

    ComputedTax {
        tax: progressive_tax(taxable_income, brackets),
        taxable_income,
        marginal_rate: marginal_rate(taxable_income, brackets),
    }
}

fn standard_deduction(status: FilingStatus) -> f64 {
    match status {
        FilingStatus::Single | FilingStatus::MarriedFilingSeparately => 8_000.0,
        FilingStatus::MarriedFilingJointly => 16_050.0,
        FilingStatus::HeadOfHousehold => 11_200.0,
    }
}

fn brackets(status: FilingStatus) -> &'static [(f64, f64)] {
    match status {
        FilingStatus::Single | FilingStatus::MarriedFilingSeparately => &[
            (8_500.0, 0.04),
            (11_700.0, 0.045),
            (13_900.0, 0.0525),
            (21_400.0, 0.055),
            (80_650.0, 0.06),
            (215_400.0, 0.0685),
            (1_077_550.0, 0.0965),
            (5_000_000.0, 0.103),
            (25_000_000.0, 0.109),
            (f64::INFINITY, 0.109),
        ],
        FilingStatus::MarriedFilingJointly => &[
            (17_150.0, 0.04),
            (23_600.0, 0.045),
            (27_900.0, 0.0525),
            (43_000.0, 0.055),
            (161_550.0, 0.06),
            (323_200.0, 0.0685),
            (2_155_350.0, 0.0965),
            (5_000_000.0, 0.103),
            (25_000_000.0, 0.109),
            (f64::INFINITY, 0.109),
        ],
        FilingStatus::HeadOfHousehold => &[
            (12_800.0, 0.04),
            (17_650.0, 0.045),
            (20_900.0, 0.0525),
            (32_200.0, 0.055),
            (107_650.0, 0.06),
            (269_300.0, 0.0685),
            (1_616_450.0, 0.0965),
            (5_000_000.0, 0.103),
            (25_000_000.0, 0.109),
            (f64::INFINITY, 0.109),
        ],
    }
}

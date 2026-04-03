use crate::models::TaxCalculationInput;

use super::{marginal_rate, progressive_tax, years, FederalComputedTax};

pub fn calculate(
    input: &TaxCalculationInput,
    agi: f64,
    preferred_dividends: f64,
) -> FederalComputedTax {
    let standard_deduction = years::federal_standard_deduction(input.tax_year, input.filing_status);
    let taxable_income = (agi - standard_deduction).max(0.0);
    let preferred_income = (preferred_dividends + input.long_term_gains.max(0.0)).min(taxable_income);
    let ordinary_taxable_income = (taxable_income - preferred_income).max(0.0);
    let ordinary_brackets = years::federal_ordinary_brackets(input.tax_year, input.filing_status);

    let ordinary_tax = progressive_tax(ordinary_taxable_income, ordinary_brackets);
    let preferential_tax = preferential_tax(
        ordinary_taxable_income,
        preferred_income,
        years::federal_capital_gain_bands(input.tax_year, input.filing_status),
    );

    FederalComputedTax {
        tax: ordinary_tax + preferential_tax,
        taxable_income,
        standard_deduction,
        preferred_income,
        ordinary_taxable_income,
        marginal_rate: if preferred_income > 0.0 && ordinary_taxable_income == 0.0 {
            capital_gains_marginal_rate(
                ordinary_taxable_income,
                preferred_income,
                years::federal_capital_gain_bands(input.tax_year, input.filing_status),
            )
        } else {
            marginal_rate(ordinary_taxable_income, ordinary_brackets)
        },
    }
}

fn preferential_tax(ordinary_taxable_income: f64, preferred_income: f64, bands: (f64, f64)) -> f64 {
    if preferred_income <= 0.0 {
        return 0.0;
    }

    let zero_band_top = bands.0;
    let fifteen_band_top = bands.1;

    let zero_room = (zero_band_top - ordinary_taxable_income).max(0.0);
    let taxed_at_zero = preferred_income.min(zero_room);

    let remaining_after_zero = (preferred_income - taxed_at_zero).max(0.0);
    let fifteen_room = (fifteen_band_top - ordinary_taxable_income.max(zero_band_top)).max(0.0);
    let taxed_at_fifteen = remaining_after_zero.min(fifteen_room);
    let taxed_at_twenty = (remaining_after_zero - taxed_at_fifteen).max(0.0);

    taxed_at_fifteen * 0.15 + taxed_at_twenty * 0.20
}

fn capital_gains_marginal_rate(ordinary_taxable_income: f64, preferred_income: f64, bands: (f64, f64)) -> f64 {
    if preferred_income <= 0.0 {
        return 0.0;
    }

    let total_taxable = ordinary_taxable_income + preferred_income;
    if total_taxable <= bands.0 {
        0.0
    } else if total_taxable <= bands.1 {
        0.15
    } else {
        0.20
    }
}

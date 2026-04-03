pub mod federal;
pub mod states;
pub mod years;

use crate::models::{
    CombinedSummary, IncomeSummary, StateCode, TaxBreakdown, TaxCalculationInput,
    TaxCalculationResult,
};

pub fn calculate(input: &TaxCalculationInput) -> Result<TaxCalculationResult, String> {
    if input.qualified_dividends < 0.0 {
        return Err("Qualified dividends cannot be negative in this simplified model.".into());
    }

    if input.federal_withholding < 0.0 || input.state_withholding < 0.0 {
        return Err("Withholding values cannot be negative.".into());
    }

    let preferred_dividends = input.qualified_dividends.min(input.ordinary_dividends.max(0.0));
    let total_income = input.wages
        + input.taxable_interest
        + input.ordinary_dividends
        + input.misc_income
        + input.short_term_gains
        + input.long_term_gains;
    let agi = total_income;

    let federal_result = federal::calculate(input, agi, preferred_dividends);
    let state_result = match input.resident_state {
        StateCode::Nj => states::nj::calculate(input, agi),
        StateCode::Ny => states::ny::calculate(input, agi),
    };

    let income = IncomeSummary {
        total_income: round_money(total_income),
        agi: round_money(agi),
        standard_deduction: round_money(federal_result.standard_deduction),
        taxable_income: round_money(federal_result.taxable_income),
        preferred_income: round_money(federal_result.preferred_income),
        ordinary_taxable_income: round_money(federal_result.ordinary_taxable_income),
    };

    let federal = TaxBreakdown {
        tax: round_money(federal_result.tax),
        taxable_income: round_money(federal_result.taxable_income),
        withholding: round_money(input.federal_withholding),
        refund_or_due: round_money(input.federal_withholding - federal_result.tax),
        effective_rate: ratio(federal_result.tax, agi),
        marginal_rate: federal_result.marginal_rate,
    };

    let state = TaxBreakdown {
        tax: round_money(state_result.tax),
        taxable_income: round_money(state_result.taxable_income),
        withholding: round_money(input.state_withholding),
        refund_or_due: round_money(input.state_withholding - state_result.tax),
        effective_rate: ratio(state_result.tax, agi),
        marginal_rate: state_result.marginal_rate,
    };

    let total_tax = federal_result.tax + state_result.tax;
    let total_withholding = input.federal_withholding + input.state_withholding;

    let combined = CombinedSummary {
        total_tax: round_money(total_tax),
        total_withholding: round_money(total_withholding),
        net_refund_or_due: round_money(total_withholding - total_tax),
    };

    let state_name = match input.resident_state {
        StateCode::Nj => "NJ",
        StateCode::Ny => "NY",
    };

    Ok(TaxCalculationResult {
        year_label: input.tax_year.label().to_string(),
        income,
        federal,
        state,
        combined,
        assumptions: vec![
            "Federal tax uses standard deduction only and ignores credits, AMT, NIIT, and self-employment tax.".into(),
            "Qualified dividends are capped at ordinary dividends and long-term gains use simplified preferential federal rates.".into(),
            format!("{state_name} estimate assumes a resident return and does not handle multi-state allocation or local taxes."),
            "NJ estimate omits personal exemptions and other state-specific adjustments; NY estimate uses standard deduction only.".into(),
            "W-2 wages and withholding totals are summed from the detailed W-2 tab entries.".into(),
            "1099-B gains/losses are summed from short-term covered, short-term noncovered, long-term covered, and long-term noncovered account details.".into(),
            "Additional 1099-INT and 1099-DIV boxes are collected for reconciliation, but this simplified estimate currently uses taxable interest and ordinary/qualified dividends for the tax calculation.".into(),
            "This tool is intended for cross-checking summary totals, not preparing a tax filing.".into(),
        ],
    })
}

#[derive(Clone, Copy, Debug)]
pub struct ComputedTax {
    pub tax: f64,
    pub taxable_income: f64,
    pub marginal_rate: f64,
}

#[derive(Clone, Copy, Debug)]
pub struct FederalComputedTax {
    pub tax: f64,
    pub taxable_income: f64,
    pub standard_deduction: f64,
    pub preferred_income: f64,
    pub ordinary_taxable_income: f64,
    pub marginal_rate: f64,
}

pub fn progressive_tax(income: f64, brackets: &[(f64, f64)]) -> f64 {
    let mut previous_limit = 0.0;
    let mut tax = 0.0;

    for (upper_limit, rate) in brackets {
        if income <= previous_limit {
            break;
        }

        let taxable_slice = income.min(*upper_limit) - previous_limit;
        if taxable_slice > 0.0 {
            tax += taxable_slice * rate;
        }
        previous_limit = *upper_limit;
    }

    tax
}

pub fn marginal_rate(income: f64, brackets: &[(f64, f64)]) -> f64 {
    for (upper_limit, rate) in brackets {
        if income <= *upper_limit {
            return *rate;
        }
    }

    brackets.last().map(|(_, rate)| *rate).unwrap_or(0.0)
}

pub fn ratio(amount: f64, base: f64) -> f64 {
    if base <= 0.0 {
        0.0
    } else {
        amount / base
    }
}

pub fn round_money(value: f64) -> f64 {
    (value * 100.0).round() / 100.0
}

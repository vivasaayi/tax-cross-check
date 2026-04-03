use crate::models::{FilingStatus, TaxYear};

pub fn federal_standard_deduction(year: TaxYear, status: FilingStatus) -> f64 {
    match year {
        TaxYear::Y2024 => match status {
            FilingStatus::Single | FilingStatus::MarriedFilingSeparately => 14_600.0,
            FilingStatus::MarriedFilingJointly => 29_200.0,
            FilingStatus::HeadOfHousehold => 21_900.0,
        },
        TaxYear::Y2025 => match status {
            FilingStatus::Single | FilingStatus::MarriedFilingSeparately => 15_000.0,
            FilingStatus::MarriedFilingJointly => 30_000.0,
            FilingStatus::HeadOfHousehold => 22_500.0,
        },
    }
}

pub fn federal_ordinary_brackets(year: TaxYear, status: FilingStatus) -> &'static [(f64, f64)] {
    match year {
        TaxYear::Y2024 => ordinary_2024(status),
        TaxYear::Y2025 => ordinary_2025(status),
    }
}

pub fn federal_capital_gain_bands(year: TaxYear, status: FilingStatus) -> (f64, f64) {
    match year {
        TaxYear::Y2024 => capital_bands_2024(status),
        TaxYear::Y2025 => capital_bands_2025(status),
    }
}

fn ordinary_2024(status: FilingStatus) -> &'static [(f64, f64)] {
    match status {
        FilingStatus::Single => &[
            (11_600.0, 0.10),
            (47_150.0, 0.12),
            (100_525.0, 0.22),
            (191_950.0, 0.24),
            (243_725.0, 0.32),
            (609_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedFilingJointly => &[
            (23_200.0, 0.10),
            (94_300.0, 0.12),
            (201_050.0, 0.22),
            (383_900.0, 0.24),
            (487_450.0, 0.32),
            (731_200.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedFilingSeparately => &[
            (11_600.0, 0.10),
            (47_150.0, 0.12),
            (100_525.0, 0.22),
            (191_950.0, 0.24),
            (243_725.0, 0.32),
            (365_600.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::HeadOfHousehold => &[
            (16_550.0, 0.10),
            (63_100.0, 0.12),
            (100_500.0, 0.22),
            (191_950.0, 0.24),
            (243_700.0, 0.32),
            (609_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
    }
}

fn ordinary_2025(status: FilingStatus) -> &'static [(f64, f64)] {
    match status {
        FilingStatus::Single => &[
            (11_925.0, 0.10),
            (48_475.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_525.0, 0.32),
            (626_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedFilingJointly => &[
            (23_850.0, 0.10),
            (96_950.0, 0.12),
            (206_700.0, 0.22),
            (394_600.0, 0.24),
            (501_050.0, 0.32),
            (751_600.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::MarriedFilingSeparately => &[
            (11_925.0, 0.10),
            (48_475.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_525.0, 0.32),
            (375_800.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
        FilingStatus::HeadOfHousehold => &[
            (17_000.0, 0.10),
            (64_850.0, 0.12),
            (103_350.0, 0.22),
            (197_300.0, 0.24),
            (250_500.0, 0.32),
            (626_350.0, 0.35),
            (f64::INFINITY, 0.37),
        ],
    }
}

fn capital_bands_2024(status: FilingStatus) -> (f64, f64) {
    match status {
        FilingStatus::Single => (47_025.0, 518_900.0),
        FilingStatus::MarriedFilingJointly => (94_050.0, 583_750.0),
        FilingStatus::MarriedFilingSeparately => (47_025.0, 291_850.0),
        FilingStatus::HeadOfHousehold => (63_000.0, 551_350.0),
    }
}

fn capital_bands_2025(status: FilingStatus) -> (f64, f64) {
    match status {
        FilingStatus::Single => (48_350.0, 533_400.0),
        FilingStatus::MarriedFilingJointly => (96_700.0, 600_050.0),
        FilingStatus::MarriedFilingSeparately => (48_350.0, 300_000.0),
        FilingStatus::HeadOfHousehold => (64_750.0, 566_700.0),
    }
}
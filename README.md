# Tax Cross Check

A small Rust and Tauri desktop app to cross-check summary tax numbers against TurboTax for:

- Federal tax
- New Jersey resident return estimate
- New York resident return estimate
- Tax years 2024 and 2025

This app is intentionally not a full filing product. It focuses on summary inputs from common forms:

- W-2 wages
- 1099-INT taxable interest
- 1099-DIV ordinary and qualified dividends
- 1099-MISC income
- 1099-B short-term and long-term gains or losses

## Scope

The calculator is designed for rough reconciliation, not filing. It uses a simplified model:

- Standard deduction only for federal and New York calculations
- No itemized deductions
- No credits
- No AMT, NIIT, self-employment tax, child tax credit, SALT cap logic, or local taxes
- No multi-state allocation, part-year residency, or nonresident logic
- New Jersey is modeled as a simplified resident estimate without exemptions or deductions beyond the bracket logic in code

## Project structure

- `src/` contains the Tauri frontend
- `src-tauri/src/models.rs` contains shared request and response types
- `src-tauri/src/tax/` contains the tax engine
- `src-tauri/src/tax/years.rs` contains year-specific federal values
- `src-tauri/src/tax/states/` contains NJ and NY calculators

## Run locally

```bash
npm install
npm run tauri:dev
```

## Build

```bash
npm run tauri:build
```

## Next steps

Good extensions for this project would be:

1. Separate W-2 box fields and state wage fields.
2. Add credits and estimated payments.
3. Model Schedule D netting and capital loss carryovers.
4. Add an import format for exported TurboTax worksheets.

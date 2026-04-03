# Tax Cross Check

A small Rust and Tauri desktop app to cross-check summary tax numbers against TurboTax for federal tax and NJ or NY returns.

## Features

- **Tax Calculator Tab**: Clean interface for main tax inputs and results
- **W-2 Tab**: Full W-2 box-by-box entry with automatic wage and withholding rollup
- **Accounts Tab**: Central management of trading account names
- **Interest Tab**: Account-level 1099-INT detail across common boxes, including taxable, treasury, tax-exempt, and premium-related fields
- **Dividends Tab**: Account-level 1099-DIV detail across ordinary, qualified, capital gain, 199A, exempt-interest, and related fields
- **Misc Income Tab**: Account-level breakdown of 1099-MISC income
- **1099-B Details Tab**: Separate covered and noncovered tables for short-term and long-term capital gains/losses
- **Data Tab**: Auto-save guidance plus JSON export/import for backup and restore
- **Automatic Calculation**: Gain/Loss verification (Proceeds - Cost Basis - Wash Sale)
- **Column Summing**: Real-time totals for all account data
- **Mismatch Highlighting**: Visual alerts when your input doesn't match calculated values

## Supported Forms

- W-2 box-level detail
- 1099-INT common box detail (account-level)
- 1099-DIV common box detail (account-level)
- 1099-MISC income (account-level)
- 1099-B short-term covered
- 1099-B short-term noncovered
- 1099-B long-term covered
- 1099-B long-term noncovered

## Workflow

1. **Enter W-2 Forms**: Use the "W-2" tab to capture full payroll box detail
2. **Setup Accounts**: Go to "Accounts" tab and add your trading account names
3. **Enter Income Details**: Use the "Interest", "Dividends", and "Misc Income" tabs to enter account-level box data
4. **Enter Trading Details**: Switch to "1099-B Details" and fill in the four covered/noncovered tables for each account
5. **Verify Calculations**: Check that calculated Gain/Loss matches your Excel numbers
6. **Export or Restore**: Use the "Data" tab to back up or restore your session as JSON
7. **Calculate Tax**: Go to "Tax Calculator" tab for the final tax estimate

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

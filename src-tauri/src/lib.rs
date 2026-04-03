mod models;
mod tax;

use models::{TaxCalculationInput, TaxCalculationResult};

#[tauri::command]
fn calculate_tax(input: TaxCalculationInput) -> Result<TaxCalculationResult, String> {
    tax::calculate(&input)
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![calculate_tax])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

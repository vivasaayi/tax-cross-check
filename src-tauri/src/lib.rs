mod models;
mod tax;

use models::{TaxCalculationInput, TaxCalculationResult};
use rfd::FileDialog;
use std::fs;

#[tauri::command]
fn calculate_tax(input: TaxCalculationInput) -> Result<TaxCalculationResult, String> {
    tax::calculate(&input)
}

#[tauri::command]
fn save_export_json(contents: String, suggested_file_name: String) -> Result<Option<String>, String> {
    let file_path = FileDialog::new()
        .add_filter("JSON", &["json"])
        .set_file_name(&suggested_file_name)
        .save_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    fs::write(&path, contents).map_err(|error| format!("Unable to save export: {error}"))?;

    Ok(Some(path.display().to_string()))
}

#[tauri::command]
fn open_import_json() -> Result<Option<String>, String> {
    let file_path = FileDialog::new()
        .add_filter("JSON", &["json"])
        .pick_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    let contents = fs::read_to_string(&path).map_err(|error| format!("Unable to read file: {error}"))?;

    Ok(Some(contents))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![calculate_tax, save_export_json, open_import_json])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

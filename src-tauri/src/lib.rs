mod models;
mod tax;

use models::{TaxCalculationInput, TaxCalculationResult};
use rfd::FileDialog;
use serde::Serialize;
use std::fs;

#[derive(Serialize)]
struct OpenSnapshotResult {
    path: String,
    contents: String,
}

#[tauri::command]
fn calculate_tax(input: TaxCalculationInput) -> Result<TaxCalculationResult, String> {
    tax::calculate(&input)
}

#[tauri::command]
fn save_export_json(
    contents: String,
    suggested_file_name: String,
    current_file_path: Option<String>,
) -> Result<Option<String>, String> {
    let mut dialog = FileDialog::new();
    dialog = dialog
        .add_filter("JSON", &["json"])
        .set_file_name(&suggested_file_name);

    if let Some(existing_path) = current_file_path {
        if let Some(parent) = std::path::Path::new(&existing_path).parent() {
            dialog = dialog.set_directory(parent);
        }
    }

    let file_path = dialog.save_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    fs::write(&path, contents).map_err(|error| format!("Unable to save export: {error}"))?;

    Ok(Some(path.display().to_string()))
}

#[tauri::command]
fn save_snapshot_to_path(path: String, contents: String) -> Result<String, String> {
    fs::write(&path, contents).map_err(|error| format!("Unable to save file: {error}"))?;
    Ok(path)
}

#[tauri::command]
fn open_import_json() -> Result<Option<OpenSnapshotResult>, String> {
    let file_path = FileDialog::new()
        .add_filter("JSON", &["json"])
        .pick_file();

    let Some(path) = file_path else {
        return Ok(None);
    };

    let contents = fs::read_to_string(&path).map_err(|error| format!("Unable to read file: {error}"))?;

    Ok(Some(OpenSnapshotResult {
        path: path.display().to_string(),
        contents,
    }))
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            calculate_tax,
            save_export_json,
            save_snapshot_to_path,
            open_import_json,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

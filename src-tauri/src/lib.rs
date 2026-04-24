mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::tokens::count_tokens,
            commands::ai::ai_generate,
            commands::file::read_file,
            commands::file::write_file,
            commands::file::list_directory,
            commands::file::path_exists,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

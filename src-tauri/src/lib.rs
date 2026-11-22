// 简记共享运行入口：桌面端与 Android 端共用同一套 Builder
// 后续在此注册记账核心命令（收支 CRUD、分类、统计），与 jianji-windows / jianji-macos 保持一致
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("failed to run jianji");
}

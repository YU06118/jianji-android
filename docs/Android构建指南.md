# Android 构建指南

本仓库产出 **Android APK**（Tauri v2 + WebView）。推荐直接用 GitHub Actions 构建，本机无需 Android SDK。

## 1. 产物与下载

| 渠道 | 位置 |
|------|------|
| Actions | Actions → `Build Android APK` → 最近一次成功运行 → Artifacts → `jianji-android-debug-apk` |
| Release | Releases → `android-v0.1.0` → `jianji-android-arm64-debug.apk` |
| 本地 | `src-tauri/gen/android/app/build/outputs/apk/` |

debug 包为调试签名，仅供安装体验；正式分发需配置自己的 keystore（见第 5 节）。

## 2. CI 构建（推荐）

工作流文件：`.github/workflows/android.yml`

- **触发**：推送到 `main`（`src/**`、`src-tauri/**`、`package.json`、工作流本身变化），或在 Actions 页面手动 `Run workflow`。
- **环境**：`ubuntu-latest`、Node 20、JDK 17（Temurin）、Android SDK 34 + Build-Tools 34、NDK `27.0.12077973`、Rust stable + 四个 Android target。
- **流程**：`npm install` → `tauri icon` 生成 mipmap → `tauri android init` → `tauri android build --apk --debug --target aarch64 --split-per-abi` → 收集并上传 APK。
- **产物**：`jianji-android-debug-apk`（保留 30 天）。

> 只构建 `arm64` 以缩短时间；需要 32 位或模拟器包时，把 `--target aarch64` 换成 `aarch64,armv7,x86_64` 或去掉该参数。

## 3. 本地环境

| 依赖 | 版本 |
|------|------|
| Node.js | ≥ 18（CI 用 20） |
| Rust | stable，含 `aarch64-linux-android` 等 target |
| JDK | 17 |
| Android SDK | Platform 34、Build-Tools 34.0.0 |
| Android NDK | 27.0.12077973 |
| 环境变量 | `ANDROID_HOME`、`NDK_HOME`（指向 `$ANDROID_HOME/ndk/27.0.12077973`）、`JAVA_HOME` |

安装 Rust target：

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

## 4. 本地构建

```bash
npm install
npx tauri icon src-tauri/icons/icon.png      # 从 1024 源图生成各尺寸与 Android mipmap
npx tauri android init                       # 仅首次，生成 src-tauri/gen/android
npx tauri android build --apk --debug --target aarch64 --split-per-abi
```

产物目录：

```
src-tauri/gen/android/app/build/outputs/apk/aarch64/debug/
```

安装到已连接设备：

```bash
adb install -r src-tauri/gen/android/app/build/outputs/apk/aarch64/debug/app-aarch64-debug.apk
```
`src-tauri/gen/` 与 `target/` 已在 `.gitignore` 中，不入库。

## 5. Release 签名

1. 生成 keystore（只做一次，务必备份）：

```bash
keytool -genkeypair -v -keystore jianji-release.jks -alias jianji \
  -keyalg RSA -keysize 2048 -validity 10000
```

2. 在 `src-tauri/gen/android/keystore.properties` 写入：

```properties
storeFile=../../jianji-release.jks
storePassword=你的密码
keyAlias=jianji
keyPassword=你的密码
```

3. 构建 release 包：

```bash
npx tauri android build --apk --target aarch64 --split-per-abi
```

若 CI 需要出正式包，把 keystore 与密码放入 GitHub Secrets，并在工作流里解码 keystore、生成 `keystore.properties` 后再执行 release 构建。不要提交 keystore 与密码。

## 6. 数据与调试

- 前端持久化：WebView `localStorage`，键 `jianji.android.v1`。
- 备份格式：

```json
{
  "app": "jianji-android",
  "v": 1,
  "settings": { "mode": "dark", "accent": "blue", "budget": 600000, "goal": { "name": "", "target": 0 } },
  "entries": [{ "id": "…", "type": "expense", "cat": "food", "amount": 2350, "date": "2026-11-22", "note": "早餐", "ts": 0 }]
}
```

- 金额单位统一为「分」；日期为 `YYYY-MM-DD`；分类键与小程序 / Windows / macOS 一致。
- UI 调试：桌面浏览器直接打开 `src/index.html`（或起一个静态服务器），Chrome DevTools 切换设备模拟即可；Android 真机可用 `adb logcat` 查看 Rust/Gradle 日志。

## 7. 常见问题

| 现象 | 处理 |
|------|------|
| `Failed to find package 'tools'`（setup-android 步骤） | 工作流里 `android-actions/setup-android@v3` 必须指定 `packages: 'platform-tools'` |
| `NDK not found` / `linker not found` | 确认 `NDK_HOME` 指向实际安装目录，且版本与 `sdkmanager` 安装的一致 |
| 首次构建很慢 | Rust 全量编译 + Gradle 下载依赖属正常；已启用 `Swatinem/rust-cache` |
| `tauri android init` 报已存在 | `gen/android` 已生成，可重复构建；需要重建时删除该目录 |
| APK 安装失败（覆盖安装） | 卸载旧包后再装，debug 与 release 签名不同 |
| 中文应用名异常 | 本工程 `productName` 为「简记」，如遇 Gradle 路径问题可临时改为 ASCII 后再排查 |

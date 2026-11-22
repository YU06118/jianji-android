# Android 构建指南（APK 打包）

本仓库为 Tauri v2 Android 工程骨架。以下为完整打包步骤。

## 1. 环境要求

| 组件 | 要求 | 说明 |
|------|------|------|
| Rust | stable ≥ 1.77 | 需添加 Android 目标：`rustup target add aarch64-linux-android armv7-linux-androideabi` |
| JDK | 17 | Android Gradle Plugin 要求 |
| Android SDK | API 34+ | 经 Android Studio 安装 |
| Android NDK | r25+ | Tauri 移动端必需 |
| Node.js | ≥ 18 | 运行 Tauri CLI |

环境变量（Windows 示例）：

```
JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
ANDROID_HOME=C:\Users\<user>\AppData\Local\Android\Sdk
NDK_HOME=%ANDROID_HOME%\ndk\<版本号>
```

## 2. 构建步骤

```bash
# 1) 安装 Tauri CLI
npm install

# 2) 生成 Android 工程（首次执行一次即可）
npx tauri android init

# 3) 真机调试（可选）
npx tauri android dev

# 4) 打包 APK（debug 或 release）
npx tauri android build --apk
npx tauri android build --apk --debug   # 调试包，无需签名配置
```

产物位置：`src-tauri/gen/android/app/build/outputs/apk/`

## 3. 发布签名（release 包必需）

1. 生成 keystore：`keytool -genkey -v -keystore jianji.keystore -alias jianji -keyalg RSA -keysize 2048 -validity 10000`
2. 在 `src-tauri/gen/android/keystore.properties` 配置签名信息（该目录已 gitignore，不会入库）。
3. 重新执行 `npx tauri android build --apk`。

## 4. 功能一致性提醒

实现功能时对齐桌面端基线（见 README「功能一致性基线」）：收支 CRUD、分类管理、月度汇总、账单检索、SQLite 本地存储。Rust 核心命令注册在 `src-tauri/src/lib.rs`。

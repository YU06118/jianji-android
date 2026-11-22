# 简记 · Android 端（jianji-android）

> 本仓库原为「简记」monorepo（原仓库名 `jianji`），2026-11-22 起更名为 **jianji-android**，专门承载 **Android 手机版**，目标为打包生成 APK 安装包。
> 旧 monorepo 代码完整保留在 `archive/monorepo-20261122` 分支。

## 技术方案

采用 **Tauri v2** 移动端支持（Rust 内核 + WebView 前端），与 Windows 端（jianji-windows）、macOS 端（jianji-macos）保持同一技术栈，最大限度复用共享业务逻辑（记账核心、SQLite 存储层、收支统计）。

## 各平台仓库

| 平台 | 仓库 | 状态 |
|------|------|------|
| 文档总导航 | `YU06118/jianji` | 四端文档集合与直达入口 |
| 微信小程序（主端） | `YU06118/jianji-miniprogram` | 已完成 |
| Windows 桌面端 | `YU06118/jianji-windows` | 已完成（历史发版 v0.1.2–v0.1.8 暂存本仓库 Releases） |
| macOS 桌面端 | `YU06118/jianji-macos` | 已完成（v0.1.8，Intel + Apple Silicon） |
| Android（本仓库） | `YU06118/jianji-android` | **骨架阶段，内容待填充** |

## 功能一致性基线（与桌面端/小程序端对齐）

- 收入 / 支出 / 转账记录的增删改查
- 自定义收支分类管理
- 按月 / 按分类汇总统计与图表
- 账单流水检索
- 本地 SQLite 存储（移动端位于应用私有目录）

## 目录结构

```
jianji-android/
├── src/                     # 前端界面（待填充，复用桌面端 UI 适配移动端布局）
├── src-tauri/               # Tauri v2 工程核心
│   ├── src/                 # Rust 源码（main.rs / lib.rs 骨架已就位）
│   ├── gen/                 # tauri android init 自动生成的 Android 工程（已 gitignore）
│   ├── icons/               # 应用图标（待补充）
│   ├── Cargo.toml           # Rust 依赖清单
│   └── tauri.conf.json      # Tauri 配置（应用标识 com.yu06118.jianji）
├── shared/                  # 跨平台共享逻辑占位（与桌面端同步演进）
├── docs/
│   ├── 目录结构说明.md
│   └── Android构建指南.md   # APK 打包完整步骤
└── package.json             # Tauri CLI 脚本入口
```

## 快速开始

详见 [docs/Android构建指南.md](docs/Android构建指南.md)。最小命令集：

```bash
npm install
npx tauri android init      # 首次执行，生成 Android 工程
npx tauri android build --apk   # 产出 APK 至 src-tauri/gen/android/app/build/outputs/
```

环境要求：Rust、Android Studio（SDK + NDK）、JDK 17、Node.js ≥ 18。

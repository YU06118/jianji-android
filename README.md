# 简记 · Android 端（jianji-android）

> 「简记」四端之一，承载 **Android 手机版**。技术栈为 **Tauri v2 + WebView**（前端纯 HTML/CSS/JS，无打包器），产物为可安装的 APK。

## 下载与安装

- **CI 构建产物**：GitHub → Actions → `Build Android APK` → 最近一次成功运行 → Artifacts 下载 `jianji-android-debug-apk`。
- **Release**：见仓库 Releases 中的 `android-v0.1.0`（如已发布）。
- **安装**：手机需允许「安装未知来源应用」。debug 包使用调试签名，不能覆盖正式签名包。

## 设计语言（三端合并）

| 来源 | 采纳的规则 |
|------|-----------|
| 小程序 v5.0（主端） | 暗紫渐变底 `#2E2745 → #202020`、近黑卡片 `#1D1D1F`、圆角分级、280ms `cubic-bezier(.16,1,.3,1)`、四套主题色、分类线性 SVG 图标 |
| Windows / macOS 桌面端 | 底部导航玻璃层（backdrop-filter）、等宽数字、分组设置列表、极淡分隔线 |
| Android 原生习惯 | 底部五栏导航（中间凸起记账键）、安全区 `env(safe-area-inset-*)`、48dp 触摸目标、按压缩放反馈、底部弹层、自绘数字键盘 |

## 已实现

- **首页**：本月结余、预算进度、快捷入口、收支概览、分类排行、最近记录
- **记一笔**：支出 / 收入切换，12 + 5 个分类，3 列数字键盘，今天 / 昨天 / 前天与日期选择，备注关键词自动归类
- **明细**：月份切换、全部 / 支出 / 收入筛选、按日分组
- **统计**：环形图 + 图例、日均、笔数、单笔最高
- **我的**：深浅模式（含跟随系统）、四套主题色、月度预算、存钱目标、JSON 备份 / 导入、示例数据、清空数据
- **数据口径**：金额以「分」存整数；日期 `YYYY-MM-DD`；分类键与小程序 / Windows / macOS 同名，便于后续跨端同步
- **持久化**：WebView `localStorage`（键 `jianji.android.v1`）

### 当前边界

- 记录支持新增与删除，暂不支持编辑
- 分类为固定集合（与小程序一致），暂不支持自定义分类
- 暂无转账、账本、搜索
- 存储尚未迁到 SQLite；JSON 备份可跨设备迁移

## 目录结构

```
jianji-android/
├── src/                        # 前端（纯 HTML/CSS/JS）
│   ├── index.html              # App Shell：四视图 + 弹层
│   ├── styles.css              # 设计系统（浅/深 token、组件、动效）
│   ├── core.js                 # 纯函数核心（分类、金额、汇总、自动归类）
│   ├── app.js                  # 状态、渲染、交互、localStorage
│   └── assets/icons/           # 分类线性图标（复用小程序）
├── src-tauri/
│   ├── src/{main.rs,lib.rs}     # Tauri 入口
│   ├── icons/                  # 应用图标（含 android mipmap）
│   ├── Cargo.toml
│   └── tauri.conf.json         # 标识 com.yu06118.jianji，版本 0.1.0
├── .github/workflows/android.yml   # APK 构建流水线
├── docs/Android构建指南.md
└── package.json
```

## 构建

推荐用 CI（无需本机 Android SDK）：

```
GitHub → Actions → Build Android APK → Run workflow
```

本地构建需 JDK 17、Android SDK 34、NDK 27、Rust 与 Node 20：

```bash
npm install
npx tauri icon src-tauri/icons/icon.png   # 生成 mipmap
npx tauri android init                    # 首次执行
npx tauri android build --apk --debug --target aarch64
```

产物：`src-tauri/gen/android/app/build/outputs/apk/`。详见 [docs/Android构建指南.md](docs/Android构建指南.md)。

## 四端仓库

| 平台 | 仓库 | 状态 |
|------|------|------|
| 文档总导航 | `YU06118/jianji` | 四端文档与直达入口 |
| 微信小程序（主端） | `YU06118/jianji-miniprogram` | 已完成 |
| Windows 桌面端 | `YU06118/jianji-windows` | 已完成 |
| macOS 桌面端 | `YU06118/jianji-macos` | 已完成（v0.1.8，双架构） |
| Android（本仓库） | `YU06118/jianji-android` | v0.1.0 · debug APK |

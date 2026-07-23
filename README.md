<div align="center">

<img src="assets/icons/appicon-256.png" alt="Half Beat Player Icon" width="120" height="120" />

# Half Beat Player

**基于 B站 API 的音乐播放器，实现电脑上的「听视频」自由**

当前版本：v1.3.0（2026-03-10）

_使用 Wails v2 构建的跨平台桌面应用_

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Wails](https://img.shields.io/badge/Wails-v2.11-DF0039?logo=wails&logoColor=white)](https://wails.io)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?logo=go&logoColor=white)](https://golang.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node](https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Mantine](https://img.shields.io/badge/Mantine-v8-339AF0?logo=mantine&logoColor=white)](https://mantine.dev)

[功能特性](#功能特性) • [开发环境](#开发环境) • [构建与发布](#构建与发布) • [项目结构](#项目结构) • [更新日志](#更新日志)

</div>

---

## 简介

**Half Beat Player** 是一款轻量级、现代化的桌面音乐播放器，专为 Bilibili 用户设计。它允许你直接播放 Bilibili 视频的音频流，无需下载视频，实现高效的「听视频」体验。

### 核心优势

- **原生体验**: 基于 Wails v2 构建，拥有原生应用的性能和 Web 技术的灵活性。
- **无需 yt-dlp**: 直接调用 Bilibili API 解析音频流，响应速度快，依赖少。
- **现代化 UI**: 使用 Mantine v8 组件库，支持深色/浅色模式及自定义主题。
- **本地优先**: 歌单和配置存储在本地 SQLite 数据库中，支持离线管理。

---

这个项目的灵感来自于 [Azusa Player](https://github.com/kenmingwang/azusa-player)，起因是开发者需要一个能够去掉b站视频片头片尾的播放器，于是便有了这个项目。

开发者个人能力有限，可能会有较多的 bug，欢迎提 issue 或者 PR。

本项目主要是自用，提出的需求不一定会被采纳，但是如果有什么问题或者建议，也欢迎提 issue 或者 PR。

所有平台自动构建的安装包均不保证可用性，建议参考下文的构建方法自行构建。

如果这个项目对你有帮助，请给一个 Star！

---

## 功能特性

### Bilibili 集成

- **扫码登录**: 安全便捷的 B站账号接入。
- **用户信息**: 实时同步头像、用户名及登录状态。
- **收藏夹导入**: 一键导入 Bilibili 公开或私有收藏夹。

### 播放体验

- **音频解析**: 支持多码率音频流解析。
- **片段播放**: 支持设置播放区间，自动跳过片头片尾。
- **播放模式**: 列表循环、随机播放、单曲循环。
- **音量补偿**: 支持全局默认补偿 + 单曲独立覆盖，切歌自动应用，减少不同视频响度差异带来的频繁调音量问题。
- **音频代理**: 内置音频代理服务器，解决跨域及防盗链问题。
- **播放稳定性**: 使用共享的 `<audio>` 实例；在 Wails/Linux WebKit 环境下默认禁用 WebAudio 路由（避免偶发无声），并在检测到本地代理不可用时进行最佳努力恢复。

### 歌单管理

- **灵活组织**: 创建、编辑、删除自定义歌单。
- **BV 号解析**: 支持通过 BV 号快速添加歌曲，支持分 P 选择。
- **歌曲编辑**: 自定义歌曲名、歌手、封面及播放参数。
- **收藏同步**: 双向同步本地收藏与 Bilibili 收藏夹，同步进度可视追踪。
- **分页加载**: 大收藏库分页虚拟滚动，流畅浏览。

### 歌词体验

- **同步歌词**: 播放时逐行高亮滚动，支持 LRC 时间轴歌词。
- **多源搜索**: 自动从 LRCLIB、Bilibili 等源搜索匹配歌词。
- **手动导入**: 支持 LRC/TXT 文件导入，预览与格式校验。
- **偏移调节**: 微调时间轴偏移，手动锁定防止覆盖。

### 搜索与发现

- **全局搜索**: 快速查找本地库中的歌曲。
- **远程搜索**: 直接在应用内搜索 B站视频并添加至歌单。

---

## 免责声明 (Disclaimer)

1. **项目用途**：本项目仅供学习、研究和技术交流使用，请勿将其用于任何商业用途。
2. **版权声明**：本项目所使用的所有 Bilibili 相关 API 均来自互联网。视频、音频、封面等内容版权归 [Bilibili](https://www.bilibili.com) 及相关权利人所有。
3. **风险自担**：用户在使用本项目时需自行承担风险（包括但不限于账号封禁、数据丢失等）。开发者不对因使用本项目而产生的任何直接或间接损失负责。
4. **及时删除**：如果 Bilibili 或相关权利人认为本项目侵犯了其合法权益，请联系开发者，我将在收到通知后第一时间删除相关代码。
5. **最终解释权**：开发者保留对本项目、相关协议及免责声明的最终解释权与修改权。

---

## 隐私与数据说明

为了提供核心功能，本项目会在本地存储以下数据：

- **数据目录**：通常位于系统用户配置目录的 `half-beat/app_data/` 下（如 Linux 的 `~/.config/half-beat/app_data/`）。
- **登录凭证**：B 站登录后的 `SESSDATA` 保存在本地 SQLite 数据库中，仅用于与 B 站服务器通信。当前未额外加密，请保护好本机账户和数据目录。
- **本地数据库**：歌单、歌曲元数据及应用设置存储在 `half-beat.db` (SQLite) 中。
- **网络说明**：应用启动时会在本地动态选择端口运行代理服务器（仅监听 `127.0.0.1`），用于转发经过目标检查的音频和图片请求。旧版代理 URL 会在启动后刷新为当前端口和进程令牌。
- **可靠性说明**：若播放过程中出现本地代理不可达，前端会触发后端进行最佳努力的代理自恢复，然后再重试刷新播放地址。
- **安全加固**：后端流媒体与歌词请求使用 netguard 公网网关，拒绝私有地址访问；数据目录权限收紧为 0700；存储路径校验防目录穿越。
- **错误应对**：全局错误边界在异常时展示友好回退界面，歌词加载错误独立隔离，不影响主播放功能。
- **主题图片**：用户设置的主题背景图会保存为本地缓存文件，仅保存引用路径；远程 URL 仅在用户保存主题时刷新，展示时统一走本地代理。

本项目**不会**上传任何个人数据到第三方服务器（Bilibili 官方服务器除外）。

---

## 安装方法

### 1. 下载安装包

前往 [Releases 页面](https://github.com/Sheyiyuan/Half-Beat-Player/releases) 下载适合您操作系统的安装包。

- **Windows**: 下载 `.exe` 安装程序并运行。
- **macOS**: 下载 `.dmg` 文件并双击安装。
- **Linux**: 下载 `.deb` 或 `.rpm` 包，使用以下命令安装：

```bash
# Debian/Ubuntu
sudo dpkg -i half-beat_<version>_amd64.deb
sudo apt-get install -f  # 修复依赖

# Fedora/RHEL
sudo rpm -i half-beat-<version>-<release>.x86_64.rpm
```

### 2. Arch 用户

Arch Linux 用户可以通过 AUR 安装 `half-beat-bin` 包：

```bash
# yay
yay -S half-beat-bin
# paru
paru -S half-beat-bin
```

---

## 开发环境

### 前置要求

- **Go**: 1.22+
- **Node.js**: 22+
- **pnpm**: 11+
- **Wails**: v2.11.0
- **GNU Make**: 4+
- **CGO 编译器**: (Windows 需要 gcc, Linux 需要 build-essential)

### 运行开发版

```bash
# 安装固定版本的 Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0

# 安装前端依赖并启动开发模式
make install
make dev
```

运行测试或完整质量检查：

```bash
make test
make check
```

---

## 构建与发布

### 基础构建

构建当前平台的可执行文件：

```bash
make build
```

`scripts/wails.sh` 会定位 Wails CLI，并在 Linux 上自动选择 WebKitGTK 4.0/4.1 构建标签。

### 统一打包入口

Makefile 统一调用现有平台脚本，支持版本注入和多平台打包。直接执行 `make package` 会选择当前主机平台。

#### 1. 设置版本号 (可选)

可以通过 Make 变量注入版本号，否则将从 `frontend/package.json` 读取：

```bash
make package VERSION=1.3.0
```

#### 2. Linux 打包 (DEB/RPM)

```bash
# 一次编译，同时生成 DEB 和 RPM
make package-linux

# 也可以只生成一种包
make package-deb
make package-rpm
```

#### 3. Windows 打包 (NSIS)

支持在 Linux 下使用 MinGW 交叉编译：

```bash
make package-windows
```

#### 4. macOS 打包

```bash
make package-macos
```

现有 `scripts/build-*.sh` 仍作为底层平台实现保留，日常开发和 CI 应优先使用 Make 目标。

详细文档请参考：

- [Windows 安装与运行](docs/windows.md)
- [macOS 构建与安装](docs/macos.md)
- [Debian/Ubuntu 打包](docs/debian.md)
- [RPM 打包](docs/rpm.md)
- [前端架构](docs/architecture.md)
- [性能基线](docs/performance-baseline.md)
- [发布验证状态](docs/release-verification.md)
- [安全设计决策](docs/security-decisions.md)

---

## 项目结构

```text
.
├── internal/               # Go 后端逻辑
│   ├── db/                 # 数据库初始化与 GORM 迁移
│   ├── lyrics/             # 歌词搜索、解析与匹配引擎
│   ├── models/             # GORM 数据模型定义
│   ├── netguard/           # 公网网关 HTTP 客户端 (SSRF 防护)
│   ├── proxy/              # 音频代理服务器 (处理 B站 Referer 限制)
│   └── services/           # 核心业务服务
│       ├── login.go        # B站扫码登录逻辑
│       ├── bili_play.go    # B站音频流解析
│       ├── favorite_sync.go # 收藏夹双向同步
│       ├── lyric_search.go # 歌词搜索与聚合
│       ├── lyrics.go       # 歌词存储与偏好管理
│       ├── playlist.go     # 歌单管理
│       ├── storage.go      # 存储路径校验服务
│       └── ...             # 搜索、下载等服务
├── frontend/               # React 前端 (Vite + TS)
│   ├── src/
│   │   ├── components/     # UI 组件 (Mantine v8)
│   │   │   ├── lyrics/     # 歌词面板与错误边界
│   │   │   ├── errors/     # 全局错误边界
│   │   │   ├── player/     # 队列工具栏与弹出框
│   │   │   └── ...
│   │   ├── hooks/          # 业务逻辑封装 (播放器控制、数据获取)
│   │   │   ├── features/   # 歌词、收藏同步、主题编辑器等
│   │   │   ├── player/     # 播放控制与跳过区间
│   │   │   ├── data/       # 设置持久化、收藏分页
│   │   │   └── ui/         # 应用生命周期、面板属性
│   │   ├── context/        # Player/Data/Theme/UI 四个领域 Context
│   │   ├── utils/          # 工具函数 (图片、音频、可访问性、错误域)
│   │   └── store/          # 类型定义 (types.ts 已提升至 src/)
│   └── wailsjs/            # Wails 自动生成的 JS 绑定
├── scripts/                # 跨平台构建与打包脚本
├── build/                  # Wails 标准图标源与生成的构建产物
├── assets/                 # 静态资源
├── Makefile                # 统一构建入口 (开发/测试/检查/打包)
├── main.go                 # 应用入口，初始化服务与 Wails 运行时
└── wails.json              # Wails 项目配置文件
```

---

## 更新日志

- 最新发布与变更请查看本仓库的变更记录与 GitHub Releases：
  - [CHANGELOG](CHANGELOG.md)
  - [Releases](https://github.com/Sheyiyuan/Half-Beat-Player/releases)
  - [Tags](https://github.com/Sheyiyuan/Half-Beat-Player/tags)

---

## 开源协议

- 本项目的**源代码与仓库文档**按 [MIT License](LICENSE) 授权。
- 项目 Logo、应用图标和其他品牌视觉资产不包含在 MIT 授权中，除非对应文件另有明确许可。
- Bilibili 视频、音频、封面、商标以及第三方依赖仍归各自权利人所有，不因本仓库许可证获得额外授权。

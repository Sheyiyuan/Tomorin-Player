# 应用图标构建

## 唯一设计源

应用图标的设计源是 `assets/icons/appicon.png`，格式为 512x512 RGBA PNG。Wails v2 固定从 `build/appicon.png` 读取应用图标，因此仓库同时保留一份像素完全一致的副本：

```text
assets/icons/appicon.png  ->  build/appicon.png  ->  Wails 平台派生资源
```

`assets/icons/appicon-256.png` 只用于 README 和 Linux 软件包中的 256px 图标，不参与 Wails 的 Windows 或 macOS 图标生成。

更新图标时必须同步替换 `assets/icons/appicon.png` 和 `build/appicon.png`，然后运行：

```bash
make verify-app-icon
```

该检查确认两份文件均为 512x512 RGBA PNG，并逐像素比较内容。`make check`、`make build`、`make dev` 以及 Windows/macOS 打包脚本都会执行此检查。

## Wails 派生资源

不要在 `wails.json` 中配置 `darwin.icon`、`windows.icon` 或 `linux.icon`。这些不是 Wails v2 项目配置字段，会被 JSON 解析器忽略。

### Windows

Wails 从 `build/appicon.png` 生成 `build/windows/icon.ico`，其中包含 256、128、64、48、32 和 16px 六档图标，然后写入 EXE 的 `RT_GROUP_ICON` 和 `RT_ICON` 资源。

Wails 只在 `build/windows/icon.ico` 不存在时生成它。两个 Windows 打包脚本都会先删除旧的派生 ICO，避免复用由旧源图或 Wails 默认图标生成的文件。构建结束后，`scripts/verify-windows-icon` 会直接读取 PE 资源并检查尺寸和像素。

### macOS

Wails 从 `build/appicon.png` 直接编码 `half-beat.app/Contents/Resources/iconfile.icns`。应用包的 `Info.plist` 必须包含：

```text
CFBundleIconFile = iconfile
```

`scripts/build-macos.sh` 会检查该键和生成的 ICNS 文件。`build/darwin/icon.icns` 不会被 Wails 使用，也不应手动生成。

### Linux

DEB 和 RPM 继续安装 `assets/icons/appicon-256.png` 到 hicolor 与 pixmaps 目录。桌面文件通过图标名 `half-beat` 引用它。

## 清理

`make clean` 会删除 `build/bin`、`build/windows`、`build/darwin`、DEB/RPM 暂存目录和前端产物，但保留受版本控制的 `build/appicon.png`。

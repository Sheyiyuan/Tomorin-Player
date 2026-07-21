# half-beat - macOS 构建与安装

## 系统要求
- macOS 12+（Intel/Apple Silicon）
- Xcode Command Line Tools
- Wails CLI v2.11.0, Go 1.24+, Node.js 22.13+, pnpm 11.4.0, `create-dmg`

## 构建
```bash
# 构建（统一版本注入）
make package-macos VERSION=1.2.0 CLEAN=1
```

脚本行为：
- 使用 `APP_VERSION`/`VITE_APP_VERSION` 注入版本
- 检查 `build/appicon.png` 为 512x512 RGBA 且与设计源像素一致
- 由 Wails 按锁文件安装依赖并构建前端
- 执行 `wails build -platform darwin/universal`
- 检查 `CFBundleIconFile=iconfile` 和 `Contents/Resources/iconfile.icns`
- 要求 `create-dmg` 成功生成 DMG：`build/bin/half-beat-<version>.dmg`；生成失败时构建失败

Wails v2 固定从 `build/appicon.png` 生成应用包内的 `iconfile.icns`。`build/darwin/icon.icns` 和 `wails.json` 中的平台图标字段不会参与构建。

## 安装
- `.app` 直接拖入 `/Applications`
- 如生成 DMG，双击挂载后拖拽安装

## 签名与公证（可选）
- 目前脚本未包含签名/公证；需自行使用 `codesign` 与 `notarytool` 处理

## 常见问题
- `wails` 未找到：确认已安装并在 PATH（或放在 `$HOME/go/bin`）
- `missing LC_UUID load command`：确认 Wails CLI 和应用均使用 Go 1.24+ 构建
- 缺少 `create-dmg`：通过 `brew install create-dmg` 安装
- 图标仍为 Wails 默认图标：先运行 `make verify-app-icon`，再执行 `make clean` 后重新打包

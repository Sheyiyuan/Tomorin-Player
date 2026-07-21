# half-beat - Debian/Ubuntu 打包指南

本项目提供脚本化的 Debian 打包流程，所有版本号均由环境变量或 Tag 注入。

## 前置依赖

```bash
sudo apt-get update
sudo apt-get install -y jq dpkg-dev libgtk-3-dev libwebkit2gtk-4.1-dev nsis gcc-mingw-w64-x86-64
# Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0
```

`scripts/wails.sh` 会检测系统提供的 pkg-config 条目。Debian 13 使用 Wails 的 `webkit2_41` 构建标签，不需要创建 `webkit2gtk-4.0.pc` 软链接。

## 构建与打包

```bash
# 注入版本并构建 + 打包
make package-deb VERSION=1.2.0
```

脚本会：
- 使用 `APP_VERSION`（或 fallback 读取 `frontend/package.json`）
- 由 Wails 按锁文件安装依赖并构建前端
- 注入 `VITE_APP_VERSION` 到前端
- 临时更新 `wails.json` 的 `productVersion`（构建后恢复）
- 生成 `.deb` 包于 `build/deb/`

需要同时生成 DEB 和 RPM 时执行 `make package-linux VERSION=1.2.0`，应用二进制只编译一次。

## 安装测试

```bash
sudo dpkg -i build/deb/half-beat_<version>_amd64.deb
# 如有依赖问题：
sudo apt-get install -f
```

## 依赖

- 运行时依赖：
  - `libgtk-3-0`
  - `libwebkit2gtk-4.1-0 | libwebkit2gtk-4.0-37`

## 验证

```bash
# 查看控制信息
dpkg-deb -I build/deb/half-beat_<version>_amd64.deb
# 列出文件
dpkg-deb -c build/deb/half-beat_<version>_amd64.deb
```

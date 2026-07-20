# half-beat - RPM 打包指南

## 目标
为基于 RPM 的发行版（如 Fedora / openSUSE）生成安装包。版本号由 `APP_VERSION` 环境变量（或 `frontend/package.json`）注入。

## 前置依赖
```bash
sudo dnf install -y ruby ruby-devel rubygems rpm-build gcc-c++ make
sudo gem install --no-document fpm -v 1.17.0
sudo dnf install -y ImageMagick jq
# Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@v2.11.0
```

## 构建与打包
```bash
# 构建并打包 RPM
make package-rpm VERSION=1.2.0
```

脚本行为：
- 优先使用 `APP_VERSION`，否则读取 `frontend/package.json`
- 注入 `VITE_APP_VERSION`，由统一 Wails 包装器按锁文件安装依赖、构建前端并选择 WebKitGTK 构建标签
- 使用 fpm 生成 RPM：输出目录 `build/rpm`
- 安装路径：`/usr/bin/half-beat`，图标放入 hicolor 与 pixmaps

需要同时生成 DEB 和 RPM 时执行 `make package-linux VERSION=1.2.0`，应用二进制只编译一次。

## 依赖声明
- `gtk3`
- `webkit2gtk4.1 | webkit2gtk4.0`

## 验证
```bash
rpm -qlp build/rpm/half-beat-*.rpm
```

## 安装
```bash
sudo rpm -ivh build/rpm/half-beat-*.rpm
```

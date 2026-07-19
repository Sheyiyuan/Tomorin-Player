# CI/CD 自动化构建

本项目使用 GitHub Actions 进行自动化构建和发布。

## 触发条件

- **Push 到 main 分支**：自动构建所有平台
- **创建 tag (v*)**：自动构建并创建 GitHub Release
- **Pull Request**：构建测试

## 构建平台

### Windows

- **架构**: amd64
- **产物**: `.exe` 可执行文件
- **位置**: `artifacts/half-beat-windows-amd64/`

### macOS

- **架构**: amd64 (Intel), arm64 (Apple Silicon)
- **产物**: `.dmg` 安装镜像
- **位置**:
  - `artifacts/half-beat-macos-darwin-amd64/`
  - `artifacts/half-beat-macos-darwin-arm64/`

### Linux

- **架构**: amd64, arm64
- **产物**:
  - 二进制文件 (`half-beat`)
  - DEB 安装包 (Debian/Ubuntu)
  - RPM 安装包 (RHEL/Fedora/openSUSE)
- **位置**:
  - `artifacts/half-beat-linux-linux-amd64/`
  - `artifacts/half-beat-linux-linux-arm64/`

## 发布流程

1. 更新版本号并创建 tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

2. GitHub Actions 自动:

   - 构建所有平台
   - 创建 GitHub Release
   - 上传所有构建产物
3. 在 GitHub Releases 页面下载对应平台的安装包

## 本地构建

统一入口位于根目录 Makefile：

```bash
# 安装依赖与质量检查
make install
make check

# 当前平台开发与构建
make dev
make build

# 平台安装包
make package-linux VERSION=1.2.0
make package-windows VERSION=1.2.0
make package-macos VERSION=1.2.0
```

只生成一种 Linux 包时可以使用：

```bash
make package-deb VERSION=1.2.0
make package-rpm VERSION=1.2.0
```

Makefile 调用 `scripts/` 中的平台实现；Linux 上的 Wails 包装器会自动选择 WebKitGTK 4.0/4.1 构建标签。

## 注意事项

1. **跨平台编译限制**：

   - macOS 应用只能在 macOS 上构建（需要代码签名）
   - Windows 可以在任何平台构建
   - Linux 可以在任何平台构建（需要交叉编译工具）
2. **代码签名**：

   - macOS 和 Windows 应用需要代码签名才能正常分发
   - 需要在 GitHub Secrets 中配置证书
3. **依赖要求**：

   - 所有构建需要 Go 1.22+
   - 前端构建需要 Node.js 20+ 和 pnpm 11.4.0

## 自定义配置

修改 `.github/workflows/release.yml` 可以：

- 调整触发条件
- 添加更多架构支持
- 配置代码签名
- 自定义发布策略

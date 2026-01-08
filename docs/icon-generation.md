# 图标生成系统

## 概述

Half Beat Player 使用动态图标生成系统，在构建时从PNG源文件生成平台特定的图标格式。

## 源文件

- **主图标**: `assets/icons/appicon-256.png` (256x256 PNG)
- **备用图标**: `assets/icons/appicon.png`

## 平台支持

### Windows (.ico)
- **生成位置**: `build/windows/icon.ico`
- **包含分辨率**: 16x16, 32x32, 48x48, 256x256
- **工具**: ImageMagick (首选) 或 icoutils (备用)

### Linux (.png)
- **使用文件**: `assets/icons/appicon.png` (直接使用)
- **安装位置**: 
  - `/usr/share/icons/hicolor/256x256/apps/`
  - `/usr/share/pixmaps/`

### macOS (.icns)
- **处理方式**: Wails 自动处理
- **源文件**: `assets/icons/appicon-256.png`

## 构建集成

### 自动生成
图标在以下情况下自动生成：

1. **Windows构建**: `scripts/windows/build-windows.sh`
2. **CI/CD流程**: GitHub Actions 自动调用

### 手动生成
```bash
# 生成Windows图标
./scripts/generate-icons.sh windows

# 生成所有平台图标
./scripts/generate-icons.sh all
```

## 工具依赖

### ImageMagick (推荐)
```bash
# Ubuntu/Debian
sudo apt install imagemagick

# macOS
brew install imagemagick
```

### icoutils (备用)
```bash
# Ubuntu/Debian
sudo apt install icoutils
```

## 图标质量验证

生成后可以验证图标质量：

```bash
# 查看ICO文件信息
identify build/windows/icon.ico

# 查看文件类型
file build/windows/icon.ico
```

## 故障排除

### 常见问题

1. **ImageMagick策略限制**
   ```bash
   # 如果遇到策略错误，编辑 /etc/ImageMagick-6/policy.xml
   # 注释掉或修改相关限制策略
   ```

2. **权限问题**
   ```bash
   # 确保脚本可执行
   chmod +x scripts/generate-icons.sh
   ```

3. **工具缺失**
   - 脚本会自动检测可用工具
   - 如果都不可用，会复制PNG作为备用（可能不完全兼容）

### 验证生成结果

```bash
# 检查ICO文件是否包含多个分辨率
identify build/windows/icon.ico

# 预期输出应显示4个不同分辨率的图标
```

## 更新图标

1. 替换 `assets/icons/appicon-256.png`
2. 可选：同时更新 `assets/icons/appicon.png`
3. 重新构建或手动运行图标生成脚本

## CI/CD集成

GitHub Actions 工作流自动：
1. 安装必要工具 (imagemagick, icoutils)
2. 在Windows构建前生成ICO文件
3. 验证生成结果

构建日志中会显示图标生成的详细信息和验证结果。
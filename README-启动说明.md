# WebApplication1 启动说明

## 问题：无法访问此页面 (ERR_CONNECTION_REFUSED)

这个错误表示 Web 服务器没有运行。这是一个 ASP.NET Web 应用程序，需要通过 Web 服务器访问，不能直接双击打开 HTML 文件。

## 解决方案

### 方法 1：使用 Visual Studio 启动（推荐）

1. **打开 Visual Studio**
2. **打开解决方案文件** `WebApplication1.sln`
3. **按 F5 键**或点击工具栏上的"启动"按钮
4. 浏览器会自动打开，访问地址：
   - HTTPS: `https://localhost:44364/`
   - HTTP: `http://localhost:65034/`

### 方法 2：使用 PowerShell 脚本启动

1. **打开 PowerShell**（以管理员身份运行）
2. **导航到项目目录**：
   ```powershell
   cd C:\Users\LYC\source\repos\WebApplication1
   ```
3. **运行启动脚本**：
   ```powershell
   .\start-server.ps1
   ```
4. **在浏览器中访问**：
   - `http://localhost:65034/`
   - 或 `https://localhost:44364/`

### 方法 3：手动启动 IIS Express

如果已安装 IIS Express，可以手动启动：

```powershell
# 找到 IIS Express 路径（通常在以下位置之一）
# C:\Program Files\IIS Express\iisexpress.exe
# C:\Program Files (x86)\IIS Express\iisexpress.exe

# 运行命令（替换为实际路径）
& "C:\Program Files\IIS Express\iisexpress.exe" `
    /path:"C:\Users\LYC\source\repos\WebApplication1\WebApplication1" `
    /port:65034 `
    /clr:v4.0
```

## 常见问题

### 1. 端口被占用
如果端口 65034 或 44364 已被占用：
- 在 Visual Studio 中，右键项目 → 属性 → Web → 更改端口号
- 或关闭占用端口的程序

### 2. 找不到 IIS Express
- 确保已安装 Visual Studio（包含 IIS Express）
- 或单独安装 IIS Express

### 3. 证书错误（HTTPS）
- 首次访问 HTTPS 地址时，浏览器可能提示证书错误
- 点击"高级" → "继续访问"即可

### 4. 文件路径问题
确保以下文件存在：
- `WebApplication1/App_Data/PoemData.txt`
- `WebApplication1/css/StyleSheet1.css`
- `WebApplication1/js/time.js`

## 项目配置信息

- **HTTP 端口**: 65034
- **HTTPS 端口**: 44364
- **默认文档**: MapDisplay.html
- **框架版本**: .NET Framework 4.7.2

## 访问地址

启动服务器后，在浏览器中访问：
- `http://localhost:65034/MapDisplay.html`
- `https://localhost:44364/MapDisplay.html`

由于已配置默认文档，也可以直接访问：
- `http://localhost:65034/`
- `https://localhost:44364/`


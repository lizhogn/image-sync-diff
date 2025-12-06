import * as vscode from 'vscode';

export class SidebarProvider implements vscode.WebviewViewProvider {
    _view?: vscode.WebviewView;
    private _firstImageUri?: vscode.Uri;

    constructor(private readonly _extensionUri: vscode.Uri) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async data => {
            switch (data.type) {
                case 'openEditor': {
                    vscode.commands.executeCommand('image-sync-diff.start');
                    break;
                }
                case 'clearFirstImage': {
                    vscode.commands.executeCommand('image-sync-diff.clearFirstImage');
                    break;
                }
                case 'loadImageData': {
                    if (this._firstImageUri) {
                        await this._sendImageData(webviewView.webview, this._firstImageUri);
                    }
                    break;
                }
            }
        });
    }

    public setFirstImage(uri: vscode.Uri) {
        this._firstImageUri = uri;
        if (this._view) {
            this._sendImageData(this._view.webview, uri);
        }
    }

    public clearFirstImage() {
        this._firstImageUri = undefined;
        if (this._view) {
            this._view.webview.postMessage({ type: 'clearImage' });
        }
    }

    private async _sendImageData(webview: vscode.Webview, uri: vscode.Uri) {
        try {
            const fileData = await vscode.workspace.fs.readFile(uri);
            const base64 = Buffer.from(fileData).toString('base64');
            const fileName = uri.fsPath.split(/[\\/]/).pop();
            const mimeType = this._getMimeType(uri.fsPath);

            webview.postMessage({
                type: 'setImage',
                data: `data:${mimeType};base64,${base64}`,
                filename: fileName
            });
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to load image: ${e}`);
        }
    }

    private _getMimeType(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'png': return 'image/png';
            case 'jpg':
            case 'jpeg': return 'image/jpeg';
            case 'gif': return 'image/gif';
            case 'webp': return 'image/webp';
            case 'svg': return 'image/svg+xml';
            case 'bmp': return 'image/bmp';
            default: return 'application/octet-stream';
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Sync Diff</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 10px;
            color: var(--vscode-foreground);
        }
        button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 12px;
            cursor: pointer;
            width: 100%;
            border-radius: 2px;
            margin-bottom: 10px;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        p {
            font-size: 13px;
            margin-bottom: 20px;
            opacity: 0.8;
        }
        .first-image-section {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            display: none;
        }
        .first-image-section.active {
            display: block;
        }
        .first-image-section h4 {
            margin: 0 0 10px 0;
            font-size: 13px;
            opacity: 0.8;
        }
        .image-preview {
            max-width: 100%;
            border-radius: 2px;
            margin-bottom: 10px;
            display: block;
        }
        .filename {
            font-size: 12px;
            opacity: 0.7;
            margin-bottom: 10px;
            word-break: break-all;
        }
        .clear-btn {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        .clear-btn:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <h3>Image Sync Diff</h3>
    <p>Compare images with synchronized zoom and overlay.</p>
    <button id="openBtn">Open Editor</button>

    <div id="firstImageSection" class="first-image-section">
        <h4>First Image Selected:</h4>
        <img id="imagePreview" class="image-preview" />
        <div id="imageFilename" class="filename"></div>
        <button id="clearBtn" class="clear-btn">Clear First Image</button>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        document.getElementById('openBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'openEditor' });
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            vscode.postMessage({ type: 'clearFirstImage' });
        });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'setImage':
                    document.getElementById('imagePreview').src = message.data;
                    document.getElementById('imageFilename').textContent = message.filename;
                    document.getElementById('firstImageSection').classList.add('active');
                    break;
                case 'clearImage':
                    document.getElementById('imagePreview').src = '';
                    document.getElementById('imageFilename').textContent = '';
                    document.getElementById('firstImageSection').classList.remove('active');
                    break;
            }
        });

        // Request image data on load if first image is set
        vscode.postMessage({ type: 'loadImageData' });
    </script>
</body>
</html>`;
    }
}

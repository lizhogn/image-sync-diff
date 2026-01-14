import * as vscode from 'vscode';

const MIME_TYPES: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp'
};

export class ImageDiffPanel {
    public static currentPanel: ImageDiffPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _pendingImages?: vscode.Uri[];
    private _webviewReady = false;

    public static createOrShow(extensionUri: vscode.Uri, imageUris?: vscode.Uri[]): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ImageDiffPanel.currentPanel) {
            ImageDiffPanel.currentPanel._panel.reveal(column);
            if (imageUris && imageUris.length >= 2) {
                ImageDiffPanel.currentPanel._loadImages(imageUris);
            }
            return;
        }

        const localResourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, 'media')];

        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                localResourceRoots.push(folder.uri);
            }
        }

        const panel = vscode.window.createWebviewPanel(
            'imageDiff',
            'Image Sync Diff',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: localResourceRoots,
                retainContextWhenHidden: true
            }
        );

        ImageDiffPanel.currentPanel = new ImageDiffPanel(panel, extensionUri);

        if (imageUris && imageUris.length >= 2) {
            ImageDiffPanel.currentPanel._pendingImages = imageUris;
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        this._update();

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                if (message.command === 'webviewReady') {
                    this._webviewReady = true;
                    if (this._pendingImages) {
                        await this._loadImages(this._pendingImages);
                        this._pendingImages = undefined;
                    }
                    return;
                }

                if (message.command === 'loadImage') {
                    try {
                        const uri = vscode.Uri.parse(message.uri);
                        const fileData = await vscode.workspace.fs.readFile(uri);
                        const base64 = Buffer.from(fileData).toString('base64');
                        const mimeType = this._getMimeType(uri.fsPath);

                        this._panel.webview.postMessage({
                            command: 'imageLoaded',
                            data: `data:${mimeType};base64,${base64}`,
                            filename: uri.fsPath,
                            index: message.index
                        });
                    } catch (e) {
                        console.error('Failed to load image:', e);
                        vscode.window.showErrorMessage(`Failed to load image: ${e}`);
                    }
                }
            },
            null,
            this._disposables
        );
    }

    private _getMimeType(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        return MIME_TYPES[ext] ?? 'application/octet-stream';
    }

    private async _loadImages(imageUris: vscode.Uri[]): Promise<void> {
        if (!this._webviewReady) {
            this._pendingImages = imageUris;
            return;
        }

        try {
            this._panel.webview.postMessage({
                command: 'imagesCount',
                count: imageUris.length
            });

            for (let i = 0; i < imageUris.length; i++) {
                const uri = imageUris[i];
                const imageData = await vscode.workspace.fs.readFile(uri);
                const base64 = Buffer.from(imageData).toString('base64');
                const filePath = uri.path || uri.fsPath;
                const mimeType = this._getMimeType(filePath);

                this._panel.webview.postMessage({
                    command: 'imageLoaded',
                    data: `data:${mimeType};base64,${base64}`,
                    filename: filePath,
                    index: i
                });
            }
        } catch (e) {
            console.error('Failed to load images:', e);
            vscode.window.showErrorMessage(`Failed to load images: ${e}`);
        }
    }

    public dispose(): void {
        ImageDiffPanel.currentPanel = undefined;
        this._panel.dispose();

        for (const disposable of this._disposables) {
            disposable.dispose();
        }
        this._disposables = [];
    }

    private _update(): void {
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleUri}" rel="stylesheet">
    <title>Image Sync Diff</title>
</head>
<body>
    <div class="controls">
        <div id="zoom-level">100%</div>
        <button id="overlayBtn" title="Overlay Right on Left">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path fill-rule="evenodd" d="M12 8a.5.5 0 0 1-.5.5H5.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L5.707 7.5H11.5a.5.5 0 0 1 .5.5z"/>
            </svg>
        </button>
        <div class="mode-controls">
            <div id="dissolveControl" class="dissolve-control">
                <label for="dissolveSlider">Dissolve:</label>
                <input type="range" id="dissolveSlider" min="0" max="100" value="0">
                <span id="dissolveValue">0%</span>
            </div>
            <div id="differencesControl" class="differences-control active">
                <input type="checkbox" id="differencesCheckbox">
                <label for="differencesCheckbox">Differences</label>
            </div>
            <div id="referenceControl" class="reference-control">
                <label for="referenceSelector">Reference:</label>
                <select id="referenceSelector" class="reference-selector">
                </select>
            </div>
        </div>
    </div>
    <div class="container">
        <div id="images-container" class="images-container">
            <!-- All images will be dynamically added here in a mosaic -->
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

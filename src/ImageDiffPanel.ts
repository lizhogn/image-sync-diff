import * as vscode from 'vscode';

export class ImageDiffPanel {
    public static currentPanel: ImageDiffPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _pendingImages?: { leftUri: vscode.Uri; rightUri: vscode.Uri };
    private _webviewReady: boolean = false;

    public static createOrShow(extensionUri: vscode.Uri, leftImageUri?: vscode.Uri, rightImageUri?: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it and load the new images.
        if (ImageDiffPanel.currentPanel) {
            ImageDiffPanel.currentPanel._panel.reveal(column);
            if (leftImageUri && rightImageUri) {
                ImageDiffPanel.currentPanel._loadImages(leftImageUri, rightImageUri);
            }
            return;
        }

        // Otherwise, create a new panel.
        // Build localResourceRoots including workspace folders for remote scenarios
        const localResourceRoots: vscode.Uri[] = [vscode.Uri.joinPath(extensionUri, 'media')];

        // Add all workspace folders to allow loading images from workspace
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
                // Enable javascript in the webview
                enableScripts: true,
                // Allow loading from extension media and workspace folders
                localResourceRoots: localResourceRoots
            }
        );

        ImageDiffPanel.currentPanel = new ImageDiffPanel(panel, extensionUri);

        // Store images to load after webview is ready (avoids race condition)
        if (leftImageUri && rightImageUri) {
            ImageDiffPanel.currentPanel._pendingImages = { leftUri: leftImageUri, rightUri: rightImageUri };
        }
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'webviewReady':
                        // Webview is ready, load any pending images
                        this._webviewReady = true;
                        if (this._pendingImages) {
                            await this._loadImages(this._pendingImages.leftUri, this._pendingImages.rightUri);
                            this._pendingImages = undefined;
                        }
                        return;
                    case 'loadImage':
                        try {
                            const uri = vscode.Uri.parse(message.uri);
                            const fileData = await vscode.workspace.fs.readFile(uri);
                            const base64 = Buffer.from(fileData).toString('base64');
                            const mimeType = this._getMimeType(uri.fsPath);

                            this._panel.webview.postMessage({
                                command: 'imageLoaded',
                                data: `data:${mimeType};base64,${base64}`,
                                filename: uri.fsPath,
                                isRight: message.isRight
                            });
                        } catch (e) {
                            console.error('Failed to load image:', e);
                            vscode.window.showErrorMessage(`Failed to load image: ${e}`);
                        }
                        return;
                }
            },
            null,
            this._disposables
        );
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

    private async _loadImages(leftUri: vscode.Uri, rightUri: vscode.Uri) {
        // If webview is not ready yet, store as pending
        if (!this._webviewReady) {
            this._pendingImages = { leftUri, rightUri };
            return;
        }

        try {
            // Load left image using workspace.fs API (works for both local and remote)
            console.log('Loading left image:', leftUri.toString());
            const leftData = await vscode.workspace.fs.readFile(leftUri);
            const leftBase64 = Buffer.from(leftData).toString('base64');
            const leftMimeType = this._getMimeType(leftUri.path || leftUri.fsPath);

            // Load right image
            console.log('Loading right image:', rightUri.toString());
            const rightData = await vscode.workspace.fs.readFile(rightUri);
            const rightBase64 = Buffer.from(rightData).toString('base64');
            const rightMimeType = this._getMimeType(rightUri.path || rightUri.fsPath);

            // Send both images to webview
            this._panel.webview.postMessage({
                command: 'imageLoaded',
                data: `data:${leftMimeType};base64,${leftBase64}`,
                filename: leftUri.path || leftUri.fsPath,
                isRight: false
            });

            this._panel.webview.postMessage({
                command: 'imageLoaded',
                data: `data:${rightMimeType};base64,${rightBase64}`,
                filename: rightUri.path || rightUri.fsPath,
                isRight: true
            });
        } catch (e) {
            console.error('Failed to load images:', e);
            vscode.window.showErrorMessage(`Failed to load images: ${e}`);
        }
    }

    public dispose() {
        ImageDiffPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js');
        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css');

        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

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
            <select id="modeSelector" class="mode-selector">
                <option value="sidebyside">Side by Side</option>
                <option value="dissolve">Dissolve</option>
            </select>
            <div id="opacityControl" class="opacity-control">
                <label for="opacitySlider">Opacity:</label>
                <input type="range" id="opacitySlider" class="opacity-slider" min="0" max="100" value="50">
            </div>
            <div id="differencesControl" class="differences-control active">
                <input type="checkbox" id="differencesCheckbox">
                <label for="differencesCheckbox">Differences</label>
            </div>
        </div>
    </div>
    <div class="container">
        <div id="left-container" class="image-container">
            <div class="filename" id="left-filename"></div>
            <div class="placeholder">Select 2 images in Explorer, right-click and choose "Compare Images with Sync Diff"</div>
            <img id="left-image" class="sync-image" draggable="false" />
            <img id="overlay-image" class="sync-image" draggable="false" />
            <canvas id="overlay-diff-canvas"></canvas>
        </div>
        <div id="right-container" class="image-container">
            <div class="filename" id="right-filename"></div>
            <div class="placeholder">Select 2 images in Explorer, right-click and choose "Compare Images with Sync Diff"</div>
            <img id="right-image" class="sync-image" draggable="false" />
            <canvas id="diff-canvas"></canvas>
        </div>
    </div>
    <script src="${scriptUri}"></script>
</body>
</html>`;
    }
}

import * as vscode from 'vscode';
import { ImageDiffPanel } from './ImageDiffPanel';

import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("image-sync-diff-sidebar", sidebarProvider)
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.start', () => {
            ImageDiffPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.compareImages', async (...args: any[]) => {
            // Get selected files from context menu
            const uris: vscode.Uri[] = [];

            // args[0] is the clicked file, args[1] is the full selection array
            if (args.length > 1 && Array.isArray(args[1])) {
                uris.push(...args[1]);
            } else if (args.length > 0 && args[0] instanceof vscode.Uri) {
                uris.push(args[0]);
            }

            // Validate exactly 2 images are selected
            if (uris.length !== 2) {
                vscode.window.showErrorMessage('Please select exactly 2 image files to compare.');
                return;
            }

            // Validate both are image files
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
            const isImageFile = (uri: vscode.Uri) => {
                const ext = uri.fsPath.toLowerCase().match(/\.[^.]+$/)?.[0];
                return ext && imageExtensions.includes(ext);
            };

            if (!uris.every(isImageFile)) {
                vscode.window.showErrorMessage('Both selected files must be images.');
                return;
            }

            // Create or show the diff panel with both images
            ImageDiffPanel.createOrShow(context.extensionUri, uris[0], uris[1]);
        })
    );
}

export function deactivate() { }

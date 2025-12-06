import * as vscode from 'vscode';
import { ImageDiffPanel } from './ImageDiffPanel';

import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("image-sync-diff-sidebar", sidebarProvider)
    );

    // State to store the first image URI
    let firstImageUri: vscode.Uri | undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.start', () => {
            ImageDiffPanel.createOrShow(context.extensionUri);
        })
    );

    // Existing functionality: compare 2 selected images directly
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

    // New functionality: Set first image for staged comparison
    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.setFirstImage', async (...args: any[]) => {
            let uri: vscode.Uri | undefined;

            if (args.length > 0 && args[0] instanceof vscode.Uri) {
                uri = args[0];
            }

            if (!uri) {
                vscode.window.showErrorMessage('No image file selected.');
                return;
            }

            // Validate it's an image file
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
            const ext = uri.fsPath.toLowerCase().match(/\.[^.]+$/)?.[0];
            if (!ext || !imageExtensions.includes(ext)) {
                vscode.window.showErrorMessage('Selected file must be an image.');
                return;
            }

            firstImageUri = uri;
            const fileName = uri.fsPath.split(/[\\/]/).pop();
            vscode.window.showInformationMessage(`First image set: ${fileName}`);

            // Update sidebar to show the first image
            sidebarProvider.setFirstImage(uri);
        })
    );

    // New functionality: Compare selected image with the first image
    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.compareWithFirst', async (...args: any[]) => {
            if (!firstImageUri) {
                vscode.window.showWarningMessage('Please set the first image first using "Set as First Image".');
                return;
            }

            let uri: vscode.Uri | undefined;

            if (args.length > 0 && args[0] instanceof vscode.Uri) {
                uri = args[0];
            }

            if (!uri) {
                vscode.window.showErrorMessage('No image file selected.');
                return;
            }

            // Validate it's an image file
            const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
            const ext = uri.fsPath.toLowerCase().match(/\.[^.]+$/)?.[0];
            if (!ext || !imageExtensions.includes(ext)) {
                vscode.window.showErrorMessage('Selected file must be an image.');
                return;
            }

            // Create or show the diff panel with both images
            ImageDiffPanel.createOrShow(context.extensionUri, firstImageUri, uri);
        })
    );

    // New functionality: Clear the first image
    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.clearFirstImage', async () => {
            firstImageUri = undefined;
            vscode.window.showInformationMessage('First image cleared.');
            sidebarProvider.clearFirstImage();
        })
    );
}

export function deactivate() { }

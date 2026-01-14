import * as vscode from 'vscode';
import { ImageDiffPanel } from './ImageDiffPanel';
import { SidebarProvider } from './SidebarProvider';

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

function isImageFile(uri: vscode.Uri): boolean {
    const ext = uri.fsPath.toLowerCase().match(/\.[^.]+$/)?.[0];
    return ext !== undefined && IMAGE_EXTENSIONS.includes(ext);
}

function getUriFromArgs(args: unknown[]): vscode.Uri | undefined {
    if (args.length > 0 && args[0] instanceof vscode.Uri) {
        return args[0];
    }
    return undefined;
}

function getUrisFromArgs(args: unknown[]): vscode.Uri[] {
    if (args.length > 1 && Array.isArray(args[1])) {
        return args[1];
    }
    const uri = getUriFromArgs(args);
    return uri ? [uri] : [];
}

export function activate(context: vscode.ExtensionContext): void {
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider("image-sync-diff-sidebar", sidebarProvider)
    );

    let firstImageUri: vscode.Uri | undefined;

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.start', () => {
            ImageDiffPanel.createOrShow(context.extensionUri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.compareImages', async (...args: unknown[]) => {
            const uris = getUrisFromArgs(args);

            if (uris.length < 2) {
                vscode.window.showErrorMessage('Please select at least 2 image files to compare.');
                return;
            }

            if (uris.length > 9) {
                vscode.window.showErrorMessage('Please select at most 9 image files to compare.');
                return;
            }

            if (!uris.every(isImageFile)) {
                vscode.window.showErrorMessage('All selected files must be images.');
                return;
            }

            ImageDiffPanel.createOrShow(context.extensionUri, uris);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.setFirstImage', async (...args: unknown[]) => {
            const uri = getUriFromArgs(args);

            if (!uri) {
                vscode.window.showErrorMessage('No image file selected.');
                return;
            }

            if (!isImageFile(uri)) {
                vscode.window.showErrorMessage('Selected file must be an image.');
                return;
            }

            firstImageUri = uri;
            const fileName = uri.fsPath.split(/[\\/]/).pop();
            vscode.window.showInformationMessage(`First image set: ${fileName}`);
            sidebarProvider.setFirstImage(uri);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.compareWithFirst', async (...args: unknown[]) => {
            if (!firstImageUri) {
                vscode.window.showWarningMessage('Please set the first image first using "Set as First Image".');
                return;
            }

            const uri = getUriFromArgs(args);

            if (!uri) {
                vscode.window.showErrorMessage('No image file selected.');
                return;
            }

            if (!isImageFile(uri)) {
                vscode.window.showErrorMessage('Selected file must be an image.');
                return;
            }

            ImageDiffPanel.createOrShow(context.extensionUri, [firstImageUri, uri]);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('image-sync-diff.clearFirstImage', () => {
            firstImageUri = undefined;
            vscode.window.showInformationMessage('First image cleared.');
            sidebarProvider.clearFirstImage();
        })
    );
}

export function deactivate() { }

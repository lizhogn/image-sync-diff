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
}

export function deactivate() { }

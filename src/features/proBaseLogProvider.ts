import * as vscode from 'vscode'
import * as fs from 'fs';
import * as path from 'path';
import Helper from '../utils/helper';
import ProBaseError from '../utils/probaseError';
import ProBaseSQLHelper from './proBaseSQLHelper';

export default class ProBaseLogProvider {

    LogPanel: vscode.WebviewPanel | undefined = undefined;
    LogInterval: NodeJS.Timer = setInterval(() => this.updateTraceLog(this.LogPanel), 250);
    State: vscode.Memento;
    LogPath: string;

    constructor(context: vscode.ExtensionContext, logPath: string) {
        this.State = context.workspaceState;
        this.LogPath = logPath;
        if (this.LogPanel) {
            this.LogPanel.reveal(vscode.ViewColumn.Beside);
        }
        else {
            this.LogPanel = vscode.window.createWebviewPanel('log', this.getWebviewTitle(logPath), vscode.ViewColumn.Two, { enableScripts: true });
            this.LogPanel.onDidDispose(() => { clearInterval(this.LogInterval); }, null, context.subscriptions);
            this.LogPanel!.webview.onDidReceiveMessage(message => {
                switch (message.command) {
                    case 'run-sql':
                        vscode.workspace.openTextDocument({ language: 'sql', content: message.content }).then(newDocument => {
                            vscode.window.showTextDocument(newDocument, vscode.ViewColumn.One).then(() => {
                                ProBaseSQLHelper.replaceParameters();
                            });
                        });
                        break;
                    case 'clear-log':
                        Helper.ClearLogFile();;
                        break;
                    case 'pause-log':
                        clearInterval(this.LogInterval);
                        break;
                    case 'resume-log':
                        this.LogInterval = setInterval(() => this.updateTraceLog(this.LogPanel), 250);
                        break;
                    case 'export-log':
                        var logs = message.content;
                        vscode.workspace.openTextDocument({ language: 'json', content: JSON.stringify(logs, null, 2) }).then(newDoc => {
                            vscode.window.showTextDocument(newDoc, vscode.ViewColumn.One).then((editor) => {
                                editor.document.save();
                            });;
                        });
                        break;
                }

            }, undefined, context.subscriptions);
        }
    }

    public static ShowLog(logProvider: ProBaseLogProvider, isLiveLog: Boolean) {
        var webViewHtmlPath = path.join(__dirname, "../utils/logWebView.html");
        fs.readFile(webViewHtmlPath, "utf-8", function (err, content) {

            if (err)
                throw new ProBaseError(err.name, err.message);

            logProvider.LogPanel!.webview.html = isLiveLog ? content.replace('"%%LIVELOG%%"', 'true') : content.replace('"%%LIVELOG%%"', 'false');
            logProvider.updateTraceLog(logProvider.LogPanel);
        });
    }

    private updateTraceLog(logPanel: vscode.WebviewPanel | undefined) {
        fs.readFile(this.LogPath, "utf-8", function (err, content) {

            if (err) {
                if (err.code !== "EBUSY")
                    throw new ProBaseError(err.name, err.message);
            }

            JSON.parse(content).forEach((element: any, index: Number) => {
                let log: Log = Object.assign(new Log(), element);
                if(log.User === "")
                    log.User = "Unknown user";
                logPanel!.webview.postMessage(log);
            });
        });
    }    

    private getWebviewTitle(logPath: string): string {
        return `SQL Log - ${logPath.replace(/^.*[\\\/]/, '')}`;
    }

}

class Log {
    GUID !: string;
    User !: string;
    PID !: string;
    SubSystem !: string;
    Module !: string;
    Message !: string;
    Date  !: string;
    Time !: string;
}


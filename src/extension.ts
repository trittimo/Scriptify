import * as vscode from "vscode";
import * as fs from "fs";
import path = require("path");

const outChannel = vscode.window.createOutputChannel("Scriptify");

async function getSpecificWorkspaceScript(directory: string, scriptName: string): Promise<string | undefined> {
	if (vscode.workspace.workspaceFolders == undefined || vscode.workspace.workspaceFolders.length < 1) {
		vscode.window.showErrorMessage("Must have a workspace open with a script file in .vscode/scripts");
		return;
	}

	if (!scriptName.endsWith(".js")) {
		scriptName = scriptName + ".js";
	}

	let scriptPath = path.join(directory, "scriptCommands", scriptName);
	if (!fs.existsSync(scriptPath)) {
		vscode.window.showInformationMessage("Must have a script at location '" + scriptPath + "'");
		return;
	}

	let script = fs.readFileSync(scriptPath);
	return script.toString();
}

async function getWorkspaceScript(): Promise<string | undefined> {
	if (vscode.workspace.workspaceFolders == undefined || vscode.workspace.workspaceFolders.length < 1) {
		vscode.window.showErrorMessage("Must have a workspace open with a script file in .vscode/scripts");
		return;
	}
	let scriptsPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".vscode/scripts");
	if (!fs.existsSync(scriptsPath)) {
		vscode.window.showInformationMessage("Must have a .vscode/scripts directory with a js script in it");
		return;
	}

	let scriptPickList: vscode.QuickPickItem[] = [];
	for (let fileName of fs.readdirSync(scriptsPath)) {
		if (!fileName.toLowerCase().endsWith(".js")) {
			continue;
		}

		scriptPickList.push({label: fileName});
	}
	let chosenScript = await vscode.window.showQuickPick(scriptPickList);
	if (chosenScript == undefined) return;

	let script = fs.readFileSync(path.join(scriptsPath, chosenScript.label));
	return script.toString();
}

export function activate(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("scriptify.transform", () => {
		if (vscode.window.activeTextEditor == undefined) {
			vscode.window.showInformationMessage("Must have an active text editor open to run this command");
			return;
		}

		getWorkspaceScript().then(script => {
			try {
				if (script == undefined) return;

				let transformFunc = eval(script);
				if (transformFunc == undefined || typeof transformFunc !== "function") {
					vscode.window.showErrorMessage("Selected script did not return a function that can be used to transform text");
				}

				let getTextFn = vscode.window.activeTextEditor!.document.getText;
				let selections = vscode.window.activeTextEditor!.selections;
				let logger = (...items: any[]) => {
					let result = items.join(" ");
					outChannel.appendLine(result);
				}

				vscode.window.activeTextEditor!.edit((editBuilder) => {
					transformFunc(selections, getTextFn, editBuilder, logger);
				}).then((success) => {
					if (!success) {
						vscode.window.showErrorMessage("Unable to edit the selected text when running the returned edit function");
					} else {
						let selectionCount = vscode.window.activeTextEditor!.selections.length == 0 ? 1 : vscode.window.activeTextEditor!.selections.length;
						vscode.window.showInformationMessage(`Successfully replaced (${selectionCount}) selections`);
					}
				});

			} catch (e) {
				vscode.window.showErrorMessage("Error running selected script:\n" + (e as Error).message + " at " + (e as Error).stack);
				return;
			}
		});
		
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand("scriptify.customCommand", (commandName: string = "") => {
		if (commandName.length == 0) {
			vscode.window.showErrorMessage("No command name passed");
			return;
		}

		const commandDirectory = path.dirname(path.dirname(context.globalStorageUri.fsPath));

		getSpecificWorkspaceScript(commandDirectory, commandName).then(script => {
			try {
				if (script == undefined) return;

				let commandScript = eval(script);
				if (commandScript == undefined || typeof commandScript !== "function") {
					vscode.window.showErrorMessage("Selected script did not return a function that can be used to run a command");
				}

				let logger = (...items: any[]) => {
					let result = items.join(" ");
					outChannel.appendLine(result);
				}
				commandScript(logger, context);

			} catch (e) {
				vscode.window.showErrorMessage("Error running selected script:\n" + (e as Error).message + " at " + (e as Error).stack);
				return;
			}
		});
		
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

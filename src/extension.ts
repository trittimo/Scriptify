import * as vscode from "vscode";
import * as fs from "fs";
import path = require("path");

const COMMAND_TEMPLATE =
`//  @ts-check
//  API: https://code.visualstudio.com/api/references/vscode-api

const vscode = require("vscode");
/**
 * @callback Logger
 * @param {...any} args
 */

/**
 * Command to run
 * @param {Logger} logger - A VSCode output channel which can be used for logging (viewable in Output -> Scriptify)
 * @param {vscode.ExtensionContext} context
 */
async function command(logger, context) {
	// TODO - Implement your command here
}

// Make sure your command is the last statement in the file
command;
`;

let defaultCommand = "";

const outChannel = vscode.window.createOutputChannel("Scriptify");

async function getCommandContent(directory: string, scriptName: string): Promise<string | undefined> {
	if (!scriptName.endsWith(".js")) {
		scriptName = scriptName + ".js";
	}

	let scriptPath = path.join(directory, scriptName);
	if (!fs.existsSync(scriptPath)) {
		vscode.window.showInformationMessage("Must have a script at location '" + scriptPath + "'");
		return;
	}

	let script = fs.readFileSync(scriptPath);
	return script.toString();
}

function getGlobalCommandsPath(context: vscode.ExtensionContext): string {
	let result = path.join(path.dirname(path.dirname(context.globalStorageUri.fsPath)), "scriptify");
	return result;
}

function getWorkspaceCommandsPath(): string | undefined {
	if (vscode.workspace.workspaceFolders == undefined || vscode.workspace.workspaceFolders.length < 1) {
		return;
	}

	let scriptsPath = path.join(vscode.workspace.workspaceFolders![0].uri.fsPath, ".vscode/commands");
	return scriptsPath;
}

function createDirectoryIfNotExists(path: string) {
	try {
		if (!fs.existsSync(path)) {
			fs.mkdirSync(path);
		}
	} catch {
		vscode.window.showErrorMessage("Error creating directory at " + path);
	}
}

async function promptCreateDirectory(dirPath: string): Promise<boolean> {
	let shouldCreateDir = await vscode.window.showQuickPick(["No", "Yes"], {title: "You don't have a .vscode/commands directory, would you like to create one?", canPickMany: false, placeHolder: "No"});
	if (shouldCreateDir == "Yes") {
		createDirectoryIfNotExists(dirPath);
		return true;
	}
	return false;
}

async function interactiveGetCommandContent(context: vscode.ExtensionContext): Promise<string | undefined> {
	const globalCommandPath = getGlobalCommandsPath(context);
	const workspaceCommandPath = getWorkspaceCommandsPath();

	const scriptPickList: vscode.QuickPickItem[] = [];
	if (workspaceCommandPath != undefined) {
		
		for (let fileName of fs.readdirSync(workspaceCommandPath)) {
			if (!fileName.toLowerCase().endsWith(".js")) {
				continue;
			}
			
			scriptPickList.push({label: fileName + " (workspace)"});
		}
		if (scriptPickList.length > 0) {
			scriptPickList.splice(0, 0, {label: "Workspace commands", kind: vscode.QuickPickItemKind.Separator});
		}
	}

	if (globalCommandPath != null) {
		let needsSep = scriptPickList.length > 0;
		for (let fileName of fs.readdirSync(globalCommandPath)) {
			if (needsSep) {
				scriptPickList.push({label: "Global commands", kind: vscode.QuickPickItemKind.Separator});
				needsSep = false;
			}
			if (!fileName.toLowerCase().endsWith(".js")) {
				continue;
			}
			scriptPickList.push({label: fileName + " (global)"});
		}
	}

	if (scriptPickList.length == 0) {
		vscode.window.showInformationMessage("You haven't created any commands yet");
		return;
	}

	// Put the last command run on the top so it is the default
	let foundDefault = false;
	scriptPickList.sort((a, b) => {
		if (a.label == defaultCommand) {
			foundDefault = true;
			return -1;
		}
		return 0;
	});
	
	// If we have a default command, add a separator between it and everything else
	if (foundDefault && scriptPickList.length > 1) {
		scriptPickList.splice(0, 0, {label: "Last command run", kind: vscode.QuickPickItemKind.Separator});
	}
	
	let chosenScript = await vscode.window.showQuickPick(scriptPickList, {canPickMany: false});
	if (chosenScript == undefined) return;

	defaultCommand = chosenScript.label;

	let selectedPath = chosenScript.label;

	if (selectedPath.endsWith(" (workspace)")) {
		selectedPath = path.join(workspaceCommandPath!, selectedPath.slice(0, selectedPath.length - " (workspace)".length));
	} else if (selectedPath.endsWith(" (global)")) {
		selectedPath = path.join(globalCommandPath, selectedPath.slice(0, selectedPath.length - " (global)".length));
	} else {
		return;
	}

	try {
		return fs.readFileSync(selectedPath, {encoding: "utf-8"}) + "";
	} catch {
		vscode.window.showErrorMessage("Unable to read file at: '" + selectedPath + "'");
	}
}

async function runScript(script: string | undefined, context: vscode.ExtensionContext) {
	if (script == undefined) return;

	let logger = (...items: any[]) => {
		let result = items.join(" ");
		outChannel.appendLine(result);
	}

	try {
		let commandScript = eval(script);
		if (commandScript == undefined || typeof commandScript !== "function") {
			vscode.window.showErrorMessage("Selected script did not return a function that can be used to run a command");
		}

		commandScript(logger, context);
	} catch (e) {
		vscode.window.showErrorMessage("Failed to run script - details in output log");
		logger((e as Error).stack);
	}
}

type CommandType = "local" | "global";

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(vscode.commands.registerCommand("scriptify.createCommand", async () => {
		const commandType = await vscode.window.showQuickPick(["Local", "Global"], {title: "Would you like to create a global command or a local workspace command?", canPickMany: false, placeHolder: "Local"});
		if (!commandType) return;

		let commandName = await vscode.window.showInputBox({prompt: "Command name", placeHolder: "my_command", title: "What would you like to call your command?"});
		if (!commandName) return;
		if (!commandName.toLowerCase().endsWith(".js")) commandName += ".js";

		let targetDirectoryPath: string | undefined;
		if (commandType == "Local") {
			targetDirectoryPath = getWorkspaceCommandsPath();
			if (!targetDirectoryPath) {
				vscode.window.showErrorMessage("Must have workspace open to create a local command");
				return;
			}
		} else {
			targetDirectoryPath = getGlobalCommandsPath(context);
		}

		createDirectoryIfNotExists(targetDirectoryPath);
		let scriptPath = path.join(targetDirectoryPath, commandName);
		if (fs.existsSync(scriptPath)) {
			// Just open existing scripts
			let doc = await vscode.workspace.openTextDocument(scriptPath);
			vscode.window.showTextDocument(doc);
		} else {
			fs.writeFileSync(scriptPath, COMMAND_TEMPLATE);
			let doc = await vscode.workspace.openTextDocument(scriptPath);
			vscode.window.showTextDocument(doc);
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("scriptify.runCommand", async (command: {commandType: CommandType, commandName: string}) => {
		let script: string | undefined;
		if (command) {
			if (command.commandType == "local") {
				let commandsPath = getWorkspaceCommandsPath();
				if (!commandsPath) {
					vscode.window.showErrorMessage("Cannot run local command because no workspace is open");
					return;
				}
				script = await getCommandContent(commandsPath, command.commandName);
			} else {
				script = await getCommandContent(getGlobalCommandsPath(context), command.commandName);
			}
		} else {
			script = await interactiveGetCommandContent(context);
		}
		runScript(script, context);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("scriptify.openCommandDirectory", async () => {
		const commandType = await vscode.window.showQuickPick(["Local", "Global"], {title: "Would you like to open the global command directory or local command directory?", canPickMany: false, placeHolder: "Local"});
		if (!commandType) return;

		let targetDirectoryPath: string | undefined;
		if (commandType == "Local") {
			targetDirectoryPath = getWorkspaceCommandsPath();
			if (!targetDirectoryPath) {
				vscode.window.showErrorMessage("Cannot open directory for local workspace because no workspace is open");
				return;
			}
		} else {
			targetDirectoryPath = getGlobalCommandsPath(context);
		}

		if (!fs.existsSync(targetDirectoryPath)) {
			let createdDir = await promptCreateDirectory(targetDirectoryPath);
			if (!createdDir) {
				return;
			}
		}
		let uri = vscode.Uri.file(targetDirectoryPath);
		await vscode.commands.executeCommand("revealFileInOS", uri);
	}));
}

export function deactivate() {}

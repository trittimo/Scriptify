# README
Example script (placed in your workspace under .vscode/scripts):
```javascript
//  @ts-check
//  API: https://code.visualstudio.com/api/references/vscode-api

(selections, getTextFn, editBuilder, logger) => {
    const vscode = require("vscode");
    let didReplace = false;
    for (let selection of selections) {
        if (selection.isEmpty) continue;
        didReplace = true;
        let text = getTextFn(selection);
        let lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
            lines[i] = lines[i].trimRight();
        }
        editBuilder.replace(selection, lines.join("\n"));
    }
    if (!didReplace) {
        let text = getTextFn();
        let lines = text.split("\n");
        let lastLineLength = 0;
        for (let i = 0; i < lines.length; i++) {
            lastLineLength = lines[i].length;
            lines[i] = lines[i].trimRight();
        }
        let selection = new vscode.Range(new vscode.Position(0, 0), new vscode.Position(lines.length - 1, lastLineLength));
        editBuilder.replace(selection, lines.join("\n"));
    }
}
```
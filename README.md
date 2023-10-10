# README
Example script (placed in your workspace under .vscode/scripts):
```javascript
(selections, getTextFn, editBuilder, logger) => {
    for (let selection of selections) {
        let text = getTextFn(selection);
        let lines = text.split("\n");
        let didReplace = false;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let hadLastNumber = false;
            for (let numberMatch of line.matchAll(/\d+/g)) {
                logger(numberMatch.index);
                if (!hadLastNumber) {
                    hadLastNumber = true;
                    let num = parseInt(numberMatch[0]);
                    lines[i] = line.slice(0, numberMatch.index) + (num-1) + line.slice(numberMatch.index + numberMatch[0].length);
                    didReplace = true;
                }
            }
        }
        if (!didReplace) {
            continue;
        }

        editBuilder.replace(selection, lines.join("\n"));
    }
}
```
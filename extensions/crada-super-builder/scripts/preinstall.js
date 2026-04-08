const readFileSync = require("fs")["readFileSync"];
const join = require("path")["join"];
const spawnSync = require("child_process")["spawnSync"];

const PATH = {
    packageJSON: join(__dirname, "../package.json")
};

function checkCreatorTypesVersion(version) {
    const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
    let versionsList = spawnSync(npmCommand, ["view", "@cocos/creator-types", "versions"]).stdout.toString();

    try {
        versionsList = JSON.parse(versionsList);
    } catch (error) {
        // Игнорируем ошибки парсинга
    }

    return versionsList.includes(version);
}

try {
    const packageContent = readFileSync(PATH.packageJSON, "utf8");
    const packageData = JSON.parse(packageContent);
    const creatorTypesVersion = packageData.devDependencies["@cocos/creator-types"].replace(/^[^\d]+/, "");

    if (!checkCreatorTypesVersion(creatorTypesVersion)) {
        console.log("\x1b[33mWarning:\x1b[0m");
        console.log("  @en");
        console.log("    Version check of @cocos/creator-types failed.");
        console.log(`    The definition of ${creatorTypesVersion} has not been released yet. Please export the definition to the ./node_modules directory by selecting "Developer -> Export Interface Definition" in the menu of the Creator editor.`);
        console.log("    The definition of the corresponding version will be released on npm after the editor is officially released.");
        console.log("  @zh");
        console.log("    @cocos/creator-types 版本检查失败。");
        console.log(`    ${creatorTypesVersion} 定义还未发布，请先通过 Creator 编辑器菜单 "开发者 -> 导出接口定义"，导出定义到 ./node_modules 目录。`);
        console.log("    对应版本的定义会在编辑器正式发布后同步发布到 npm 上。");
    }
} catch (error) {
    console.error(error);
}
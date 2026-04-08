"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.methods = void 0;
exports.load = load;
exports.unload = unload;
// @ts-ignore
const package_json_1 = __importDefault(require("../package.json"));
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
exports.methods = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    openPanel() {
        Editor.Panel.open(package_json_1.default.name);
    },
    /**
     * @en Open file in editor at specific line
     * @zh 在编辑器中打开文件到指定行
     */
    'open-file'(filePath, lineNumber) {
        try {
            // Используем системную команду для открытия файла
            const { exec } = require('child_process');
            const os = require('os');
            let command;
            const platform = os.platform();
            // Пытаемся открыть в VS Code с указанием строки
            command = `code "${filePath}:${lineNumber}"`;
            exec(command, (error, stdout, stderr) => {
                if (error) {
                    // Fallback - просто открываем файл в редакторе по умолчанию
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        let fallbackCommand;
                        if (platform === 'win32') {
                            fallbackCommand = `start "" "${filePath}"`;
                        }
                        else if (platform === 'darwin') {
                            fallbackCommand = `open "${filePath}"`;
                        }
                        else {
                            fallbackCommand = `xdg-open "${filePath}"`;
                        }
                        require('child_process').exec(fallbackCommand);
                    }
                }
            });
        }
        catch (error) {
            // Error opening file
        }
    },
};
/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
function load() { }
/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
function unload() { }
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tYWluLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7OztBQTJEQSxvQkFBMEI7QUFNMUIsd0JBQTRCO0FBakU1QixhQUFhO0FBQ2IsbUVBQTBDO0FBQzFDOzs7R0FHRztBQUNVLFFBQUEsT0FBTyxHQUE0QztJQUM1RDs7O09BR0c7SUFDSCxTQUFTO1FBQ0wsTUFBTSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsc0JBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsV0FBVyxDQUFDLFFBQWdCLEVBQUUsVUFBa0I7UUFDNUMsSUFBSSxDQUFDO1lBQ0Qsa0RBQWtEO1lBQ2xELE1BQU0sRUFBRSxJQUFJLEVBQUUsR0FBRyxPQUFPLENBQUMsZUFBZSxDQUFDLENBQUM7WUFDMUMsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXpCLElBQUksT0FBZSxDQUFDO1lBQ3BCLE1BQU0sUUFBUSxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUUvQixnREFBZ0Q7WUFDaEQsT0FBTyxHQUFHLFNBQVMsUUFBUSxJQUFJLFVBQVUsR0FBRyxDQUFDO1lBRTdDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFVLEVBQUUsTUFBYyxFQUFFLE1BQWMsRUFBRSxFQUFFO2dCQUN6RCxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUNSLDREQUE0RDtvQkFDNUQsTUFBTSxFQUFFLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO29CQUN6QixJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQzt3QkFDMUIsSUFBSSxlQUF1QixDQUFDO3dCQUM1QixJQUFJLFFBQVEsS0FBSyxPQUFPLEVBQUUsQ0FBQzs0QkFDdkIsZUFBZSxHQUFHLGFBQWEsUUFBUSxHQUFHLENBQUM7d0JBQy9DLENBQUM7NkJBQU0sSUFBSSxRQUFRLEtBQUssUUFBUSxFQUFFLENBQUM7NEJBQy9CLGVBQWUsR0FBRyxTQUFTLFFBQVEsR0FBRyxDQUFDO3dCQUMzQyxDQUFDOzZCQUFNLENBQUM7NEJBQ0osZUFBZSxHQUFHLGFBQWEsUUFBUSxHQUFHLENBQUM7d0JBQy9DLENBQUM7d0JBQ0QsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztvQkFDbkQsQ0FBQztnQkFDTCxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFFUCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLHFCQUFxQjtRQUN6QixDQUFDO0lBQ0wsQ0FBQztDQUNKLENBQUM7QUFFRjs7O0dBR0c7QUFDSCxTQUFnQixJQUFJLEtBQUssQ0FBQztBQUUxQjs7O0dBR0c7QUFDSCxTQUFnQixNQUFNLEtBQUssQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8vIEB0cy1pZ25vcmVcclxuaW1wb3J0IHBhY2thZ2VKU09OIGZyb20gJy4uL3BhY2thZ2UuanNvbic7XHJcbi8qKlxyXG4gKiBAZW4gUmVnaXN0cmF0aW9uIG1ldGhvZCBmb3IgdGhlIG1haW4gcHJvY2VzcyBvZiBFeHRlbnNpb25cclxuICogQHpoIOS4uuaJqeWxleeahOS4u+i/m+eoi+eahOazqOWGjOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGNvbnN0IG1ldGhvZHM6IHsgW2tleTogc3RyaW5nXTogKC4uLmFueTogYW55KSA9PiBhbnkgfSA9IHtcclxuICAgIC8qKlxyXG4gICAgICogQGVuIEEgbWV0aG9kIHRoYXQgY2FuIGJlIHRyaWdnZXJlZCBieSBtZXNzYWdlXHJcbiAgICAgKiBAemgg6YCa6L+HIG1lc3NhZ2Ug6Kem5Y+R55qE5pa55rOVXHJcbiAgICAgKi9cclxuICAgIG9wZW5QYW5lbCgpIHtcclxuICAgICAgICBFZGl0b3IuUGFuZWwub3BlbihwYWNrYWdlSlNPTi5uYW1lKTtcclxuICAgIH0sXHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBAZW4gT3BlbiBmaWxlIGluIGVkaXRvciBhdCBzcGVjaWZpYyBsaW5lXHJcbiAgICAgKiBAemgg5Zyo57yW6L6R5Zmo5Lit5omT5byA5paH5Lu25Yiw5oyH5a6a6KGMXHJcbiAgICAgKi9cclxuICAgICdvcGVuLWZpbGUnKGZpbGVQYXRoOiBzdHJpbmcsIGxpbmVOdW1iZXI6IG51bWJlcikge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vINCY0YHQv9C+0LvRjNC30YPQtdC8INGB0LjRgdGC0LXQvNC90YPRjiDQutC+0LzQsNC90LTRgyDQtNC70Y8g0L7RgtC60YDRi9GC0LjRjyDRhNCw0LnQu9CwXHJcbiAgICAgICAgICAgIGNvbnN0IHsgZXhlYyB9ID0gcmVxdWlyZSgnY2hpbGRfcHJvY2VzcycpO1xyXG4gICAgICAgICAgICBjb25zdCBvcyA9IHJlcXVpcmUoJ29zJyk7XHJcblxyXG4gICAgICAgICAgICBsZXQgY29tbWFuZDogc3RyaW5nO1xyXG4gICAgICAgICAgICBjb25zdCBwbGF0Zm9ybSA9IG9zLnBsYXRmb3JtKCk7XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GL0YLQsNC10LzRgdGPINC+0YLQutGA0YvRgtGMINCyIFZTIENvZGUg0YEg0YPQutCw0LfQsNC90LjQtdC8INGB0YLRgNC+0LrQuFxyXG4gICAgICAgICAgICBjb21tYW5kID0gYGNvZGUgXCIke2ZpbGVQYXRofToke2xpbmVOdW1iZXJ9XCJgO1xyXG5cclxuICAgICAgICAgICAgZXhlYyhjb21tYW5kLCAoZXJyb3I6IGFueSwgc3Rkb3V0OiBzdHJpbmcsIHN0ZGVycjogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayAtINC/0YDQvtGB0YLQviDQvtGC0LrRgNGL0LLQsNC10Lwg0YTQsNC50Lsg0LIg0YDQtdC00LDQutGC0L7RgNC1INC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZnMgPSByZXF1aXJlKCdmcycpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBsZXQgZmFsbGJhY2tDb21tYW5kOiBzdHJpbmc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChwbGF0Zm9ybSA9PT0gJ3dpbjMyJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmFsbGJhY2tDb21tYW5kID0gYHN0YXJ0IFwiXCIgXCIke2ZpbGVQYXRofVwiYDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChwbGF0Zm9ybSA9PT0gJ2RhcndpbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZhbGxiYWNrQ29tbWFuZCA9IGBvcGVuIFwiJHtmaWxlUGF0aH1cImA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmYWxsYmFja0NvbW1hbmQgPSBgeGRnLW9wZW4gXCIke2ZpbGVQYXRofVwiYDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlKCdjaGlsZF9wcm9jZXNzJykuZXhlYyhmYWxsYmFja0NvbW1hbmQpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIC8vIEVycm9yIG9wZW5pbmcgZmlsZVxyXG4gICAgICAgIH1cclxuICAgIH0sXHJcbn07XHJcblxyXG4vKipcclxuICogQGVuIE1ldGhvZCBUcmlnZ2VyZWQgb24gRXh0ZW5zaW9uIFN0YXJ0dXBcclxuICogQHpoIOaJqeWxleWQr+WKqOaXtuinpuWPkeeahOaWueazlVxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGxvYWQoKSB7IH1cclxuXHJcbi8qKlxyXG4gKiBAZW4gTWV0aG9kIHRyaWdnZXJlZCB3aGVuIHVuaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uXHJcbiAqIEB6aCDljbjovb3mianlsZXml7bop6blj5HnmoTmlrnms5VcclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiB1bmxvYWQoKSB7IH1cclxuIl19
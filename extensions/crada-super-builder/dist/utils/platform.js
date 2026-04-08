"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformUtils = void 0;
const child_process_1 = require("child_process");
const os = __importStar(require("os"));
class PlatformUtils {
    /**
     * Определяет текущую платформу
     */
    static getPlatform() {
        return this.platform;
    }
    /**
     * Проверяет, является ли платформа Windows
     */
    static isWindows() {
        return this.platform === 'win32';
    }
    /**
     * Проверяет, является ли платформа macOS
     */
    static isMacOS() {
        return this.platform === 'darwin';
    }
    /**
     * Проверяет, является ли платформа Linux
     */
    static isLinux() {
        return this.platform === 'linux';
    }
    /**
     * Получает команду для открытия файла в редакторе по умолчанию
     */
    static getOpenFileCommand(filePath) {
        if (this.isWindows()) {
            return `start "" "${filePath}"`;
        }
        else if (this.isMacOS()) {
            return `open "${filePath}"`;
        }
        else {
            // Linux
            return `xdg-open "${filePath}"`;
        }
    }
    /**
     * Получает команду для открытия URL в браузере
     */
    static getOpenUrlCommand(url) {
        if (this.isWindows()) {
            return `start "" "${url}"`;
        }
        else if (this.isMacOS()) {
            return `open "${url}"`;
        }
        else {
            // Linux
            return `xdg-open "${url}"`;
        }
    }
    /**
     * Получает команду для удаления папки
     */
    static getRemoveDirectoryCommand(dirPath) {
        if (this.isWindows()) {
            return `if exist "${dirPath}" rmdir /s /q "${dirPath}"`;
        }
        else {
            // macOS и Linux
            return `rm -rf "${dirPath}"`;
        }
    }
    /**
     * Получает команду для проверки существования папки
     */
    static getCheckDirectoryExistsCommand(dirPath) {
        if (this.isWindows()) {
            return `if exist "${dirPath}" echo exists`;
        }
        else {
            // macOS и Linux
            return `test -d "${dirPath}" && echo exists`;
        }
    }
    /**
     * Кроссплатформенный spawn для выполнения команд
     */
    static spawnCommand(command, args = [], options = {}) {
        if (this.isWindows()) {
            // На Windows используем cmd
            return (0, child_process_1.spawn)('cmd', ['/c', command, ...args], Object.assign({ shell: true }, options));
        }
        else {
            // На macOS и Linux используем sh -c без дополнительного shell: true
            const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
            return (0, child_process_1.spawn)('sh', ['-c', fullCommand], options);
        }
    }
    /**
     * Кроссплатформенный exec для выполнения команд
     */
    static execCommand(command, callback) {
        if (this.isWindows()) {
            return (0, child_process_1.exec)(`cmd /c "${command}"`, callback);
        }
        else {
            return (0, child_process_1.exec)(command, callback);
        }
    }
    /**
     * Открывает файл в редакторе по умолчанию
     */
    static openFile(filePath) {
        const command = this.getOpenFileCommand(filePath);
        this.execCommand(command);
    }
    /**
     * Открывает URL в браузере
     */
    static openUrl(url) {
        const command = this.getOpenUrlCommand(url);
        this.execCommand(command);
    }
    /**
     * Удаляет папку
     */
    static removeDirectory(dirPath) {
        return new Promise((resolve, reject) => {
            const command = this.getRemoveDirectoryCommand(dirPath);
            this.execCommand(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                else {
                    resolve();
                }
            });
        });
    }
    /**
     * Проверяет существование папки
     */
    static checkDirectoryExists(dirPath) {
        return new Promise((resolve) => {
            const command = this.getCheckDirectoryExistsCommand(dirPath);
            this.execCommand(command, (error, stdout, stderr) => {
                resolve(stdout.includes('exists'));
            });
        });
    }
    /**
     * Выполняет npm команду
     */
    static runNpmCommand(npmCommand, projectPath) {
        if (this.isWindows()) {
            return (0, child_process_1.spawn)('cmd', ['/c', 'npm', npmCommand], { shell: true, cwd: projectPath });
        }
        else {
            // На macOS и Linux запускаем npm напрямую через shell
            return (0, child_process_1.spawn)('npm', npmCommand.split(' '), { shell: true, cwd: projectPath });
        }
    }
}
exports.PlatformUtils = PlatformUtils;
PlatformUtils.platform = os.platform();
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGxhdGZvcm0uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9zb3VyY2UvdXRpbHMvcGxhdGZvcm0udHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQTRDO0FBQzVDLHVDQUF5QjtBQUd6QixNQUFhLGFBQWE7SUFHdEI7O09BRUc7SUFDSCxNQUFNLENBQUMsV0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN6QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsU0FBUztRQUNaLE9BQU8sSUFBSSxDQUFDLFFBQVEsS0FBSyxPQUFPLENBQUM7SUFDckMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLE9BQU87UUFDVixPQUFPLElBQUksQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDO0lBQ3RDLENBQUM7SUFFRDs7T0FFRztJQUNILE1BQU0sQ0FBQyxPQUFPO1FBQ1YsT0FBTyxJQUFJLENBQUMsUUFBUSxLQUFLLE9BQU8sQ0FBQztJQUNyQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxNQUFNLENBQUMsa0JBQWtCLENBQUMsUUFBZ0I7UUFDdEMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQztZQUNuQixPQUFPLGFBQWEsUUFBUSxHQUFHLENBQUM7UUFDcEMsQ0FBQzthQUFNLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLENBQUM7WUFDeEIsT0FBTyxTQUFTLFFBQVEsR0FBRyxDQUFDO1FBQ2hDLENBQUM7YUFBTSxDQUFDO1lBQ0osUUFBUTtZQUNSLE9BQU8sYUFBYSxRQUFRLEdBQUcsQ0FBQztRQUNwQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsTUFBTSxDQUFDLGlCQUFpQixDQUFDLEdBQVc7UUFDaEMsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFLEVBQUUsQ0FBQztZQUNuQixPQUFPLGFBQWEsR0FBRyxH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Q0FBQyxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsV0FBVyxFQUFFLENBQUMsQ0FBQztRQUNsRixDQUFDO0lBQ0wsQ0FBQzs7QUFsS0wsc0NBbUtDO0FBbEtrQixzQkFBUSxHQUFHLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHNwYXduLCBleGVjIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XHJcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuXHJcbmV4cG9ydCBjbGFzcyBQbGF0Zm9ybVV0aWxzIHtcclxuICAgIHByaXZhdGUgc3RhdGljIHBsYXRmb3JtID0gb3MucGxhdGZvcm0oKTtcclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0L/RgNC10LTQtdC70Y/QtdGCINGC0LXQutGD0YnRg9GOINC/0LvQsNGC0YTQvtGA0LzRg1xyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZ2V0UGxhdGZvcm0oKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5wbGF0Zm9ybTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0YDQvtCy0LXRgNGP0LXRgiwg0Y/QstC70Y/QtdGC0YHRjyDQu9C4INC/0LvQsNGC0YTQvtGA0LzQsCBXaW5kb3dzXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBpc1dpbmRvd3MoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICd3aW4zMic7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9GA0L7QstC10YDRj9C10YIsINGP0LLQu9GP0LXRgtGB0Y8g0LvQuCDQv9C70LDRgtGE0L7RgNC80LAgbWFjT1NcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGlzTWFjT1MoKTogYm9vbGVhbiB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMucGxhdGZvcm0gPT09ICdkYXJ3aW4nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC+0LLQtdGA0Y/QtdGCLCDRj9Cy0LvRj9C10YLRgdGPINC70Lgg0L/Qu9Cw0YLRhNC+0YDQvNCwIExpbnV4XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBpc0xpbnV4KCk6IGJvb2xlYW4ge1xyXG4gICAgICAgIHJldHVybiB0aGlzLnBsYXRmb3JtID09PSAnbGludXgnO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9Cw0LXRgiDQutC+0LzQsNC90LTRgyDQtNC70Y8g0L7RgtC60YDRi9GC0LjRjyDRhNCw0LnQu9CwINCyINGA0LXQtNCw0LrRgtC+0YDQtSDQv9C+INGD0LzQvtC70YfQsNC90LjRjlxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZ2V0T3BlbkZpbGVDb21tYW5kKGZpbGVQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xyXG4gICAgICAgIGlmICh0aGlzLmlzV2luZG93cygpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBgc3RhcnQgXCJcIiBcIiR7ZmlsZVBhdGh9XCJgO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodGhpcy5pc01hY09TKCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGBvcGVuIFwiJHtmaWxlUGF0aH1cImA7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gTGludXhcclxuICAgICAgICAgICAgcmV0dXJuIGB4ZGctb3BlbiBcIiR7ZmlsZVBhdGh9XCJgO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQsNC10YIg0LrQvtC80LDQvdC00YMg0LTQu9GPINC+0YLQutGA0YvRgtC40Y8gVVJMINCyINCx0YDQsNGD0LfQtdGA0LVcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGdldE9wZW5VcmxDb21tYW5kKHVybDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBpZiAodGhpcy5pc1dpbmRvd3MoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYHN0YXJ0IFwiXCIgXCIke3VybH1cImA7XHJcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmlzTWFjT1MoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYG9wZW4gXCIke3VybH1cImA7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgLy8gTGludXhcclxuICAgICAgICAgICAgcmV0dXJuIGB4ZGctb3BlbiBcIiR7dXJsfVwiYDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LvRg9GH0LDQtdGCINC60L7QvNCw0L3QtNGDINC00LvRjyDRg9C00LDQu9C10L3QuNGPINC/0LDQv9C60LhcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGdldFJlbW92ZURpcmVjdG9yeUNvbW1hbmQoZGlyUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBpZiAodGhpcy5pc1dpbmRvd3MoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYGlmIGV4aXN0IFwiJHtkaXJQYXRofVwiIHJtZGlyIC9zIC9xIFwiJHtkaXJQYXRofVwiYDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBtYWNPUyDQuCBMaW51eFxyXG4gICAgICAgICAgICByZXR1cm4gYHJtIC1yZiBcIiR7ZGlyUGF0aH1cImA7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/QvtC70YPRh9Cw0LXRgiDQutC+0LzQsNC90LTRgyDQtNC70Y8g0L/RgNC+0LLQtdGA0LrQuCDRgdGD0YnQtdGB0YLQstC+0LLQsNC90LjRjyDQv9Cw0L/QutC4XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBnZXRDaGVja0RpcmVjdG9yeUV4aXN0c0NvbW1hbmQoZGlyUGF0aDogc3RyaW5nKTogc3RyaW5nIHtcclxuICAgICAgICBpZiAodGhpcy5pc1dpbmRvd3MoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gYGlmIGV4aXN0IFwiJHtkaXJQYXRofVwiIGVjaG8gZXhpc3RzYDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyBtYWNPUyDQuCBMaW51eFxyXG4gICAgICAgICAgICByZXR1cm4gYHRlc3QgLWQgXCIke2RpclBhdGh9XCIgJiYgZWNobyBleGlzdHNgO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCa0YDQvtGB0YHQv9C70LDRgtGE0L7RgNC80LXQvdC90YvQuSBzcGF3biDQtNC70Y8g0LLRi9C/0L7Qu9C90LXQvdC40Y8g0LrQvtC80LDQvdC0XHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBzcGF3bkNvbW1hbmQoY29tbWFuZDogc3RyaW5nLCBhcmdzOiBzdHJpbmdbXSA9IFtdLCBvcHRpb25zOiBhbnkgPSB7fSk6IGFueSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNXaW5kb3dzKCkpIHtcclxuICAgICAgICAgICAgLy8g0J3QsCBXaW5kb3dzINC40YHQv9C+0LvRjNC30YPQtdC8IGNtZFxyXG4gICAgICAgICAgICByZXR1cm4gc3Bhd24oJ2NtZCcsIFsnL2MnLCBjb21tYW5kLCAuLi5hcmdzXSwgeyBzaGVsbDogdHJ1ZSwgLi4ub3B0aW9ucyB9KTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAvLyDQndCwIG1hY09TINC4IExpbnV4INC40YHQv9C+0LvRjNC30YPQtdC8IHNoIC1jINCx0LXQtyDQtNC+0L/QvtC70L3QuNGC0LXQu9GM0L3QvtCz0L4gc2hlbGw6IHRydWVcclxuICAgICAgICAgICAgY29uc3QgZnVsbENvbW1hbmQgPSBhcmdzLmxlbmd0aCA+IDAgPyBgJHtjb21tYW5kfSAke2FyZ3Muam9pbignICcpfWAgOiBjb21tYW5kO1xyXG4gICAgICAgICAgICByZXR1cm4gc3Bhd24oJ3NoJywgWyctYycsIGZ1bGxDb21tYW5kXSwgb3B0aW9ucyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JrRgNC+0YHRgdC/0LvQsNGC0YTQvtGA0LzQtdC90L3Ri9C5IGV4ZWMg0LTQu9GPINCy0YvQv9C+0LvQvdC10L3QuNGPINC60L7QvNCw0L3QtFxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZXhlY0NvbW1hbmQoY29tbWFuZDogc3RyaW5nLCBjYWxsYmFjaz86IChlcnJvcjogYW55LCBzdGRvdXQ6IHN0cmluZywgc3RkZXJyOiBzdHJpbmcpID0+IHZvaWQpOiBhbnkge1xyXG4gICAgICAgIGlmICh0aGlzLmlzV2luZG93cygpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBleGVjKGBjbWQgL2MgXCIke2NvbW1hbmR9XCJgLCBjYWxsYmFjayk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIGV4ZWMoY29tbWFuZCwgY2FsbGJhY2spO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YLQutGA0YvQstCw0LXRgiDRhNCw0LnQuyDQsiDRgNC10LTQsNC60YLQvtGA0LUg0L/QviDRg9C80L7Qu9GH0LDQvdC40Y5cclxuICAgICAqL1xyXG4gICAgc3RhdGljIG9wZW5GaWxlKGZpbGVQYXRoOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5nZXRPcGVuRmlsZUNvbW1hbmQoZmlsZVBhdGgpO1xyXG4gICAgICAgIHRoaXMuZXhlY0NvbW1hbmQoY29tbWFuZCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQntGC0LrRgNGL0LLQsNC10YIgVVJMINCyINCx0YDQsNGD0LfQtdGA0LVcclxuICAgICAqL1xyXG4gICAgc3RhdGljIG9wZW5VcmwodXJsOiBzdHJpbmcpOiB2b2lkIHtcclxuICAgICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5nZXRPcGVuVXJsQ29tbWFuZCh1cmwpO1xyXG4gICAgICAgIHRoaXMuZXhlY0NvbW1hbmQoY29tbWFuZCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQo9C00LDQu9GP0LXRgiDQv9Cw0L/QutGDXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyByZW1vdmVEaXJlY3RvcnkoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IHRoaXMuZ2V0UmVtb3ZlRGlyZWN0b3J5Q29tbWFuZChkaXJQYXRoKTtcclxuICAgICAgICAgICAgdGhpcy5leGVjQ29tbWFuZChjb21tYW5kLCAoZXJyb3IsIHN0ZG91dCwgc3RkZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICByZWplY3QoZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC+0LLQtdGA0Y/QtdGCINGB0YPRidC10YHRgtCy0L7QstCw0L3QuNC1INC/0LDQv9C60LhcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGNoZWNrRGlyZWN0b3J5RXhpc3RzKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xyXG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gdGhpcy5nZXRDaGVja0RpcmVjdG9yeUV4aXN0c0NvbW1hbmQoZGlyUGF0aCk7XHJcbiAgICAgICAgICAgIHRoaXMuZXhlY0NvbW1hbmQoY29tbWFuZCwgKGVycm9yLCBzdGRvdXQsIHN0ZGVycikgPT4ge1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZShzdGRvdXQuaW5jbHVkZXMoJ2V4aXN0cycpKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQktGL0L/QvtC70L3Rj9C10YIgbnBtINC60L7QvNCw0L3QtNGDXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBydW5OcG1Db21tYW5kKG5wbUNvbW1hbmQ6IHN0cmluZywgcHJvamVjdFBhdGg6IHN0cmluZyk6IGFueSB7XHJcbiAgICAgICAgaWYgKHRoaXMuaXNXaW5kb3dzKCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHNwYXduKCdjbWQnLCBbJy9jJywgJ25wbScsIG5wbUNvbW1hbmRdLCB7IHNoZWxsOiB0cnVlLCBjd2Q6IHByb2plY3RQYXRoIH0pO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIC8vINCd0LAgbWFjT1Mg0LggTGludXgg0LfQsNC/0YPRgdC60LDQtdC8IG5wbSDQvdCw0L/RgNGP0LzRg9GOINGH0LXRgNC10Lcgc2hlbGxcclxuICAgICAgICAgICAgcmV0dXJuIHNwYXduKCducG0nLCBucG1Db21tYW5kLnNwbGl0KCcgJyksIHsgc2hlbGw6IHRydWUsIGN3ZDogcHJvamVjdFBhdGggfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==
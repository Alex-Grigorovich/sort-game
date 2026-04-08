// @ts-ignore
import packageJSON from '../package.json';
/**
 * @en Registration method for the main process of Extension
 * @zh 为扩展的主进程的注册方法
 */
export const methods: { [key: string]: (...any: any) => any } = {
    /**
     * @en A method that can be triggered by message
     * @zh 通过 message 触发的方法
     */
    openPanel() {
        Editor.Panel.open(packageJSON.name);
    },

    /**
     * @en Open file in editor at specific line
     * @zh 在编辑器中打开文件到指定行
     */
    'open-file'(filePath: string, lineNumber: number) {
        try {
            // Используем системную команду для открытия файла
            const { exec } = require('child_process');
            const os = require('os');

            let command: string;
            const platform = os.platform();

            // Пытаемся открыть в VS Code с указанием строки
            command = `code "${filePath}:${lineNumber}"`;

            exec(command, (error: any, stdout: string, stderr: string) => {
                if (error) {
                    // Fallback - просто открываем файл в редакторе по умолчанию
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        let fallbackCommand: string;
                        if (platform === 'win32') {
                            fallbackCommand = `start "" "${filePath}"`;
                        } else if (platform === 'darwin') {
                            fallbackCommand = `open "${filePath}"`;
                        } else {
                            fallbackCommand = `xdg-open "${filePath}"`;
                        }
                        require('child_process').exec(fallbackCommand);
                    }
                }
            });

        } catch (error) {
            // Error opening file
        }
    },
};

/**
 * @en Method Triggered on Extension Startup
 * @zh 扩展启动时触发的方法
 */
export function load() { }

/**
 * @en Method triggered when uninstalling the extension
 * @zh 卸载扩展时触发的方法
 */
export function unload() { }

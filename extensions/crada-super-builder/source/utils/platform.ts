import { spawn, exec } from 'child_process';
import * as os from 'os';
import * as path from 'path';

export class PlatformUtils {
    private static platform = os.platform();

    /**
     * Определяет текущую платформу
     */
    static getPlatform(): string {
        return this.platform;
    }

    /**
     * Проверяет, является ли платформа Windows
     */
    static isWindows(): boolean {
        return this.platform === 'win32';
    }

    /**
     * Проверяет, является ли платформа macOS
     */
    static isMacOS(): boolean {
        return this.platform === 'darwin';
    }

    /**
     * Проверяет, является ли платформа Linux
     */
    static isLinux(): boolean {
        return this.platform === 'linux';
    }

    /**
     * Получает команду для открытия файла в редакторе по умолчанию
     */
    static getOpenFileCommand(filePath: string): string {
        if (this.isWindows()) {
            return `start "" "${filePath}"`;
        } else if (this.isMacOS()) {
            return `open "${filePath}"`;
        } else {
            // Linux
            return `xdg-open "${filePath}"`;
        }
    }

    /**
     * Получает команду для открытия URL в браузере
     */
    static getOpenUrlCommand(url: string): string {
        if (this.isWindows()) {
            return `start "" "${url}"`;
        } else if (this.isMacOS()) {
            return `open "${url}"`;
        } else {
            // Linux
            return `xdg-open "${url}"`;
        }
    }

    /**
     * Получает команду для удаления папки
     */
    static getRemoveDirectoryCommand(dirPath: string): string {
        if (this.isWindows()) {
            return `if exist "${dirPath}" rmdir /s /q "${dirPath}"`;
        } else {
            // macOS и Linux
            return `rm -rf "${dirPath}"`;
        }
    }

    /**
     * Получает команду для проверки существования папки
     */
    static getCheckDirectoryExistsCommand(dirPath: string): string {
        if (this.isWindows()) {
            return `if exist "${dirPath}" echo exists`;
        } else {
            // macOS и Linux
            return `test -d "${dirPath}" && echo exists`;
        }
    }

    /**
     * Кроссплатформенный spawn для выполнения команд
     */
    static spawnCommand(command: string, args: string[] = [], options: any = {}): any {
        if (this.isWindows()) {
            // На Windows используем cmd
            return spawn('cmd', ['/c', command, ...args], { shell: true, ...options });
        } else {
            // На macOS и Linux используем sh -c без дополнительного shell: true
            const fullCommand = args.length > 0 ? `${command} ${args.join(' ')}` : command;
            return spawn('sh', ['-c', fullCommand], options);
        }
    }

    /**
     * Кроссплатформенный exec для выполнения команд
     */
    static execCommand(command: string, callback?: (error: any, stdout: string, stderr: string) => void): any {
        if (this.isWindows()) {
            return exec(`cmd /c "${command}"`, callback);
        } else {
            return exec(command, callback);
        }
    }

    /**
     * Открывает файл в редакторе по умолчанию
     */
    static openFile(filePath: string): void {
        const command = this.getOpenFileCommand(filePath);
        this.execCommand(command);
    }

    /**
     * Открывает URL в браузере
     */
    static openUrl(url: string): void {
        const command = this.getOpenUrlCommand(url);
        this.execCommand(command);
    }

    /**
     * Удаляет папку
     */
    static removeDirectory(dirPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = this.getRemoveDirectoryCommand(dirPath);
            this.execCommand(command, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Проверяет существование папки
     */
    static checkDirectoryExists(dirPath: string): Promise<boolean> {
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
    static runNpmCommand(npmCommand: string, projectPath: string): any {
        if (this.isWindows()) {
            return spawn('cmd', ['/c', 'npm', npmCommand], { shell: true, cwd: projectPath });
        } else {
            // На macOS и Linux запускаем npm напрямую через shell
            return spawn('npm', npmCommand.split(' '), { shell: true, cwd: projectPath });
        }
    }
}

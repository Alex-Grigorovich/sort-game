import { readFileSync, existsSync, copySync, removeSync } from 'fs-extra';
import { join } from 'path';

/**
 * Менеджер для проверки версий и обновления билдера
 */
export class UpdateManager {
    private projectPath: string;
    private toolsBuilderPath: string;
    private projectBuilderPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        
        // Путь к корню CradaPlayablesCocos (поднимаемся на 3 уровня вверх от проекта)
        const rootPath = join(projectPath, '../../../..');
        
        // Путь к билдеру в tools
        this.toolsBuilderPath = join(rootPath, 'tools/builder/extensions/crada-super-builder');
        
        // Путь к билдеру в проекте
        this.projectBuilderPath = join(projectPath, 'extensions/crada-super-builder');

        console.log('UpdateManager инициализирован:', {
            projectPath,
            rootPath,
            toolsBuilderPath: this.toolsBuilderPath,
            projectBuilderPath: this.projectBuilderPath,
            toolsExists: existsSync(this.toolsBuilderPath),
            projectExists: existsSync(this.projectBuilderPath)
        });
    }

    /**
     * Получает версию билдера из package.json
     */
    private getVersion(builderPath: string): string | null {
        try {
            const packageJsonPath = join(builderPath, 'package.json');
            if (!existsSync(packageJsonPath)) {
                return null;
            }
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            return packageJson.version || null;
        } catch (error) {
            console.error('Ошибка при чтении версии:', error);
            return null;
        }
    }

    /**
     * Сравнивает две версии (semver)
     * Возвращает: 1 если version1 > version2, -1 если version1 < version2, 0 если равны
     */
    private compareVersions(version1: string, version2: string): number {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);

        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;

            if (v1part > v2part) return 1;
            if (v1part < v2part) return -1;
        }

        return 0;
    }

    /**
     * Проверяет, есть ли обновление
     * Возвращает true, если версия в tools выше, чем в проекте
     */
    checkForUpdate(): { hasUpdate: boolean; currentVersion: string | null; latestVersion: string | null } {
        const currentVersion = this.getVersion(this.projectBuilderPath);
        const latestVersion = this.getVersion(this.toolsBuilderPath);

        if (!currentVersion || !latestVersion) {
            return {
                hasUpdate: false,
                currentVersion,
                latestVersion
            };
        }

        const hasUpdate = this.compareVersions(latestVersion, currentVersion) > 0;

        return {
            hasUpdate,
            currentVersion,
            latestVersion
        };
    }

    /**
     * Копирует билдер из tools в проект
     */
    async updateBuilder(): Promise<{ success: boolean; error?: string }> {
        try {
            // Проверяем, что билдер в tools существует
            if (!existsSync(this.toolsBuilderPath)) {
                return {
                    success: false,
                    error: `Билдер не найден в tools: ${this.toolsBuilderPath}`
                };
            }

            // Проверяем, что билдер в проекте существует
            if (!existsSync(this.projectBuilderPath)) {
                return {
                    success: false,
                    error: `Билдер не найден в проекте: ${this.projectBuilderPath}`
                };
            }

            // Удаляем старый билдер в проекте
            removeSync(this.projectBuilderPath);

            // Копируем весь билдер из tools в проект (включая node_modules)
            // Исключаем только .git
            copySync(this.toolsBuilderPath, this.projectBuilderPath, {
                overwrite: true,
                filter: (src: string) => {
                    // Исключаем только .git
                    const normalizedSrc = src.replace(/\\/g, '/');
                    const normalizedToolsPath = this.toolsBuilderPath.replace(/\\/g, '/');
                    const relativePath = normalizedSrc.replace(normalizedToolsPath, '').replace(/^\//, '');
                    
                    if (relativePath.includes('.git') || relativePath.startsWith('.git')) {
                        return false;
                    }
                    return true;
                }
            });

            return {
                success: true
            };
        } catch (error: any) {
            return {
                success: false,
                error: error.message || 'Неизвестная ошибка при обновлении'
            };
        }
    }
}

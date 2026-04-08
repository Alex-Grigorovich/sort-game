import { readFileSync, existsSync, copySync, removeSync } from 'fs-extra';
import { join } from 'path';

/**
 * Менеджер для проверки версий и обновления атлас крейтора
 */
export class UpdateManager {
    private projectPath: string;
    private toolsAtlasCreatorPath: string;
    private projectAtlasCreatorPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        
        // Путь к корню CradaPlayablesCocos (поднимаемся на 3 уровня вверх от проекта)
        const rootPath = join(projectPath, '../../../..');
        
        // Путь к атлас крейтору в tools
        this.toolsAtlasCreatorPath = join(rootPath, 'tools/atlas creator/extensions/crada_atlas_creator');
        
        // Путь к атлас крейтору в проекте
        this.projectAtlasCreatorPath = join(projectPath, 'extensions/crada_atlas_creator');

        console.log('UpdateManager инициализирован:', {
            projectPath,
            rootPath,
            toolsAtlasCreatorPath: this.toolsAtlasCreatorPath,
            projectAtlasCreatorPath: this.projectAtlasCreatorPath,
            toolsExists: existsSync(this.toolsAtlasCreatorPath),
            projectExists: existsSync(this.projectAtlasCreatorPath)
        });
    }

    /**
     * Получает версию атлас крейтора из package.json
     */
    private getVersion(atlasCreatorPath: string): string | null {
        try {
            const packageJsonPath = join(atlasCreatorPath, 'package.json');
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
        const currentVersion = this.getVersion(this.projectAtlasCreatorPath);
        const latestVersion = this.getVersion(this.toolsAtlasCreatorPath);

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
     * Копирует атлас крейтор из tools в проект
     */
    async updateAtlasCreator(): Promise<{ success: boolean; error?: string }> {
        try {
            // Проверяем, что атлас крейтор в tools существует
            if (!existsSync(this.toolsAtlasCreatorPath)) {
                return {
                    success: false,
                    error: `Атлас крейтор не найден в tools: ${this.toolsAtlasCreatorPath}`
                };
            }

            // Проверяем, что атлас крейтор в проекте существует
            if (!existsSync(this.projectAtlasCreatorPath)) {
                return {
                    success: false,
                    error: `Атлас крейтор не найден в проекте: ${this.projectAtlasCreatorPath}`
                };
            }

            // Удаляем старый атлас крейтор в проекте
            removeSync(this.projectAtlasCreatorPath);

            // Копируем весь атлас крейтор из tools в проект (включая node_modules)
            // Исключаем только .git
            copySync(this.toolsAtlasCreatorPath, this.projectAtlasCreatorPath, {
                overwrite: true,
                filter: (src: string) => {
                    // Исключаем только .git
                    const normalizedSrc = src.replace(/\\/g, '/');
                    const normalizedToolsPath = this.toolsAtlasCreatorPath.replace(/\\/g, '/');
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

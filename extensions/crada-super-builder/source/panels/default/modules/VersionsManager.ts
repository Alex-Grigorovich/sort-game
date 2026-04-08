import { existsSync } from 'fs-extra';
import { join } from 'path';

/**
 * Класс для управления версиями проекта
 */
export class VersionsManager {
    private projectPath: string;
    private versionsPath: string;

    constructor(projectPath: string) {
        this.projectPath = projectPath;
        this.versionsPath = join(projectPath, 'versions.cjs');
    }

    /**
     * Загружает и обрабатывает файл versions.cjs
     */
    loadVersions(): any[] {
        if (!existsSync(this.versionsPath)) {
            return [];
        }

        try {

            // Загружаем файл versions.cjs
            const versionsData = require(this.versionsPath);

            // Фильтруем валидные версии (как в оригинальном коде)
            const validVersions = versionsData.filter((v: any) =>
                typeof v === 'object' && v !== null && 'name' in v
            );

            return validVersions;
        } catch (error) {
            return [];
        }
    }

    /**
     * Загружает хранилище переменных из versions.cjs
     */
    loadVariablesStorage(): { [key: string]: any } {
        if (!existsSync(this.versionsPath)) {
            return {};
        }

        try {
            // Загружаем файл versions.cjs
            const versionsData = require(this.versionsPath);
            
            // Проверяем наличие хранилища переменных
            if (versionsData.variables && typeof versionsData.variables === 'object') {
                return { ...versionsData.variables };
            }

            return {};
        } catch (error) {
            return {};
        }
    }

    /**
     * Загружает имя выбранной версии из versions.cjs
     */
    loadSelectedVersion(): string | null {
        if (!existsSync(this.versionsPath)) {
            return null;
        }

        try {
            // Загружаем файл versions.cjs
            const versionsData = require(this.versionsPath);
            
            // Проверяем наличие selectedVersion
            if (versionsData.selectedVersion && typeof versionsData.selectedVersion === 'string') {
                return versionsData.selectedVersion;
            }

            return null;
        } catch (error) {
            return null;
        }
    }
}

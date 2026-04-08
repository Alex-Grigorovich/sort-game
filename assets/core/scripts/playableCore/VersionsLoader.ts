import playableCore from './playableCore';

/**
 * Класс для загрузки выбранной версии из versions.cjs в не прод режиме
 */
export class VersionsLoader {
    /**
     * Загружает выбранную версию из versions.cjs
     * @returns true если версия успешно загружена, false в противном случае
     */
    static loadSelectedVersion(): boolean {
        try {
            //@ts-ignore
            if (typeof require === 'undefined') {
                return false;
            }
            
            // Пробуем получить абсолютный путь к проекту
            //@ts-ignore
            let projectPath = null;
            //@ts-ignore
            if (typeof Editor !== 'undefined' && Editor.Project && Editor.Project.path) {
                //@ts-ignore
                projectPath = Editor.Project.path;
            }
            //@ts-ignore
            if (!projectPath && typeof Editor !== 'undefined' && Editor.assetdb && Editor.assetdb._projectRoot) {
                //@ts-ignore
                projectPath = Editor.assetdb._projectRoot;
            }
            //@ts-ignore
            if (!projectPath && typeof process !== 'undefined' && process.cwd) {
                //@ts-ignore
                projectPath = process.cwd();
            }
            
            const possiblePaths: string[] = [];
            
            // Если получили путь к проекту, используем абсолютный путь
            if (projectPath) {
                try {
                    //@ts-ignore
                    const path = require('path');
                    const versionsPath = path.join(projectPath, 'versions.cjs');
                    possiblePaths.push(versionsPath);
                } catch (e) {
                    // Игнорируем ошибку
                }
            }
            
            // Также пробуем относительные пути (на случай если абсолютный не сработает)
            possiblePaths.push(
                '../../versions.cjs',
                '../../../versions.cjs',
                '../../../../versions.cjs',
                '../../../../../versions.cjs',
                'versions.cjs'
            );
            
            // Пробуем загрузить versions.cjs
            let versionsData = null;
            
            for (const path of possiblePaths) {
                try {
                    //@ts-ignore
                    versionsData = require(path);
                    if (versionsData) {
                        break;
                    }
                } catch (e: any) {
                    // Пробуем следующий путь
                    continue;
                }
            }
            
            if (versionsData) {
                // Загружаем выбранную версию в window.playableCore.version
                playableCore.loadSelectedVersion(versionsData);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            return false;
        }
    }
}

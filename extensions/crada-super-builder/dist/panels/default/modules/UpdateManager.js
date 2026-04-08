"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateManager = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
/**
 * Менеджер для проверки версий и обновления билдера
 */
class UpdateManager {
    constructor(projectPath) {
        this.projectPath = projectPath;
        // Путь к корню CradaPlayablesCocos (поднимаемся на 3 уровня вверх от проекта)
        const rootPath = (0, path_1.join)(projectPath, '../../../..');
        // Путь к билдеру в tools
        this.toolsBuilderPath = (0, path_1.join)(rootPath, 'tools/builder/extensions/crada-super-builder');
        // Путь к билдеру в проекте
        this.projectBuilderPath = (0, path_1.join)(projectPath, 'extensions/crada-super-builder');
        console.log('UpdateManager инициализирован:', {
            projectPath,
            rootPath,
            toolsBuilderPath: this.toolsBuilderPath,
            projectBuilderPath: this.projectBuilderPath,
            toolsExists: (0, fs_extra_1.existsSync)(this.toolsBuilderPath),
            projectExists: (0, fs_extra_1.existsSync)(this.projectBuilderPath)
        });
    }
    /**
     * Получает версию билдера из package.json
     */
    getVersion(builderPath) {
        try {
            const packageJsonPath = (0, path_1.join)(builderPath, 'package.json');
            if (!(0, fs_extra_1.existsSync)(packageJsonPath)) {
                return null;
            }
            const packageJson = JSON.parse((0, fs_extra_1.readFileSync)(packageJsonPath, 'utf-8'));
            return packageJson.version || null;
        }
        catch (error) {
            console.error('Ошибка при чтении версии:', error);
            return null;
        }
    }
    /**
     * Сравнивает две версии (semver)
     * Возвращает: 1 если version1 > version2, -1 если version1 < version2, 0 если равны
     */
    compareVersions(version1, version2) {
        const v1parts = version1.split('.').map(Number);
        const v2parts = version2.split('.').map(Number);
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const v1part = v1parts[i] || 0;
            const v2part = v2parts[i] || 0;
            if (v1part > v2part)
                return 1;
            if (v1part < v2part)
                return -1;
        }
        return 0;
    }
    /**
     * Проверяет, есть ли обновление
     * Возвращает true, если версия в tools выше, чем в проекте
     */
    checkForUpdate() {
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
    async updateBuilder() {
        try {
            // Проверяем, что билдер в tools существует
            if (!(0, fs_extra_1.existsSync)(this.toolsBuilderPath)) {
                return {
                    success: false,
                    error: `Билдер не найден в tools: ${this.toolsBuilderPath}`
                };
            }
            // Проверяем, что билдер в проекте существует
            if (!(0, fs_extra_1.existsSync)(this.projectBuilderPath)) {
                return {
                    success: false,
                    error: `Билдер не найден в проекте: ${this.projectBuilderPath}`
                };
            }
            // Удаляем старый билдер в проекте
            (0, fs_extra_1.removeSync)(this.projectBuilderPath);
            // Копируем весь билдер из tools в проект (включая node_modules)
            // Исключаем только .git
            (0, fs_extra_1.copySync)(this.toolsBuilderPath, this.projectBuilderPath, {
                overwrite: true,
                filter: (src) => {
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
        }
        catch (error) {
            return {
                success: false,
                error: error.message || 'Неизвестная ошибка при обновлении'
            };
        }
    }
}
exports.UpdateManager = UpdateManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVXBkYXRlTWFuYWdlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3NvdXJjZS9wYW5lbHMvZGVmYXVsdC9tb2R1bGVzL1VwZGF0ZU1hbmFnZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsdUNBQTBFO0FBQzFFLCtCQUE0QjtBQUU1Qjs7R0FFRztBQUNILE1BQWEsYUFBYTtJQUt0QixZQUFZLFdBQW1CO1FBQzNCLElBQUksQ0FBQyxXQUFXLEdBQUcsV0FBVyxDQUFDO1FBRS9CLDhFQUE4RTtRQUM5RSxNQUFNLFFBQVEsR0FBRyxJQUFBLFdBQUksRUFBQyxXQUFXLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFbEQseUJBQXlCO1FBQ3pCLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFBLFdBQUksRUFBQyxRQUFRLEVBQUUsOENBQThDLENBQUMsQ0FBQztRQUV2RiwyQkFBMkI7UUFDM0IsSUFBSSxDQUFDLGtCQUFrQixHQUFHLElBQUEsV0FBSSxFQUFDLFdBQVcsRUFBRSxnQ0FBZ0MsQ0FBQyxDQUFDO1FBRTlFLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0NBQWdDLEVBQUU7WUFDMUMsV0FBVztZQUNYLFFBQVE7WUFDUixnQkFBZ0IsRUFBRSxJQUFJLENBQUMsZ0JBQWdCO1lBQ3ZDLGtCQUFrQixFQUFFLElBQUksQ0FBQyxrQkFBa0I7WUFDM0MsV0FBVyxFQUFFLElBQUEscUJBQVUsRUFBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7WUFDOUMsYUFBYSxFQUFFLElBQUEscUJBQVUsRUFBQyxJQUFJLENBQUMsa0JBQWtCLENBQUM7U0FDckQsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVEOztPQUVHO0lBQ0ssVUFBVSxDQUFDLFdBQW1CO1FBQ2xDLElBQUksQ0FBQztZQUNELE1BQU0sZUFBZSxHQUFHLElBQUEsV0FBSSxFQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUMxRCxJQUFJLENBQUMsSUFBQSxxQkFBVSxFQUFD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O1lBQ3hCLElBQUEsbUJBQVEsRUFBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUNyRCxTQUFTLEVBQUUsSUFBSTtnQkFDZixNQUFNLEVBQUUsQ0FBQyxHQUFXLEVBQUUsRUFBRTtvQkFDcEIsd0JBQXdCO29CQUN4QixNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDOUMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztvQkFDdEUsTUFBTSxZQUFZLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO29CQUV2RixJQUFJLFlBQVksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksWUFBWSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO3dCQUNuRSxPQUFPLEtBQUssQ0FBQztvQkFDakIsQ0FBQztvQkFDRCxPQUFPLElBQUksQ0FBQztnQkFDaEIsQ0FBQzthQUNKLENBQUMsQ0FBQztZQUVILE9BQU87Z0JBQ0gsT0FBTyxFQUFFLElBQUk7YUFDaEIsQ0FBQztRQUNOLENBQUM7UUFBQyxPQUFPLEtBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksbUNBQW1DO2FBQzlELENBQUM7UUFDTixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBM0lELHNDQTJJQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYywgZXhpc3RzU3luYywgY29weVN5bmMsIHJlbW92ZVN5bmMgfSBmcm9tICdmcy1leHRyYSc7XHJcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcclxuXHJcbi8qKlxyXG4gKiDQnNC10L3QtdC00LbQtdGAINC00LvRjyDQv9GA0L7QstC10YDQutC4INCy0LXRgNGB0LjQuSDQuCDQvtCx0L3QvtCy0LvQtdC90LjRjyDQsdC40LvQtNC10YDQsFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFVwZGF0ZU1hbmFnZXIge1xyXG4gICAgcHJpdmF0ZSBwcm9qZWN0UGF0aDogc3RyaW5nO1xyXG4gICAgcHJpdmF0ZSB0b29sc0J1aWxkZXJQYXRoOiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIHByb2plY3RCdWlsZGVyUGF0aDogc3RyaW5nO1xyXG5cclxuICAgIGNvbnN0cnVjdG9yKHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLnByb2plY3RQYXRoID0gcHJvamVjdFBhdGg7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8g0J/Rg9GC0Ywg0Log0LrQvtGA0L3RjiBDcmFkYVBsYXlhYmxlc0NvY29zICjQv9C+0LTQvdC40LzQsNC10LzRgdGPINC90LAgMyDRg9GA0L7QstC90Y8g0LLQstC10YDRhSDQvtGCINC/0YDQvtC10LrRgtCwKVxyXG4gICAgICAgIGNvbnN0IHJvb3RQYXRoID0gam9pbihwcm9qZWN0UGF0aCwgJy4uLy4uLy4uLy4uJyk7XHJcbiAgICAgICAgXHJcbiAgICAgICAgLy8g0J/Rg9GC0Ywg0Log0LHQuNC70LTQtdGA0YMg0LIgdG9vbHNcclxuICAgICAgICB0aGlzLnRvb2xzQnVpbGRlclBhdGggPSBqb2luKHJvb3RQYXRoLCAndG9vbHMvYnVpbGRlci9leHRlbnNpb25zL2NyYWRhLXN1cGVyLWJ1aWxkZXInKTtcclxuICAgICAgICBcclxuICAgICAgICAvLyDQn9GD0YLRjCDQuiDQsdC40LvQtNC10YDRgyDQsiDQv9GA0L7QtdC60YLQtVxyXG4gICAgICAgIHRoaXMucHJvamVjdEJ1aWxkZXJQYXRoID0gam9pbihwcm9qZWN0UGF0aCwgJ2V4dGVuc2lvbnMvY3JhZGEtc3VwZXItYnVpbGRlcicpO1xyXG5cclxuICAgICAgICBjb25zb2xlLmxvZygnVXBkYXRlTWFuYWdlciDQuNC90LjRhtC40LDQu9C40LfQuNGA0L7QstCw0L06Jywge1xyXG4gICAgICAgICAgICBwcm9qZWN0UGF0aCxcclxuICAgICAgICAgICAgcm9vdFBhdGgsXHJcbiAgICAgICAgICAgIHRvb2xzQnVpbGRlclBhdGg6IHRoaXMudG9vbHNCdWlsZGVyUGF0aCxcclxuICAgICAgICAgICAgcHJvamVjdEJ1aWxkZXJQYXRoOiB0aGlzLnByb2plY3RCdWlsZGVyUGF0aCxcclxuICAgICAgICAgICAgdG9vbHNFeGlzdHM6IGV4aXN0c1N5bmModGhpcy50b29sc0J1aWxkZXJQYXRoKSxcclxuICAgICAgICAgICAgcHJvamVjdEV4aXN0czogZXhpc3RzU3luYyh0aGlzLnByb2plY3RCdWlsZGVyUGF0aClcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQsNC10YIg0LLQtdGA0YHQuNGOINCx0LjQu9C00LXRgNCwINC40LcgcGFja2FnZS5qc29uXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgZ2V0VmVyc2lvbihidWlsZGVyUGF0aDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZUpzb25QYXRoID0gam9pbihidWlsZGVyUGF0aCwgJ3BhY2thZ2UuanNvbicpO1xyXG4gICAgICAgICAgICBpZiAoIWV4aXN0c1N5bmMocGFja2FnZUpzb25QYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKHJlYWRGaWxlU3luYyhwYWNrYWdlSnNvblBhdGgsICd1dGYtOCcpKTtcclxuICAgICAgICAgICAgcmV0dXJuIHBhY2thZ2VKc29uLnZlcnNpb24gfHwgbnVsbDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCfQntGI0LjQsdC60LAg0L/RgNC4INGH0YLQtdC90LjQuCDQstC10YDRgdC40Lg6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQodGA0LDQstC90LjQstCw0LXRgiDQtNCy0LUg0LLQtdGA0YHQuNC4IChzZW12ZXIpXHJcbiAgICAgKiDQktC+0LfQstGA0LDRidCw0LXRgjogMSDQtdGB0LvQuCB2ZXJzaW9uMSA+IHZlcnNpb24yLCAtMSDQtdGB0LvQuCB2ZXJzaW9uMSA8IHZlcnNpb24yLCAwINC10YHQu9C4INGA0LDQstC90YtcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBjb21wYXJlVmVyc2lvbnModmVyc2lvbjE6IHN0cmluZywgdmVyc2lvbjI6IHN0cmluZyk6IG51bWJlciB7XHJcbiAgICAgICAgY29uc3QgdjFwYXJ0cyA9IHZlcnNpb24xLnNwbGl0KCcuJykubWFwKE51bWJlcik7XHJcbiAgICAgICAgY29uc3QgdjJwYXJ0cyA9IHZlcnNpb24yLnNwbGl0KCcuJykubWFwKE51bWJlcik7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgTWF0aC5tYXgodjFwYXJ0cy5sZW5ndGgsIHYycGFydHMubGVuZ3RoKTsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHYxcGFydCA9IHYxcGFydHNbaV0gfHwgMDtcclxuICAgICAgICAgICAgY29uc3QgdjJwYXJ0ID0gdjJwYXJ0c1tpXSB8fCAwO1xyXG5cclxuICAgICAgICAgICAgaWYgKHYxcGFydCA+IHYycGFydCkgcmV0dXJuIDE7XHJcbiAgICAgICAgICAgIGlmICh2MXBhcnQgPCB2MnBhcnQpIHJldHVybiAtMTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHJldHVybiAwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC+0LLQtdGA0Y/QtdGCLCDQtdGB0YLRjCDQu9C4INC+0LHQvdC+0LLQu9C10L3QuNC1XHJcbiAgICAgKiDQktC+0LfQstGA0LDRidCw0LXRgiB0cnVlLCDQtdGB0LvQuCDQstC10YDRgdC40Y8g0LIgdG9vbHMg0LLRi9GI0LUsINGH0LXQvCDQsiDQv9GA0L7QtdC60YLQtVxyXG4gICAgICovXHJcbiAgICBjaGVja0ZvclVwZGF0ZSgpOiB7IGhhc1VwZGF0ZTogYm9vbGVhbjsgY3VycmVudFZlcnNpb246IHN0cmluZyB8IG51bGw7IGxhdGVzdFZlcnNpb246IHN0cmluZyB8IG51bGwgfSB7XHJcbiAgICAgICAgY29uc3QgY3VycmVudFZlcnNpb24gPSB0aGlzLmdldFZlcnNpb24odGhpcy5wcm9qZWN0QnVpbGRlclBhdGgpO1xyXG4gICAgICAgIGNvbnN0IGxhdGVzdFZlcnNpb24gPSB0aGlzLmdldFZlcnNpb24odGhpcy50b29sc0J1aWxkZXJQYXRoKTtcclxuXHJcbiAgICAgICAgaWYgKCFjdXJyZW50VmVyc2lvbiB8fCAhbGF0ZXN0VmVyc2lvbikge1xyXG4gICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgaGFzVXBkYXRlOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGN1cnJlbnRWZXJzaW9uLFxyXG4gICAgICAgICAgICAgICAgbGF0ZXN0VmVyc2lvblxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgaGFzVXBkYXRlID0gdGhpcy5jb21wYXJlVmVyc2lvbnMobGF0ZXN0VmVyc2lvbiwgY3VycmVudFZlcnNpb24pID4gMDtcclxuXHJcbiAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgaGFzVXBkYXRlLFxyXG4gICAgICAgICAgICBjdXJyZW50VmVyc2lvbixcclxuICAgICAgICAgICAgbGF0ZXN0VmVyc2lvblxyXG4gICAgICAgIH07XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQmtC+0L/QuNGA0YPQtdGCINCx0LjQu9C00LXRgCDQuNC3IHRvb2xzINCyINC/0YDQvtC10LrRglxyXG4gICAgICovXHJcbiAgICBhc3luYyB1cGRhdGVCdWlsZGVyKCk6IFByb21pc2U8eyBzdWNjZXNzOiBib29sZWFuOyBlcnJvcj86IHN0cmluZyB9PiB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8LCDRh9GC0L4g0LHQuNC70LTQtdGAINCyIHRvb2xzINGB0YPRidC10YHRgtCy0YPQtdGCXHJcbiAgICAgICAgICAgIGlmICghZXhpc3RzU3luYyh0aGlzLnRvb2xzQnVpbGRlclBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxyXG4gICAgICAgICAgICAgICAgICAgIGVycm9yOiBg0JHQuNC70LTQtdGAINC90LUg0L3QsNC50LTQtdC9INCyIHRvb2xzOiAke3RoaXMudG9vbHNCdWlsZGVyUGF0aH1gXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINGH0YLQviDQsdC40LvQtNC10YAg0LIg0L/RgNC+0LXQutGC0LUg0YHRg9GJ0LXRgdGC0LLRg9C10YJcclxuICAgICAgICAgICAgaWYgKCFleGlzdHNTeW5jKHRoaXMucHJvamVjdEJ1aWxkZXJQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgICAgICBlcnJvcjogYNCR0LjQu9C00LXRgCDQvdC1INC90LDQudC00LXQvSDQsiDQv9GA0L7QtdC60YLQtTogJHt0aGlzLnByb2plY3RCdWlsZGVyUGF0aH1gXHJcbiAgICAgICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDQo9C00LDQu9GP0LXQvCDRgdGC0LDRgNGL0Lkg0LHQuNC70LTQtdGAINCyINC/0YDQvtC10LrRgtC1XHJcbiAgICAgICAgICAgIHJlbW92ZVN5bmModGhpcy5wcm9qZWN0QnVpbGRlclBhdGgpO1xyXG5cclxuICAgICAgICAgICAgLy8g0JrQvtC/0LjRgNGD0LXQvCDQstC10YHRjCDQsdC40LvQtNC10YAg0LjQtyB0b29scyDQsiDQv9GA0L7QtdC60YIgKNCy0LrQu9GO0YfQsNGPIG5vZGVfbW9kdWxlcylcclxuICAgICAgICAgICAgLy8g0JjRgdC60LvRjtGH0LDQtdC8INGC0L7Qu9GM0LrQviAuZ2l0XHJcbiAgICAgICAgICAgIGNvcHlTeW5jKHRoaXMudG9vbHNCdWlsZGVyUGF0aCwgdGhpcy5wcm9qZWN0QnVpbGRlclBhdGgsIHtcclxuICAgICAgICAgICAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcclxuICAgICAgICAgICAgICAgIGZpbHRlcjogKHNyYzogc3RyaW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JjRgdC60LvRjtGH0LDQtdC8INGC0L7Qu9GM0LrQviAuZ2l0XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFNyYyA9IHNyYy5yZXBsYWNlKC9cXFxcL2csICcvJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3Qgbm9ybWFsaXplZFRvb2xzUGF0aCA9IHRoaXMudG9vbHNCdWlsZGVyUGF0aC5yZXBsYWNlKC9cXFxcL2csICcvJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgcmVsYXRpdmVQYXRoID0gbm9ybWFsaXplZFNyYy5yZXBsYWNlKG5vcm1hbGl6ZWRUb29sc1BhdGgsICcnKS5yZXBsYWNlKC9eXFwvLywgJycpO1xyXG4gICAgICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChyZWxhdGl2ZVBhdGguaW5jbHVkZXMoJy5naXQnKSB8fCByZWxhdGl2ZVBhdGguc3RhcnRzV2l0aCgnLmdpdCcpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgcmV0dXJuIHtcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWVcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcclxuICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvci5tZXNzYWdlIHx8ICfQndC10LjQt9Cy0LXRgdGC0L3QsNGPINC+0YjQuNCx0LrQsCDQv9GA0Lgg0L7QsdC90L7QstC70LXQvdC40LgnXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==
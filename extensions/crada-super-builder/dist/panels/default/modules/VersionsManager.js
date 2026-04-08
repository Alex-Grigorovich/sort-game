"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionsManager = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
/**
 * Класс для управления версиями проекта
 */
class VersionsManager {
    constructor(projectPath) {
        this.projectPath = projectPath;
        this.versionsPath = (0, path_1.join)(projectPath, 'versions.cjs');
    }
    /**
     * Загружает и обрабатывает файл versions.cjs
     */
    loadVersions() {
        if (!(0, fs_extra_1.existsSync)(this.versionsPath)) {
            return [];
        }
        try {
            // Загружаем файл versions.cjs
            const versionsData = require(this.versionsPath);
            // Фильтруем валидные версии (как в оригинальном коде)
            const validVersions = versionsData.filter((v) => typeof v === 'object' && v !== null && 'name' in v);
            return validVersions;
        }
        catch (error) {
            return [];
        }
    }
    /**
     * Загружает хранилище переменных из versions.cjs
     */
    loadVariablesStorage() {
        if (!(0, fs_extra_1.existsSync)(this.versionsPath)) {
            return {};
        }
        try {
            // Загружаем файл versions.cjs
            const versionsData = require(this.versionsPath);
            // Проверяем наличие хранилища переменных
            if (versionsData.variables && typeof versionsData.variables === 'object') {
                return Object.assign({}, versionsData.variables);
            }
            return {};
        }
        catch (error) {
            return {};
        }
    }
    /**
     * Загружает имя выбранной версии из versions.cjs
     */
    loadSelectedVersion() {
        if (!(0, fs_extra_1.existsSync)(this.versionsPath)) {
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
        }
        catch (error) {
            return null;
        }
    }
}
exports.VersionsManager = VersionsManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVmVyc2lvbnNNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L21vZHVsZXMvVmVyc2lvbnNNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLHVDQUFzQztBQUN0QywrQkFBNEI7QUFFNUI7O0dBRUc7QUFDSCxNQUFhLGVBQWU7SUFJeEIsWUFBWSxXQUFtQjtRQUMzQixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztRQUMvQixJQUFJLENBQUMsWUFBWSxHQUFHLElBQUEsV0FBSSxFQUFDLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZO1FBQ1IsSUFBSSxDQUFDLElBQUEscUJBQVUsRUFBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLEVBQUUsQ0FBQztRQUNkLENBQUM7UUFFRCxJQUFJLENBQUM7WUFFRCw4QkFBOEI7WUFDOUIsTUFBTSxZQUFZLEdBQUcsT0FBTyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVoRCxzREFBc0Q7WUFDdEQsTUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQU0sRUFBRSxFQUFFLENBQ2pELE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLE1BQU0sSUFBSSxDQUFDLENBQ3JELENBQUM7WUFFRixPQUFPLGFBQWEsQ0FBQztRQUN6QixDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sRUFBRSxDQUFDO1FBQ2QsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILG9CQUFvQjtRQUNoQixJQUFJLENBQUMsSUFBQSxxQkFBVSxFQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDO1lBQ2pDLE9BQU8sRUFBRSxDQUFDO1FBQ2QsQ0FBQztRQUVELElBQUksQ0FBQztZQUNELDhCQUE4QjtZQUM5QixNQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRWhELHlDQUF5QztZQUN6QyxJQUFJLFlBQVksQ0FBQyxTQUFTLElBQUksT0FBTyxZQUFZLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO2dCQUN2RSx5QkFBWSxZQUFZLENBQUMsU0FBUyxFQUFHO1lBQ3pDLENBQUM7WUFFRCxPQUFPLEVBQUUsQ0FBQztRQUNkLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsT0FBTyxFQUFFLENBQUM7UUFDZCxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gsbUJBQW1CO1FBQ2YsSUFBSSxDQUFDLElBQUEscUJBQVUsRUFBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQztZQUNqQyxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0QsOEJBQThCO1lBQzlCLE1BQU0sWUFBWSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFFaEQsb0NBQW9DO1lBQ3BDLElBQUksWUFBWSxDQUFDLGVBQWUsSUFBSSxPQUFPLFlBQVksQ0FBQyxlQUFlLEtBQUssUUFBUSxFQUFFLENBQUM7Z0JBQ25GLE9BQU8sWUFBWSxDQUFDLGVBQWUsQ0FBQztZQUN4QyxDQUFDO1lBRUQsT0FBTyxJQUFJLENBQUM7UUFDaEIsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO0lBQ0wsQ0FBQztDQUNKO0FBOUVELDBDQThFQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IGV4aXN0c1N5bmMgfSBmcm9tICdmcy1leHRyYSc7XHJcbmltcG9ydCB7IGpvaW4gfSBmcm9tICdwYXRoJztcclxuXHJcbi8qKlxyXG4gKiDQmtC70LDRgdGBINC00LvRjyDRg9C/0YDQsNCy0LvQtdC90LjRjyDQstC10YDRgdC40Y/QvNC4INC/0YDQvtC10LrRgtCwXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgVmVyc2lvbnNNYW5hZ2VyIHtcclxuICAgIHByaXZhdGUgcHJvamVjdFBhdGg6IHN0cmluZztcclxuICAgIHByaXZhdGUgdmVyc2lvbnNQYXRoOiBzdHJpbmc7XHJcblxyXG4gICAgY29uc3RydWN0b3IocHJvamVjdFBhdGg6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMucHJvamVjdFBhdGggPSBwcm9qZWN0UGF0aDtcclxuICAgICAgICB0aGlzLnZlcnNpb25zUGF0aCA9IGpvaW4ocHJvamVjdFBhdGgsICd2ZXJzaW9ucy5janMnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCX0LDQs9GA0YPQttCw0LXRgiDQuCDQvtCx0YDQsNCx0LDRgtGL0LLQsNC10YIg0YTQsNC50LsgdmVyc2lvbnMuY2pzXHJcbiAgICAgKi9cclxuICAgIGxvYWRWZXJzaW9ucygpOiBhbnlbXSB7XHJcbiAgICAgICAgaWYgKCFleGlzdHNTeW5jKHRoaXMudmVyc2lvbnNQYXRoKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG5cclxuICAgICAgICAgICAgLy8g0JfQsNCz0YDRg9C20LDQtdC8INGE0LDQudC7IHZlcnNpb25zLmNqc1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uc0RhdGEgPSByZXF1aXJlKHRoaXMudmVyc2lvbnNQYXRoKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCk0LjQu9GM0YLRgNGD0LXQvCDQstCw0LvQuNC00L3Ri9C1INCy0LXRgNGB0LjQuCAo0LrQsNC6INCyINC+0YDQuNCz0LjQvdCw0LvRjNC90L7QvCDQutC+0LTQtSlcclxuICAgICAgICAgICAgY29uc3QgdmFsaWRWZXJzaW9ucyA9IHZlcnNpb25zRGF0YS5maWx0ZXIoKHY6IGFueSkgPT5cclxuICAgICAgICAgICAgICAgIHR5cGVvZiB2ID09PSAnb2JqZWN0JyAmJiB2ICE9PSBudWxsICYmICduYW1lJyBpbiB2XHJcbiAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gdmFsaWRWZXJzaW9ucztcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICByZXR1cm4gW107XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0JfQsNCz0YDRg9C20LDQtdGCINGF0YDQsNC90LjQu9C40YnQtSDQv9C10YDQtdC80LXQvdC90YvRhSDQuNC3IHZlcnNpb25zLmNqc1xyXG4gICAgICovXHJcbiAgICBsb2FkVmFyaWFibGVzU3RvcmFnZSgpOiB7IFtrZXk6IHN0cmluZ106IGFueSB9IHtcclxuICAgICAgICBpZiAoIWV4aXN0c1N5bmModGhpcy52ZXJzaW9uc1BhdGgpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB7fTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vINCX0LDQs9GA0YPQttCw0LXQvCDRhNCw0LnQuyB2ZXJzaW9ucy5janNcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbnNEYXRhID0gcmVxdWlyZSh0aGlzLnZlcnNpb25zUGF0aCk7XHJcbiAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0YXRgNCw0L3QuNC70LjRidCwINC/0LXRgNC10LzQtdC90L3Ri9GFXHJcbiAgICAgICAgICAgIGlmICh2ZXJzaW9uc0RhdGEudmFyaWFibGVzICYmIHR5cGVvZiB2ZXJzaW9uc0RhdGEudmFyaWFibGVzID09PSAnb2JqZWN0Jykge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHsgLi4udmVyc2lvbnNEYXRhLnZhcmlhYmxlcyB9O1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4ge307XHJcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHt9O1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCX0LDQs9GA0YPQttCw0LXRgiDQuNC80Y8g0LLRi9Cx0YDQsNC90L3QvtC5INCy0LXRgNGB0LjQuCDQuNC3IHZlcnNpb25zLmNqc1xyXG4gICAgICovXHJcbiAgICBsb2FkU2VsZWN0ZWRWZXJzaW9uKCk6IHN0cmluZyB8IG51bGwge1xyXG4gICAgICAgIGlmICghZXhpc3RzU3luYyh0aGlzLnZlcnNpb25zUGF0aCkpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAvLyDQl9Cw0LPRgNGD0LbQsNC10Lwg0YTQsNC50LsgdmVyc2lvbnMuY2pzXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25zRGF0YSA9IHJlcXVpcmUodGhpcy52ZXJzaW9uc1BhdGgpO1xyXG4gICAgICAgICAgICBcclxuICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8INC90LDQu9C40YfQuNC1IHNlbGVjdGVkVmVyc2lvblxyXG4gICAgICAgICAgICBpZiAodmVyc2lvbnNEYXRhLnNlbGVjdGVkVmVyc2lvbiAmJiB0eXBlb2YgdmVyc2lvbnNEYXRhLnNlbGVjdGVkVmVyc2lvbiA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB2ZXJzaW9uc0RhdGEuc2VsZWN0ZWRWZXJzaW9uO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcbn1cclxuIl19
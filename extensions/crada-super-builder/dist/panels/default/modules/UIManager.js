"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIManager = void 0;
const path_1 = require("path");
const child_process_1 = require("child_process");
/**
 * Класс для управления UI элементами
 */
class UIManager {
    constructor(elements, projectPath) {
        this.eventListenersAdded = false;
        this.elements = elements;
        this.projectPath = projectPath;
    }
    /**
     * Устанавливает callback функции
     */
    setCallbacks(callbacks) {
        this.onBuildTrigger = callbacks.onBuildTrigger;
        this.onClearLogs = callbacks.onClearLogs;
        this.onToggleInfo = callbacks.onToggleInfo;
        this.onRefresh = callbacks.onRefresh;
    }
    /**
     * Настраивает обработчики событий для UI элементов
     */
    setupEventListeners() {
        // Проверяем, что обработчики еще не добавлены
        if (!this.eventListenersAdded) {
            this.setupBuildButton();
            this.setupClearLogsButton();
            this.setupCheckboxes();
            this.setupToggleInfoButton();
            this.setupRefreshButton();
            this.eventListenersAdded = true;
        }
    }
    /**
     * Настраивает кнопку сборки
     */
    setupBuildButton() {
        if (this.elements.buildButton) {
            this.elements.buildButton.addEventListener('click', () => {
                if (this.onBuildTrigger) {
                    this.onBuildTrigger();
                }
            });
        }
    }
    /**
     * Настраивает кнопку очистки логов
     */
    setupClearLogsButton() {
        if (this.elements.clearLogsButton) {
            this.elements.clearLogsButton.addEventListener('click', () => {
                if (this.onClearLogs) {
                    this.onClearLogs();
                }
            });
        }
    }
    /**
     * Настраивает чекбоксы
     */
    setupCheckboxes() {
        // Обработчик для галочки SuperHTML билда
        if (this.elements.superhtmlCheckbox) {
            this.elements.superhtmlCheckbox.addEventListener('change', () => this.toggleClearDistVisibility());
        }
        // Обработчик для галочки SFTP
        if (this.elements.sftpCheckbox) {
            this.elements.sftpCheckbox.addEventListener('change', () => this.toggleClearSftpVisibility());
        }
    }
    /**
     * Настраивает кнопку переключения информации
     */
    setupToggleInfoButton() {
        if (this.elements.toggleInfoButton) {
            this.elements.toggleInfoButton.addEventListener('click', () => {
                if (this.onToggleInfo) {
                    this.onToggleInfo();
                }
            });
        }
    }
    /**
     * Настраивает кнопку обновления
     */
    setupRefreshButton() {
        if (this.elements.refreshButton) {
            this.elements.refreshButton.addEventListener('click', () => {
                if (this.onRefresh) {
                    this.onRefresh();
                }
            });
        }
    }
    /**
     * Управление видимостью галочки очистки папки dist
     */
    toggleClearDistVisibility() {
        const superhtmlCheckbox = this.elements.superhtmlCheckbox;
        const clearDistLabel = this.elements.clearDistLabel;
        if (!superhtmlCheckbox || !clearDistLabel)
            return;
        if (superhtmlCheckbox.checked) {
            clearDistLabel.classList.remove('hidden');
        }
        else {
            clearDistLabel.classList.add('hidden');
        }
    }
    /**
     * Управление видимостью галочки очистки папки SFTP
     */
    toggleClearSftpVisibility() {
        const sftpCheckbox = this.elements.sftpCheckbox;
        const clearSftpLabel = this.elements.clearSftpLabel;
        if (!sftpCheckbox || !clearSftpLabel)
            return;
        if (sftpCheckbox.checked) {
            clearSftpLabel.classList.remove('hidden');
        }
        else {
            clearSftpLabel.classList.add('hidden');
        }
    }
    /**
     * Управление состоянием всех галочек (включить/отключить)
     */
    setCheckboxesEnabled(enabled) {
        const checkboxes = [
            this.elements.mainBuildCheckbox,
            this.elements.superhtmlCheckbox,
            this.elements.clearDistCheckbox,
            this.elements.sftpCheckbox,
            this.elements.clearSftpCheckbox
        ];
        checkboxes.forEach(checkbox => {
            if (checkbox) {
                // Если галочка основного билда принудительно заблокирована, не трогаем ее при блокировке
                if (checkbox === this.elements.mainBuildCheckbox && checkbox.disabled && !enabled) {
                    return; // Пропускаем, если она уже заблокирована и мы хотим заблокировать
                }
                checkbox.disabled = !enabled;
            }
        });
        // Также управляем видимостью лейблов очистки
        this.toggleClearDistVisibility();
        this.toggleClearSftpVisibility();
    }
    /**
     * Принудительно разблокирует все галочки (для завершения/отмены сборки)
     */
    forceEnableAllCheckboxes() {
        const checkboxes = [
            this.elements.mainBuildCheckbox,
            this.elements.superhtmlCheckbox,
            this.elements.clearDistCheckbox,
            this.elements.sftpCheckbox,
            this.elements.clearSftpCheckbox
        ];
        checkboxes.forEach(checkbox => {
            if (checkbox) {
                checkbox.disabled = false;
            }
        });
        // Также управляем видимостью лейблов очистки
        this.toggleClearDistVisibility();
        this.toggleClearSftpVisibility();
    }
    /**
     * Переключает кнопку сборки
     */
    toggleBuildButton(building) {
        const btn = this.elements.buildButton;
        if (!btn)
            return;
        btn.textContent = building ? 'Cancel' : 'Build';
    }
    /**
     * Показывает прогресс сборки
     */
    showBuildProgress() {
        const progressElement = this.elements.buildProgress;
        const lastBuildInfo = this.elements.lastBuildInfo;
        if (progressElement) {
            progressElement.classList.remove('hidden');
            progressElement.classList.add('fade-in');
        }
        // Скрыть информацию о последней сборке
        if (lastBuildInfo) {
            lastBuildInfo.classList.add('hidden');
        }
        this.resetProgressItems();
    }
    /**
     * Скрывает прогресс сборки
     */
    hideBuildProgress() {
        const progressElement = this.elements.buildProgress;
        if (progressElement) {
            progressElement.classList.add('hidden');
        }
    }
    /**
     * Сбрасывает элементы прогресса
     */
    resetProgressItems() {
        const items = [this.elements.progressMain, this.elements.progressSuperhtml, this.elements.progressSftp];
        items.forEach((item) => {
            if (item) {
                item.classList.remove('completed', 'active', 'skipped');
                const checkbox = item.querySelector('.progress-checkbox');
                if (checkbox)
                    checkbox.textContent = '⏳';
            }
        });
    }
    /**
     * Обновляет элемент прогресса
     */
    updateProgressItem(itemId, status) {
        let item = null;
        switch (itemId) {
            case 'progressMain':
                item = this.elements.progressMain || null;
                break;
            case 'progressSuperhtml':
                item = this.elements.progressSuperhtml || null;
                break;
            case 'progressSftp':
                item = this.elements.progressSftp || null;
                break;
        }
        if (!item)
            return;
        // Удаляем все классы состояний
        item.classList.remove('active', 'completed', 'skipped');
        const checkbox = item.querySelector('.progress-checkbox');
        if (!checkbox)
            return;
        switch (status) {
            case 'active':
                item.classList.add('active');
                checkbox.textContent = '⚡';
                break;
            case 'completed':
                item.classList.add('completed');
                checkbox.textContent = '✅';
                break;
            case 'skipped':
                item.classList.add('skipped');
                checkbox.textContent = '⏭️';
                break;
        }
    }
    /**
     * Показывает информацию о последней сборке
     */
    showLastBuildInfo(result, remoteUrls) {
        const lastBuildInfo = this.elements.lastBuildInfo;
        const buildTimeElement = this.elements.buildTime;
        const completedTasksElement = this.elements.completedTasks;
        const buildLinksElement = this.elements.buildLinks;
        if (!lastBuildInfo || !buildTimeElement || !completedTasksElement || !buildLinksElement)
            return;
        // Вычисляем общее время сборки
        const minutes = Math.floor(result.duration / 60);
        const seconds = result.duration % 60;
        const timeString = `${minutes}м ${seconds}с (${result.startTime.toLocaleTimeString()} - ${result.endTime.toLocaleTimeString()})`;
        buildTimeElement.textContent = timeString;
        // Очищаем предыдущие задачи
        completedTasksElement.innerHTML = '';
        // Добавляем выполненные задачи
        result.tasks.forEach(task => {
            const taskElement = document.createElement('div');
            taskElement.className = 'completed-task';
            taskElement.textContent = task;
            completedTasksElement.appendChild(taskElement);
        });
        // Очищаем предыдущие ссылки
        buildLinksElement.innerHTML = '';
        // Добавляем ссылки на результаты сборки
        this.addBuildResultLinks(buildLinksElement, remoteUrls);
        // Показываем блок с информацией
        lastBuildInfo.classList.remove('hidden');
        lastBuildInfo.classList.add('fade-in');
    }
    /**
     * Добавляет ссылки на результаты сборки
     */
    addBuildResultLinks(container, remoteUrls) {
        var _a, _b, _c;
        const mainBuildEnabled = (_a = this.elements.mainBuildCheckbox) === null || _a === void 0 ? void 0 : _a.checked;
        const superHtmlEnabled = (_b = this.elements.superhtmlCheckbox) === null || _b === void 0 ? void 0 : _b.checked;
        const loadToSftp = (_c = this.elements.sftpCheckbox) === null || _c === void 0 ? void 0 : _c.checked;
        // Ссылка на папку build (для основного билда)
        if (mainBuildEnabled) {
            const buildFolderLink = this.createBuildLink('📁 Открыть папку build', () => this.openFolder((0, path_1.join)(this.projectPath, 'build')), 'folder-link');
            container.appendChild(buildFolderLink);
        }
        // Ссылка на папку dist (для SuperHTML билда)
        if (superHtmlEnabled) {
            const distFolderLink = this.createBuildLink('📁 Открыть папку dist', () => this.openFolder((0, path_1.join)(this.projectPath, 'dist')), 'folder-link');
            container.appendChild(distFolderLink);
        }
        // Ссылки на HTML файлы (после SFTP загрузки)
        if (loadToSftp) {
            // Ссылка на info.html (удаленный URL)
            if (remoteUrls.infoUrl) {
                const infoHtmlLink = this.createBuildLink('🌐 Открыть info.html', () => this.openRemoteUrl(remoteUrls.infoUrl), 'html-link');
                container.appendChild(infoHtmlLink);
            }
            // Ссылка на info-qa.html (удаленный URL)
            if (remoteUrls.infoQaUrl) {
                const infoQaHtmlLink = this.createBuildLink('🌐 Открыть info-qa.html', () => this.openRemoteUrl(remoteUrls.infoQaUrl), 'html-link');
                container.appendChild(infoQaHtmlLink);
            }
        }
    }
    /**
     * Создает ссылку на результат сборки
     */
    createBuildLink(text, onClick, className) {
        const link = document.createElement('button');
        link.className = `build-link ${className}`;
        link.textContent = text;
        link.addEventListener('click', onClick);
        return link;
    }
    /**
     * Открывает папку в файловом менеджере
     */
    openFolder(folderPath) {
        try {
            // Открываем папку в проводнике Windows
            (0, child_process_1.spawn)('explorer', [folderPath], { shell: true });
        }
        catch (error) {
            console.error(`Ошибка при открытии папки: ${error}`);
        }
    }
    /**
     * Открывает удаленный URL в браузере
     */
    openRemoteUrl(url) {
        try {
            // Открываем URL в браузере по умолчанию
            (0, child_process_1.spawn)('cmd', ['/c', `start "" "${url}"`], { shell: true });
        }
        catch (error) {
            console.error(`Ошибка при открытии URL: ${error}`);
        }
    }
    /**
     * Обновляет информацию о проекте
     */
    updateProjectInfo(info) {
        if (this.elements.suffixElement) {
            this.elements.suffixElement.innerHTML = info.suffix || '-';
        }
        if (this.elements.hashedFolderElement) {
            this.elements.hashedFolderElement.innerHTML = info.hashedFolder || '-';
        }
        if (this.elements.clientElement) {
            this.elements.clientElement.innerHTML = info.client || '-';
        }
        if (this.elements.titleKeyElement) {
            this.elements.titleKeyElement.innerHTML = info.titleKey || '-';
        }
        if (this.elements.languagesElement) {
            const formattedLanguages = Array.isArray(info.languages)
                ? info.languages.map(lang => lang.replace(/^lang_/, '')).join(', ')
                : (info.languages || '').replace(/^lang_/, '');
            this.elements.languagesElement.innerHTML = formattedLanguages || '-';
        }
    }
    /**
     * Очищает информацию о проекте
     */
    clearProjectInfo() {
        if (this.elements.suffixElement)
            this.elements.suffixElement.innerHTML = '-';
        if (this.elements.hashedFolderElement)
            this.elements.hashedFolderElement.innerHTML = '-';
        if (this.elements.clientElement)
            this.elements.clientElement.innerHTML = '-';
        if (this.elements.titleKeyElement)
            this.elements.titleKeyElement.innerHTML = '-';
        if (this.elements.languagesElement)
            this.elements.languagesElement.innerHTML = '-';
    }
    /**
     * Очищает список версий
     */
    clearVersionsList() {
        if (this.elements.versionsList) {
            this.elements.versionsList.innerHTML = '';
        }
    }
    /**
     * Получает настройки сборки из UI
     */
    getBuildSettings() {
        var _a, _b, _c, _d, _e;
        return {
            mainBuildEnabled: ((_a = this.elements.mainBuildCheckbox) === null || _a === void 0 ? void 0 : _a.checked) || false,
            superHtmlEnabled: ((_b = this.elements.superhtmlCheckbox) === null || _b === void 0 ? void 0 : _b.checked) || false,
            loadToSftp: ((_c = this.elements.sftpCheckbox) === null || _c === void 0 ? void 0 : _c.checked) || false,
            clearDistEnabled: ((_d = this.elements.clearDistCheckbox) === null || _d === void 0 ? void 0 : _d.checked) || false,
            clearSftpEnabled: ((_e = this.elements.clearSftpCheckbox) === null || _e === void 0 ? void 0 : _e.checked) || false
        };
    }
    /**
     * Принудительно активирует основной билд
     */
    forceEnableMainBuild() {
        const mainBuildCheckbox = this.elements.mainBuildCheckbox;
        if (mainBuildCheckbox) {
            mainBuildCheckbox.checked = true;
            mainBuildCheckbox.disabled = true;
        }
    }
    /**
     * Разблокирует основной билд
     */
    enableMainBuild() {
        const mainBuildCheckbox = this.elements.mainBuildCheckbox;
        if (mainBuildCheckbox) {
            mainBuildCheckbox.disabled = false;
        }
    }
}
exports.UIManager = UIManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiVUlNYW5hZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc291cmNlL3BhbmVscy9kZWZhdWx0L21vZHVsZXMvVUlNYW5hZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLCtCQUE0QjtBQUM1QixpREFBc0M7QUErQ3RDOztHQUVHO0FBQ0gsTUFBYSxTQUFTO0lBVWxCLFlBQVksUUFBb0IsRUFBRSxXQUFtQjtRQW1DN0Msd0JBQW1CLEdBQVksS0FBSyxDQUFDO1FBbEN6QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsV0FBVyxHQUFHLFdBQVcsQ0FBQztJQUNuQyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxZQUFZLENBQUMsU0FLWjtRQUNHLElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDLGNBQWMsQ0FBQztRQUMvQyxJQUFJLENBQUMsV0FBVyxHQUFHLFNBQVMsQ0FBQyxXQUFXLENBQUM7UUFDekMsSUFBSSxDQUFDLFlBQVksR0FBRyxTQUFTLENBQUMsWUFBWSxDQUFDO1FBQzNDLElBQUksQ0FBQyxTQUFTLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCxtQkFBbUI7UUFDZiw4Q0FBOEM7UUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1lBQ3hCLElBQUksQ0FBQyxvQkFBb0IsRUFBRSxDQUFDO1lBQzVCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUN2QixJQUFJLENBQUMscUJBQXFCLEVBQUUsQ0FBQztZQUM3QixJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztZQUMxQixJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1FBQ3BDLENBQUM7SUFDTCxDQUFDO0lBSUQ7O09BRUc7SUFDSyxnQkFBZ0I7UUFDcEIsSUFBSSxJ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T0FBTyxHQUFHLElBQUksQ0FBQztZQUNqQyxpQkFBaUIsQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1FBQ3RDLENBQUM7SUFDTCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxlQUFlO1FBQ1gsTUFBTSxpQkFBaUIsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFxQyxDQUFDO1FBQzlFLElBQUksaUJBQWlCLEVBQUUsQ0FBQztZQUNwQixpQkFBaUIsQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3ZDLENBQUM7SUFDTCxDQUFDO0NBQ0o7QUE3ZkQsOEJBNmZDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBzcGF3biB9IGZyb20gJ2NoaWxkX3Byb2Nlc3MnO1xyXG5pbXBvcnQgeyBCdWlsZFJlc3VsdCB9IGZyb20gJy4vQnVpbGRNYW5hZ2VyJztcclxuXHJcbi8qKlxyXG4gKiDQmNC90YLQtdGA0YTQtdC50YEg0LTQu9GPIFVJINGN0LvQtdC80LXQvdGC0L7QslxyXG4gKi9cclxuZXhwb3J0IGludGVyZmFjZSBVSUVsZW1lbnRzIHtcclxuICAgIGJ1aWxkQnV0dG9uPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgY2xlYXJMb2dzQnV0dG9uPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgbG9nQ29udGVudD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGxvZ1N1bW1hcnk/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBsb2dTdW1tYXJ5VGV4dD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGJ1aWxkU3RhdHVzPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgbWFpbkJ1aWxkQ2hlY2tib3g/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBzdXBlcmh0bWxDaGVja2JveD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGNsZWFyRGlzdENoZWNrYm94PzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgY2xlYXJEaXN0TGFiZWw/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBzZnRwQ2hlY2tib3g/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBjbGVhclNmdHBDaGVja2JveD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGNsZWFyU2Z0cExhYmVsPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgYnVpbGRQcm9ncmVzcz86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHByb2dyZXNzTWFpbj86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHByb2dyZXNzU3VwZXJodG1sPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgcHJvZ3Jlc3NTZnRwPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgbGFzdEJ1aWxkSW5mbz86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGxhc3RCdWlsZFN1bW1hcnk/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBidWlsZFRpbWU/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBwcm9ncmVzc01haW5UaW1lPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgcHJvZ3Jlc3NTdXBlcmh0bWxUaW1lPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgcHJvZ3Jlc3NTZnRwVGltZT86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGNvbXBsZXRlZFRhc2tzPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgYnVpbGRMaW5rcz86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHZlcnNpb25zTGlzdD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHN1ZmZpeEVsZW1lbnQ/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBoYXNoZWRGb2xkZXJFbGVtZW50PzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgY2xpZW50RWxlbWVudD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHRpdGxlS2V5RWxlbWVudD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIGxhbmd1YWdlc0VsZW1lbnQ/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICB0b2dnbGVJbmZvQnV0dG9uPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgaW5mb1NlY3Rpb24/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICBjbG9zZUluZm9CdXR0b24/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICByZWZyZXNoQnV0dG9uPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgd2FybmluZ01vZGFsPzogSFRNTEVsZW1lbnQgfCBudWxsO1xyXG4gICAgc2Z0cFdhcm5pbmdNb2RhbD86IEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgIHNmdHBDbGVhbkluZm8/OiBIVE1MRWxlbWVudCB8IG51bGw7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDQmtC70LDRgdGBINC00LvRjyDRg9C/0YDQsNCy0LvQtdC90LjRjyBVSSDRjdC70LXQvNC10L3RgtCw0LzQuFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFVJTWFuYWdlciB7XHJcbiAgICBwdWJsaWMgZWxlbWVudHM6IFVJRWxlbWVudHM7XHJcbiAgICBwcml2YXRlIHByb2plY3RQYXRoOiBzdHJpbmc7XHJcblxyXG4gICAgLy8gQ2FsbGJhY2sg0YTRg9C90LrRhtC40LhcclxuICAgIHByaXZhdGUgb25CdWlsZFRyaWdnZXI/OiAoKSA9PiB2b2lkO1xyXG4gICAgcHJpdmF0ZSBvbkNsZWFyTG9ncz86ICgpID0+IHZvaWQ7XHJcbiAgICBwcml2YXRlIG9uVG9nZ2xlSW5mbz86ICgpID0+IHZvaWQ7XHJcbiAgICBwcml2YXRlIG9uUmVmcmVzaD86ICgpID0+IHZvaWQ7XHJcblxyXG4gICAgY29uc3RydWN0b3IoZWxlbWVudHM6IFVJRWxlbWVudHMsIHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICB0aGlzLmVsZW1lbnRzID0gZWxlbWVudHM7XHJcbiAgICAgICAgdGhpcy5wcm9qZWN0UGF0aCA9IHByb2plY3RQYXRoO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KPRgdGC0LDQvdCw0LLQu9C40LLQsNC10YIgY2FsbGJhY2sg0YTRg9C90LrRhtC40LhcclxuICAgICAqL1xyXG4gICAgc2V0Q2FsbGJhY2tzKGNhbGxiYWNrczoge1xyXG4gICAgICAgIG9uQnVpbGRUcmlnZ2VyPzogKCkgPT4gdm9pZDtcclxuICAgICAgICBvbkNsZWFyTG9ncz86ICgpID0+IHZvaWQ7XHJcbiAgICAgICAgb25Ub2dnbGVJbmZvPzogKCkgPT4gdm9pZDtcclxuICAgICAgICBvblJlZnJlc2g/OiAoKSA9PiB2b2lkO1xyXG4gICAgfSkge1xyXG4gICAgICAgIHRoaXMub25CdWlsZFRyaWdnZXIgPSBjYWxsYmFja3Mub25CdWlsZFRyaWdnZXI7XHJcbiAgICAgICAgdGhpcy5vbkNsZWFyTG9ncyA9IGNhbGxiYWNrcy5vbkNsZWFyTG9ncztcclxuICAgICAgICB0aGlzLm9uVG9nZ2xlSW5mbyA9IGNhbGxiYWNrcy5vblRvZ2dsZUluZm87XHJcbiAgICAgICAgdGhpcy5vblJlZnJlc2ggPSBjYWxsYmFja3Mub25SZWZyZXNoO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNCw0LjQstCw0LXRgiDQvtCx0YDQsNCx0L7RgtGH0LjQutC4INGB0L7QsdGL0YLQuNC5INC00LvRjyBVSSDRjdC70LXQvNC10L3RgtC+0LJcclxuICAgICAqL1xyXG4gICAgc2V0dXBFdmVudExpc3RlbmVycygpIHtcclxuICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINGH0YLQviDQvtCx0YDQsNCx0L7RgtGH0LjQutC4INC10YnQtSDQvdC1INC00L7QsdCw0LLQu9C10L3Ri1xyXG4gICAgICAgIGlmICghdGhpcy5ldmVudExpc3RlbmVyc0FkZGVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBCdWlsZEJ1dHRvbigpO1xyXG4gICAgICAgICAgICB0aGlzLnNldHVwQ2xlYXJMb2dzQnV0dG9uKCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBDaGVja2JveGVzKCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBUb2dnbGVJbmZvQnV0dG9uKCk7XHJcbiAgICAgICAgICAgIHRoaXMuc2V0dXBSZWZyZXNoQnV0dG9uKCk7XHJcbiAgICAgICAgICAgIHRoaXMuZXZlbnRMaXN0ZW5lcnNBZGRlZCA9IHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZXZlbnRMaXN0ZW5lcnNBZGRlZDogYm9vbGVhbiA9IGZhbHNlO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNCw0LjQstCw0LXRgiDQutC90L7Qv9C60YMg0YHQsdC+0YDQutC4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBCdWlsZEJ1dHRvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy5idWlsZEJ1dHRvbikge1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLmJ1aWxkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25CdWlsZFRyaWdnZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm9uQnVpbGRUcmlnZ2VyKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCd0LDRgdGC0YDQsNC40LLQsNC10YIg0LrQvdC+0L/QutGDINC+0YfQuNGB0YLQutC4INC70L7Qs9C+0LJcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzZXR1cENsZWFyTG9nc0J1dHRvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy5jbGVhckxvZ3NCdXR0b24pIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5jbGVhckxvZ3NCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5vbkNsZWFyTG9ncykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25DbGVhckxvZ3MoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J3QsNGB0YLRgNCw0LjQstCw0LXRgiDRh9C10LrQsdC+0LrRgdGLXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBDaGVja2JveGVzKCkge1xyXG4gICAgICAgIC8vINCe0LHRgNCw0LHQvtGC0YfQuNC6INC00LvRjyDQs9Cw0LvQvtGH0LrQuCBTdXBlckhUTUwg0LHQuNC70LTQsFxyXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzLnN1cGVyaHRtbENoZWNrYm94KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMuc3VwZXJodG1sQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gdGhpcy50b2dnbGVDbGVhckRpc3RWaXNpYmlsaXR5KCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdC+0YLRh9C40Log0LTQu9GPINCz0LDQu9C+0YfQutC4IFNGVFBcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy5zZnRwQ2hlY2tib3gpIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5zZnRwQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gdGhpcy50b2dnbGVDbGVhclNmdHBWaXNpYmlsaXR5KCkpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCd0LDRgdGC0YDQsNC40LLQsNC10YIg0LrQvdC+0L/QutGDINC/0LXRgNC10LrQu9GO0YfQtdC90LjRjyDQuNC90YTQvtGA0LzQsNGG0LjQuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHNldHVwVG9nZ2xlSW5mb0J1dHRvbigpIHtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy50b2dnbGVJbmZvQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMudG9nZ2xlSW5mb0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICh0aGlzLm9uVG9nZ2xlSW5mbykge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMub25Ub2dnbGVJbmZvKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCd0LDRgdGC0YDQsNC40LLQsNC10YIg0LrQvdC+0L/QutGDINC+0LHQvdC+0LLQu9C10L3QuNGPXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc2V0dXBSZWZyZXNoQnV0dG9uKCkge1xyXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzLnJlZnJlc2hCdXR0b24pIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5yZWZyZXNoQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKHRoaXMub25SZWZyZXNoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5vblJlZnJlc2goKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KPQv9GA0LDQstC70LXQvdC40LUg0LLQuNC00LjQvNC+0YHRgtGM0Y4g0LPQsNC70L7Rh9C60Lgg0L7Rh9C40YHRgtC60Lgg0L/QsNC/0LrQuCBkaXN0XHJcbiAgICAgKi9cclxuICAgIHRvZ2dsZUNsZWFyRGlzdFZpc2liaWxpdHkoKSB7XHJcbiAgICAgICAgY29uc3Qgc3VwZXJodG1sQ2hlY2tib3ggPSB0aGlzLmVsZW1lbnRzLnN1cGVyaHRtbENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgY2xlYXJEaXN0TGFiZWwgPSB0aGlzLmVsZW1lbnRzLmNsZWFyRGlzdExhYmVsIGFzIEhUTUxFbGVtZW50O1xyXG5cclxuICAgICAgICBpZiAoIXN1cGVyaHRtbENoZWNrYm94IHx8ICFjbGVhckRpc3RMYWJlbCkgcmV0dXJuO1xyXG5cclxuICAgICAgICBpZiAoc3VwZXJodG1sQ2hlY2tib3guY2hlY2tlZCkge1xyXG4gICAgICAgICAgICBjbGVhckRpc3RMYWJlbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjbGVhckRpc3RMYWJlbC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQo9C/0YDQsNCy0LvQtdC90LjQtSDQstC40LTQuNC80L7RgdGC0YzRjiDQs9Cw0LvQvtGH0LrQuCDQvtGH0LjRgdGC0LrQuCDQv9Cw0L/QutC4IFNGVFBcclxuICAgICAqL1xyXG4gICAgdG9nZ2xlQ2xlYXJTZnRwVmlzaWJpbGl0eSgpIHtcclxuICAgICAgICBjb25zdCBzZnRwQ2hlY2tib3ggPSB0aGlzLmVsZW1lbnRzLnNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IGNsZWFyU2Z0cExhYmVsID0gdGhpcy5lbGVtZW50cy5jbGVhclNmdHBMYWJlbCBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgaWYgKCFzZnRwQ2hlY2tib3ggfHwgIWNsZWFyU2Z0cExhYmVsKSByZXR1cm47XHJcblxyXG4gICAgICAgIGlmIChzZnRwQ2hlY2tib3guY2hlY2tlZCkge1xyXG4gICAgICAgICAgICBjbGVhclNmdHBMYWJlbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjbGVhclNmdHBMYWJlbC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQo9C/0YDQsNCy0LvQtdC90LjQtSDRgdC+0YHRgtC+0Y/QvdC40LXQvCDQstGB0LXRhSDQs9Cw0LvQvtGH0LXQuiAo0LLQutC70Y7Rh9C40YLRjC/QvtGC0LrQu9GO0YfQuNGC0YwpXHJcbiAgICAgKi9cclxuICAgIHNldENoZWNrYm94ZXNFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcclxuICAgICAgICBjb25zdCBjaGVja2JveGVzID0gW1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLm1haW5CdWlsZENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnN1cGVyaHRtbENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLmNsZWFyRGlzdENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnNmdHBDaGVja2JveCxcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5jbGVhclNmdHBDaGVja2JveFxyXG4gICAgICAgIF0gYXMgSFRNTElucHV0RWxlbWVudFtdO1xyXG5cclxuICAgICAgICBjaGVja2JveGVzLmZvckVhY2goY2hlY2tib3ggPT4ge1xyXG4gICAgICAgICAgICBpZiAoY2hlY2tib3gpIHtcclxuICAgICAgICAgICAgICAgIC8vINCV0YHQu9C4INCz0LDQu9C+0YfQutCwINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwINC/0YDQuNC90YPQtNC40YLQtdC70YzQvdC+INC30LDQsdC70L7QutC40YDQvtCy0LDQvdCwLCDQvdC1INGC0YDQvtCz0LDQtdC8INC10LUg0L/RgNC4INCx0LvQvtC60LjRgNC+0LLQutC1XHJcbiAgICAgICAgICAgICAgICBpZiAoY2hlY2tib3ggPT09IHRoaXMuZWxlbWVudHMubWFpbkJ1aWxkQ2hlY2tib3ggJiYgY2hlY2tib3guZGlzYWJsZWQgJiYgIWVuYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47IC8vINCf0YDQvtC/0YPRgdC60LDQtdC8LCDQtdGB0LvQuCDQvtC90LAg0YPQttC1INC30LDQsdC70L7QutC40YDQvtCy0LDQvdCwINC4INC80Ysg0YXQvtGC0LjQvCDQt9Cw0LHQu9C+0LrQuNGA0L7QstCw0YLRjFxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2hlY2tib3guZGlzYWJsZWQgPSAhZW5hYmxlZDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG5cclxuICAgICAgICAvLyDQotCw0LrQttC1INGD0L/RgNCw0LLQu9GP0LXQvCDQstC40LTQuNC80L7RgdGC0YzRjiDQu9C10LnQsdC70L7QsiDQvtGH0LjRgdGC0LrQuFxyXG4gICAgICAgIHRoaXMudG9nZ2xlQ2xlYXJEaXN0VmlzaWJpbGl0eSgpO1xyXG4gICAgICAgIHRoaXMudG9nZ2xlQ2xlYXJTZnRwVmlzaWJpbGl0eSgpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0YDQsNC30LHQu9C+0LrQuNGA0YPQtdGCINCy0YHQtSDQs9Cw0LvQvtGH0LrQuCAo0LTQu9GPINC30LDQstC10YDRiNC10L3QuNGPL9C+0YLQvNC10L3RiyDRgdCx0L7RgNC60LgpXHJcbiAgICAgKi9cclxuICAgIGZvcmNlRW5hYmxlQWxsQ2hlY2tib3hlcygpIHtcclxuICAgICAgICBjb25zdCBjaGVja2JveGVzID0gW1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLm1haW5CdWlsZENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnN1cGVyaHRtbENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLmNsZWFyRGlzdENoZWNrYm94LFxyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnNmdHBDaGVja2JveCxcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5jbGVhclNmdHBDaGVja2JveFxyXG4gICAgICAgIF0gYXMgSFRNTElucHV0RWxlbWVudFtdO1xyXG5cclxuICAgICAgICBjaGVja2JveGVzLmZvckVhY2goY2hlY2tib3ggPT4ge1xyXG4gICAgICAgICAgICBpZiAoY2hlY2tib3gpIHtcclxuICAgICAgICAgICAgICAgIGNoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgLy8g0KLQsNC60LbQtSDRg9C/0YDQsNCy0LvRj9C10Lwg0LLQuNC00LjQvNC+0YHRgtGM0Y4g0LvQtdC50LHQu9C+0LIg0L7Rh9C40YHRgtC60LhcclxuICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyRGlzdFZpc2liaWxpdHkoKTtcclxuICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyU2Z0cFZpc2liaWxpdHkoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0LXRgNC10LrQu9GO0YfQsNC10YIg0LrQvdC+0L/QutGDINGB0LHQvtGA0LrQuFxyXG4gICAgICovXHJcbiAgICB0b2dnbGVCdWlsZEJ1dHRvbihidWlsZGluZzogYm9vbGVhbikge1xyXG4gICAgICAgIGNvbnN0IGJ0biA9IHRoaXMuZWxlbWVudHMuYnVpbGRCdXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgaWYgKCFidG4pIHJldHVybjtcclxuXHJcbiAgICAgICAgYnRuLnRleHRDb250ZW50ID0gYnVpbGRpbmcgPyAnQ2FuY2VsJyA6ICdCdWlsZCc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC30YvQstCw0LXRgiDQv9GA0L7Qs9GA0LXRgdGBINGB0LHQvtGA0LrQuFxyXG4gICAgICovXHJcbiAgICBzaG93QnVpbGRQcm9ncmVzcygpIHtcclxuICAgICAgICBjb25zdCBwcm9ncmVzc0VsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmJ1aWxkUHJvZ3Jlc3MgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgY29uc3QgbGFzdEJ1aWxkSW5mbyA9IHRoaXMuZWxlbWVudHMubGFzdEJ1aWxkSW5mbyBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgaWYgKHByb2dyZXNzRWxlbWVudCkge1xyXG4gICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgIHByb2dyZXNzRWxlbWVudC5jbGFzc0xpc3QuYWRkKCdmYWRlLWluJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodC60YDRi9GC0Ywg0LjQvdGE0L7RgNC80LDRhtC40Y4g0L4g0L/QvtGB0LvQtdC00L3QtdC5INGB0LHQvtGA0LrQtVxyXG4gICAgICAgIGlmIChsYXN0QnVpbGRJbmZvKSB7XHJcbiAgICAgICAgICAgIGxhc3RCdWlsZEluZm8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICB0aGlzLnJlc2V0UHJvZ3Jlc3NJdGVtcygpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KHQutGA0YvQstCw0LXRgiDQv9GA0L7Qs9GA0LXRgdGBINGB0LHQvtGA0LrQuFxyXG4gICAgICovXHJcbiAgICBoaWRlQnVpbGRQcm9ncmVzcygpIHtcclxuICAgICAgICBjb25zdCBwcm9ncmVzc0VsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmJ1aWxkUHJvZ3Jlc3MgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgaWYgKHByb2dyZXNzRWxlbWVudCkge1xyXG4gICAgICAgICAgICBwcm9ncmVzc0VsZW1lbnQuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KHQsdGA0LDRgdGL0LLQsNC10YIg0Y3Qu9C10LzQtdC90YLRiyDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAqL1xyXG4gICAgcmVzZXRQcm9ncmVzc0l0ZW1zKCkge1xyXG4gICAgICAgIGNvbnN0IGl0ZW1zID0gW3RoaXMuZWxlbWVudHMucHJvZ3Jlc3NNYWluLCB0aGlzLmVsZW1lbnRzLnByb2dyZXNzU3VwZXJodG1sLCB0aGlzLmVsZW1lbnRzLnByb2dyZXNzU2Z0cF07XHJcblxyXG4gICAgICAgIGl0ZW1zLmZvckVhY2goKGl0ZW0pID0+IHtcclxuICAgICAgICAgICAgaWYgKGl0ZW0pIHtcclxuICAgICAgICAgICAgICAgIGl0ZW0uY2xhc3NMaXN0LnJlbW92ZSgnY29tcGxldGVkJywgJ2FjdGl2ZScsICdza2lwcGVkJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjaGVja2JveCA9IGl0ZW0ucXVlcnlTZWxlY3RvcignLnByb2dyZXNzLWNoZWNrYm94Jyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoY2hlY2tib3gpIGNoZWNrYm94LnRleHRDb250ZW50ID0gJ+KPsyc7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0LHQvdC+0LLQu9GP0LXRgiDRjdC70LXQvNC10L3RgiDQv9GA0L7Qs9GA0LXRgdGB0LBcclxuICAgICAqL1xyXG4gICAgdXBkYXRlUHJvZ3Jlc3NJdGVtKGl0ZW1JZDogJ3Byb2dyZXNzTWFpbicgfCAncHJvZ3Jlc3NTdXBlcmh0bWwnIHwgJ3Byb2dyZXNzU2Z0cCcsIHN0YXR1czogJ2FjdGl2ZScgfCAnY29tcGxldGVkJyB8ICdza2lwcGVkJykge1xyXG4gICAgICAgIGxldCBpdGVtOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xyXG5cclxuICAgICAgICBzd2l0Y2ggKGl0ZW1JZCkge1xyXG4gICAgICAgICAgICBjYXNlICdwcm9ncmVzc01haW4nOlxyXG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuZWxlbWVudHMucHJvZ3Jlc3NNYWluIHx8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAncHJvZ3Jlc3NTdXBlcmh0bWwnOlxyXG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuZWxlbWVudHMucHJvZ3Jlc3NTdXBlcmh0bWwgfHwgbnVsbDtcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdwcm9ncmVzc1NmdHAnOlxyXG4gICAgICAgICAgICAgICAgaXRlbSA9IHRoaXMuZWxlbWVudHMucHJvZ3Jlc3NTZnRwIHx8IG51bGw7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghaXRlbSkgcmV0dXJuO1xyXG5cclxuICAgICAgICAvLyDQo9C00LDQu9GP0LXQvCDQstGB0LUg0LrQu9Cw0YHRgdGLINGB0L7RgdGC0L7Rj9C90LjQuVxyXG4gICAgICAgIGl0ZW0uY2xhc3NMaXN0LnJlbW92ZSgnYWN0aXZlJywgJ2NvbXBsZXRlZCcsICdza2lwcGVkJyk7XHJcblxyXG4gICAgICAgIGNvbnN0IGNoZWNrYm94ID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcucHJvZ3Jlc3MtY2hlY2tib3gnKTtcclxuICAgICAgICBpZiAoIWNoZWNrYm94KSByZXR1cm47XHJcblxyXG4gICAgICAgIHN3aXRjaCAoc3RhdHVzKSB7XHJcbiAgICAgICAgICAgIGNhc2UgJ2FjdGl2ZSc6XHJcbiAgICAgICAgICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoJ2FjdGl2ZScpO1xyXG4gICAgICAgICAgICAgICAgY2hlY2tib3gudGV4dENvbnRlbnQgPSAn4pqhJztcclxuICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICBjYXNlICdjb21wbGV0ZWQnOlxyXG4gICAgICAgICAgICAgICAgaXRlbS5jbGFzc0xpc3QuYWRkKCdjb21wbGV0ZWQnKTtcclxuICAgICAgICAgICAgICAgIGNoZWNrYm94LnRleHRDb250ZW50ID0gJ+KchSc7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICAgICAgY2FzZSAnc2tpcHBlZCc6XHJcbiAgICAgICAgICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoJ3NraXBwZWQnKTtcclxuICAgICAgICAgICAgICAgIGNoZWNrYm94LnRleHRDb250ZW50ID0gJ+KPre+4jyc7XHJcbiAgICAgICAgICAgICAgICBicmVhaztcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQn9C+0LrQsNC30YvQstCw0LXRgiDQuNC90YTQvtGA0LzQsNGG0LjRjiDQviDQv9C+0YHQu9C10LTQvdC10Lkg0YHQsdC+0YDQutC1XHJcbiAgICAgKi9cclxuICAgIHNob3dMYXN0QnVpbGRJbmZvKHJlc3VsdDogQnVpbGRSZXN1bHQsIHJlbW90ZVVybHM6IHsgaW5mb1VybD86IHN0cmluZzsgaW5mb1FhVXJsPzogc3RyaW5nIH0pIHtcclxuICAgICAgICBjb25zdCBsYXN0QnVpbGRJbmZvID0gdGhpcy5lbGVtZW50cy5sYXN0QnVpbGRJbmZvIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkVGltZUVsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmJ1aWxkVGltZSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICBjb25zdCBjb21wbGV0ZWRUYXNrc0VsZW1lbnQgPSB0aGlzLmVsZW1lbnRzLmNvbXBsZXRlZFRhc2tzIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIGNvbnN0IGJ1aWxkTGlua3NFbGVtZW50ID0gdGhpcy5lbGVtZW50cy5idWlsZExpbmtzIGFzIEhUTUxFbGVtZW50O1xyXG5cclxuICAgICAgICBpZiAoIWxhc3RCdWlsZEluZm8gfHwgIWJ1aWxkVGltZUVsZW1lbnQgfHwgIWNvbXBsZXRlZFRhc2tzRWxlbWVudCB8fCAhYnVpbGRMaW5rc0VsZW1lbnQpIHJldHVybjtcclxuXHJcbiAgICAgICAgLy8g0JLRi9GH0LjRgdC70Y/QtdC8INC+0LHRidC10LUg0LLRgNC10LzRjyDRgdCx0L7RgNC60LhcclxuICAgICAgICBjb25zdCBtaW51dGVzID0gTWF0aC5mbG9vcihyZXN1bHQuZHVyYXRpb24gLyA2MCk7XHJcbiAgICAgICAgY29uc3Qgc2Vjb25kcyA9IHJlc3VsdC5kdXJhdGlvbiAlIDYwO1xyXG4gICAgICAgIGNvbnN0IHRpbWVTdHJpbmcgPSBgJHttaW51dGVzfdC8ICR7c2Vjb25kc33RgSAoJHtyZXN1bHQuc3RhcnRUaW1lLnRvTG9jYWxlVGltZVN0cmluZygpfSAtICR7cmVzdWx0LmVuZFRpbWUudG9Mb2NhbGVUaW1lU3RyaW5nKCl9KWA7XHJcblxyXG4gICAgICAgIGJ1aWxkVGltZUVsZW1lbnQudGV4dENvbnRlbnQgPSB0aW1lU3RyaW5nO1xyXG5cclxuICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDQv9GA0LXQtNGL0LTRg9GJ0LjQtSDQt9Cw0LTQsNGH0LhcclxuICAgICAgICBjb21wbGV0ZWRUYXNrc0VsZW1lbnQuaW5uZXJIVE1MID0gJyc7XHJcblxyXG4gICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQstGL0L/QvtC70L3QtdC90L3Ri9C1INC30LDQtNCw0YfQuFxyXG4gICAgICAgIHJlc3VsdC50YXNrcy5mb3JFYWNoKHRhc2sgPT4ge1xyXG4gICAgICAgICAgICBjb25zdCB0YXNrRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICB0YXNrRWxlbWVudC5jbGFzc05hbWUgPSAnY29tcGxldGVkLXRhc2snO1xyXG4gICAgICAgICAgICB0YXNrRWxlbWVudC50ZXh0Q29udGVudCA9IHRhc2s7XHJcbiAgICAgICAgICAgIGNvbXBsZXRlZFRhc2tzRWxlbWVudC5hcHBlbmRDaGlsZCh0YXNrRWxlbWVudCk7XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INC/0YDQtdC00YvQtNGD0YnQuNC1INGB0YHRi9C70LrQuFxyXG4gICAgICAgIGJ1aWxkTGlua3NFbGVtZW50LmlubmVySFRNTCA9ICcnO1xyXG5cclxuICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0YHRgdGL0LvQutC4INC90LAg0YDQtdC30YPQu9GM0YLQsNGC0Ysg0YHQsdC+0YDQutC4XHJcbiAgICAgICAgdGhpcy5hZGRCdWlsZFJlc3VsdExpbmtzKGJ1aWxkTGlua3NFbGVtZW50LCByZW1vdGVVcmxzKTtcclxuXHJcbiAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0LHQu9C+0Log0YEg0LjQvdGE0L7RgNC80LDRhtC40LXQuVxyXG4gICAgICAgIGxhc3RCdWlsZEluZm8uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgbGFzdEJ1aWxkSW5mby5jbGFzc0xpc3QuYWRkKCdmYWRlLWluJyk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQlNC+0LHQsNCy0LvRj9C10YIg0YHRgdGL0LvQutC4INC90LAg0YDQtdC30YPQu9GM0YLQsNGC0Ysg0YHQsdC+0YDQutC4XHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgYWRkQnVpbGRSZXN1bHRMaW5rcyhjb250YWluZXI6IEhUTUxFbGVtZW50LCByZW1vdGVVcmxzOiB7IGluZm9Vcmw/OiBzdHJpbmc7IGluZm9RYVVybD86IHN0cmluZyB9KSB7XHJcbiAgICAgICAgY29uc3QgbWFpbkJ1aWxkRW5hYmxlZCA9ICh0aGlzLmVsZW1lbnRzLm1haW5CdWlsZENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpPy5jaGVja2VkO1xyXG4gICAgICAgIGNvbnN0IHN1cGVySHRtbEVuYWJsZWQgPSAodGhpcy5lbGVtZW50cy5zdXBlcmh0bWxDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KT8uY2hlY2tlZDtcclxuICAgICAgICBjb25zdCBsb2FkVG9TZnRwID0gKHRoaXMuZWxlbWVudHMuc2Z0cENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpPy5jaGVja2VkO1xyXG5cclxuICAgICAgICAvLyDQodGB0YvQu9C60LAg0L3QsCDQv9Cw0L/QutGDIGJ1aWxkICjQtNC70Y8g0L7RgdC90L7QstC90L7Qs9C+INCx0LjQu9C00LApXHJcbiAgICAgICAgaWYgKG1haW5CdWlsZEVuYWJsZWQpIHtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRGb2xkZXJMaW5rID0gdGhpcy5jcmVhdGVCdWlsZExpbmsoXHJcbiAgICAgICAgICAgICAgICAn8J+TgSDQntGC0LrRgNGL0YLRjCDQv9Cw0L/QutGDIGJ1aWxkJyxcclxuICAgICAgICAgICAgICAgICgpID0+IHRoaXMub3BlbkZvbGRlcihqb2luKHRoaXMucHJvamVjdFBhdGgsICdidWlsZCcpKSxcclxuICAgICAgICAgICAgICAgICdmb2xkZXItbGluaydcclxuICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1aWxkRm9sZGVyTGluayk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQodGB0YvQu9C60LAg0L3QsCDQv9Cw0L/QutGDIGRpc3QgKNC00LvRjyBTdXBlckhUTUwg0LHQuNC70LTQsClcclxuICAgICAgICBpZiAoc3VwZXJIdG1sRW5hYmxlZCkge1xyXG4gICAgICAgICAgICBjb25zdCBkaXN0Rm9sZGVyTGluayA9IHRoaXMuY3JlYXRlQnVpbGRMaW5rKFxyXG4gICAgICAgICAgICAgICAgJ/Cfk4Eg0J7RgtC60YDRi9GC0Ywg0L/QsNC/0LrRgyBkaXN0JyxcclxuICAgICAgICAgICAgICAgICgpID0+IHRoaXMub3BlbkZvbGRlcihqb2luKHRoaXMucHJvamVjdFBhdGgsICdkaXN0JykpLFxyXG4gICAgICAgICAgICAgICAgJ2ZvbGRlci1saW5rJ1xyXG4gICAgICAgICAgICApO1xyXG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoZGlzdEZvbGRlckxpbmspO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0KHRgdGL0LvQutC4INC90LAgSFRNTCDRhNCw0LnQu9GLICjQv9C+0YHQu9C1IFNGVFAg0LfQsNCz0YDRg9C30LrQuClcclxuICAgICAgICBpZiAobG9hZFRvU2Z0cCkge1xyXG4gICAgICAgICAgICAvLyDQodGB0YvQu9C60LAg0L3QsCBpbmZvLmh0bWwgKNGD0LTQsNC70LXQvdC90YvQuSBVUkwpXHJcbiAgICAgICAgICAgIGlmIChyZW1vdGVVcmxzLmluZm9VcmwpIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGluZm9IdG1sTGluayA9IHRoaXMuY3JlYXRlQnVpbGRMaW5rKFxyXG4gICAgICAgICAgICAgICAgICAgICfwn4yQINCe0YLQutGA0YvRgtGMIGluZm8uaHRtbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5vcGVuUmVtb3RlVXJsKHJlbW90ZVVybHMuaW5mb1VybCEpLFxyXG4gICAgICAgICAgICAgICAgICAgICdodG1sLWxpbmsnXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGluZm9IdG1sTGluayk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vINCh0YHRi9C70LrQsCDQvdCwIGluZm8tcWEuaHRtbCAo0YPQtNCw0LvQtdC90L3Ri9C5IFVSTClcclxuICAgICAgICAgICAgaWYgKHJlbW90ZVVybHMuaW5mb1FhVXJsKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpbmZvUWFIdG1sTGluayA9IHRoaXMuY3JlYXRlQnVpbGRMaW5rKFxyXG4gICAgICAgICAgICAgICAgICAgICfwn4yQINCe0YLQutGA0YvRgtGMIGluZm8tcWEuaHRtbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5vcGVuUmVtb3RlVXJsKHJlbW90ZVVybHMuaW5mb1FhVXJsISksXHJcbiAgICAgICAgICAgICAgICAgICAgJ2h0bWwtbGluaydcclxuICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoaW5mb1FhSHRtbExpbmspO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0KHQvtC30LTQsNC10YIg0YHRgdGL0LvQutGDINC90LAg0YDQtdC30YPQu9GM0YLQsNGCINGB0LHQvtGA0LrQuFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGNyZWF0ZUJ1aWxkTGluayh0ZXh0OiBzdHJpbmcsIG9uQ2xpY2s6ICgpID0+IHZvaWQsIGNsYXNzTmFtZTogc3RyaW5nKTogSFRNTEVsZW1lbnQge1xyXG4gICAgICAgIGNvbnN0IGxpbmsgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICBsaW5rLmNsYXNzTmFtZSA9IGBidWlsZC1saW5rICR7Y2xhc3NOYW1lfWA7XHJcbiAgICAgICAgbGluay50ZXh0Q29udGVudCA9IHRleHQ7XHJcbiAgICAgICAgbGluay5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIG9uQ2xpY2spO1xyXG4gICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7RgtC60YDRi9Cy0LDQtdGCINC/0LDQv9C60YMg0LIg0YTQsNC50LvQvtCy0L7QvCDQvNC10L3QtdC00LbQtdGA0LVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBvcGVuRm9sZGVyKGZvbGRlclBhdGg6IHN0cmluZykge1xyXG4gICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIC8vINCe0YLQutGA0YvQstCw0LXQvCDQv9Cw0L/QutGDINCyINC/0YDQvtCy0L7QtNC90LjQutC1IFdpbmRvd3NcclxuICAgICAgICAgICAgc3Bhd24oJ2V4cGxvcmVyJywgW2ZvbGRlclBhdGhdLCB7IHNoZWxsOiB0cnVlIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYNCe0YjQuNCx0LrQsCDQv9GA0Lgg0L7RgtC60YDRi9GC0LjQuCDQv9Cw0L/QutC4OiAke2Vycm9yfWApO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YLQutGA0YvQstCw0LXRgiDRg9C00LDQu9C10L3QvdGL0LkgVVJMINCyINCx0YDQsNGD0LfQtdGA0LVcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBvcGVuUmVtb3RlVXJsKHVybDogc3RyaW5nKSB7XHJcbiAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgLy8g0J7RgtC60YDRi9Cy0LDQtdC8IFVSTCDQsiDQsdGA0LDRg9C30LXRgNC1INC/0L4g0YPQvNC+0LvRh9Cw0L3QuNGOXHJcbiAgICAgICAgICAgIHNwYXduKCdjbWQnLCBbJy9jJywgYHN0YXJ0IFwiXCIgXCIke3VybH1cImBdLCB7IHNoZWxsOiB0cnVlIH0pO1xyXG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYNCe0YjQuNCx0LrQsCDQv9GA0Lgg0L7RgtC60YDRi9GC0LjQuCBVUkw6ICR7ZXJyb3J9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J7QsdC90L7QstC70Y/QtdGCINC40L3RhNC+0YDQvNCw0YbQuNGOINC+INC/0YDQvtC10LrRgtC1XHJcbiAgICAgKi9cclxuICAgIHVwZGF0ZVByb2plY3RJbmZvKGluZm86IHtcclxuICAgICAgICBzdWZmaXg/OiBzdHJpbmc7XHJcbiAgICAgICAgaGFzaGVkRm9sZGVyPzogc3RyaW5nO1xyXG4gICAgICAgIGNsaWVudD86IHN0cmluZztcclxuICAgICAgICB0aXRsZUtleT86IHN0cmluZztcclxuICAgICAgICBsYW5ndWFnZXM/OiBzdHJpbmdbXTtcclxuICAgIH0pIHtcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy5zdWZmaXhFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMuc3VmZml4RWxlbWVudC5pbm5lckhUTUwgPSBpbmZvLnN1ZmZpeCB8fCAnLSc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzLmhhc2hlZEZvbGRlckVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5oYXNoZWRGb2xkZXJFbGVtZW50LmlubmVySFRNTCA9IGluZm8uaGFzaGVkRm9sZGVyIHx8ICctJztcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMuY2xpZW50RWxlbWVudCkge1xyXG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLmNsaWVudEVsZW1lbnQuaW5uZXJIVE1MID0gaW5mby5jbGllbnQgfHwgJy0nO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy50aXRsZUtleUVsZW1lbnQpIHtcclxuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy50aXRsZUtleUVsZW1lbnQuaW5uZXJIVE1MID0gaW5mby50aXRsZUtleSB8fCAnLSc7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzLmxhbmd1YWdlc0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkTGFuZ3VhZ2VzID0gQXJyYXkuaXNBcnJheShpbmZvLmxhbmd1YWdlcylcclxuICAgICAgICAgICAgICAgID8gaW5mby5sYW5ndWFnZXMubWFwKGxhbmcgPT4gbGFuZy5yZXBsYWNlKC9ebGFuZ18vLCAnJykpLmpvaW4oJywgJylcclxuICAgICAgICAgICAgICAgIDogKGluZm8ubGFuZ3VhZ2VzIHx8ICcnKS5yZXBsYWNlKC9ebGFuZ18vLCAnJyk7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMubGFuZ3VhZ2VzRWxlbWVudC5pbm5lckhUTUwgPSBmb3JtYXR0ZWRMYW5ndWFnZXMgfHwgJy0nO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YfQuNGJ0LDQtdGCINC40L3RhNC+0YDQvNCw0YbQuNGOINC+INC/0YDQvtC10LrRgtC1XHJcbiAgICAgKi9cclxuICAgIGNsZWFyUHJvamVjdEluZm8oKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMuc3VmZml4RWxlbWVudCkgdGhpcy5lbGVtZW50cy5zdWZmaXhFbGVtZW50LmlubmVySFRNTCA9ICctJztcclxuICAgICAgICBpZiAodGhpcy5lbGVtZW50cy5oYXNoZWRGb2xkZXJFbGVtZW50KSB0aGlzLmVsZW1lbnRzLmhhc2hlZEZvbGRlckVsZW1lbnQuaW5uZXJIVE1MID0gJy0nO1xyXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzLmNsaWVudEVsZW1lbnQpIHRoaXMuZWxlbWVudHMuY2xpZW50RWxlbWVudC5pbm5lckhUTUwgPSAnLSc7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMudGl0bGVLZXlFbGVtZW50KSB0aGlzLmVsZW1lbnRzLnRpdGxlS2V5RWxlbWVudC5pbm5lckhUTUwgPSAnLSc7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMubGFuZ3VhZ2VzRWxlbWVudCkgdGhpcy5lbGVtZW50cy5sYW5ndWFnZXNFbGVtZW50LmlubmVySFRNTCA9ICctJztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCe0YfQuNGJ0LDQtdGCINGB0L/QuNGB0L7QuiDQstC10YDRgdC40LlcclxuICAgICAqL1xyXG4gICAgY2xlYXJWZXJzaW9uc0xpc3QoKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMudmVyc2lvbnNMaXN0KSB7XHJcbiAgICAgICAgICAgIHRoaXMuZWxlbWVudHMudmVyc2lvbnNMaXN0LmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqINCf0L7Qu9GD0YfQsNC10YIg0L3QsNGB0YLRgNC+0LnQutC4INGB0LHQvtGA0LrQuCDQuNC3IFVJXHJcbiAgICAgKi9cclxuICAgIGdldEJ1aWxkU2V0dGluZ3MoKToge1xyXG4gICAgICAgIG1haW5CdWlsZEVuYWJsZWQ6IGJvb2xlYW47XHJcbiAgICAgICAgc3VwZXJIdG1sRW5hYmxlZDogYm9vbGVhbjtcclxuICAgICAgICBsb2FkVG9TZnRwOiBib29sZWFuO1xyXG4gICAgICAgIGNsZWFyRGlzdEVuYWJsZWQ6IGJvb2xlYW47XHJcbiAgICAgICAgY2xlYXJTZnRwRW5hYmxlZDogYm9vbGVhbjtcclxuICAgIH0ge1xyXG4gICAgICAgIHJldHVybiB7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZEVuYWJsZWQ6ICh0aGlzLmVsZW1lbnRzLm1haW5CdWlsZENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpPy5jaGVja2VkIHx8IGZhbHNlLFxyXG4gICAgICAgICAgICBzdXBlckh0bWxFbmFibGVkOiAodGhpcy5lbGVtZW50cy5zdXBlcmh0bWxDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KT8uY2hlY2tlZCB8fCBmYWxzZSxcclxuICAgICAgICAgICAgbG9hZFRvU2Z0cDogKHRoaXMuZWxlbWVudHMuc2Z0cENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpPy5jaGVja2VkIHx8IGZhbHNlLFxyXG4gICAgICAgICAgICBjbGVhckRpc3RFbmFibGVkOiAodGhpcy5lbGVtZW50cy5jbGVhckRpc3RDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KT8uY2hlY2tlZCB8fCBmYWxzZSxcclxuICAgICAgICAgICAgY2xlYXJTZnRwRW5hYmxlZDogKHRoaXMuZWxlbWVudHMuY2xlYXJTZnRwQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCk/LmNoZWNrZWQgfHwgZmFsc2VcclxuICAgICAgICB9O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LDQutGC0LjQstC40YDRg9C10YIg0L7RgdC90L7QstC90L7QuSDQsdC40LvQtFxyXG4gICAgICovXHJcbiAgICBmb3JjZUVuYWJsZU1haW5CdWlsZCgpIHtcclxuICAgICAgICBjb25zdCBtYWluQnVpbGRDaGVja2JveCA9IHRoaXMuZWxlbWVudHMubWFpbkJ1aWxkQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICBpZiAobWFpbkJ1aWxkQ2hlY2tib3gpIHtcclxuICAgICAgICAgICAgbWFpbkJ1aWxkQ2hlY2tib3guY2hlY2tlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZENoZWNrYm94LmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDQoNCw0LfQsdC70L7QutC40YDRg9C10YIg0L7RgdC90L7QstC90L7QuSDQsdC40LvQtFxyXG4gICAgICovXHJcbiAgICBlbmFibGVNYWluQnVpbGQoKSB7XHJcbiAgICAgICAgY29uc3QgbWFpbkJ1aWxkQ2hlY2tib3ggPSB0aGlzLmVsZW1lbnRzLm1haW5CdWlsZENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgaWYgKG1haW5CdWlsZENoZWNrYm94KSB7XHJcbiAgICAgICAgICAgIG1haW5CdWlsZENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG59XHJcbiJdfQ==
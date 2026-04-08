import { readFileSync, existsSync, writeFileSync } from 'fs-extra';
import { join } from 'path';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { LogManager } from './modules/LogManager';
import { ProgressManager } from './ProgressManager';
import { ModalManager } from './modules/ModalManager';
import { VersionsManager } from './modules/VersionsManager';
import { UpdateManager } from './modules/UpdateManager';
import { Validator, ValidationSummary } from './Validator';
import { PlatformUtils } from '../../utils/platform';
// @ts-ignore
import packageJSON from '../../../package.json';

let isBuilding = false;
let runningProcesses: ChildProcessWithoutNullStreams[] = [];
let buildStartTime: Date;
let currentBuildTasks: string[] = [];
let versions: any[] = [];
let originalVersions: any[] = []; // Оригинальные версии для сравнения
let variablesStorage: { [key: string]: any } = {}; // Хранилище переменных с дефолтными значениями
let originalVariablesStorage: { [key: string]: any } = {}; // Оригинальное хранилище для сравнения
let selectedVersionName: string | null = null; // Имя выбранной версии для не прод режима
let originalSelectedVersionName: string | null = null; // Оригинальное значение для сравнения
let hasUnsavedChanges: boolean = false; // Флаг наличия несохраненных изменений
let isSaving: boolean = false; // Флаг процесса сохранения
let titleConfig: any = null;
let requiredVariables: { [key: string]: any } = {}; // Обязательные переменные из конфига тайтла
let remoteUrls: { infoUrl?: string; infoQaUrl?: string } = {};
let logManager: LogManager;
let progressManager: ProgressManager;
let modalManager: ModalManager;
let validator: Validator;
let validationState: {
    hasErrors: boolean;
    lastValidation: ValidationSummary | null;
} = {
    hasErrors: false,
    lastValidation: null
};
let copyVersionIndex: number | null = null; // Индекс версии для копирования
let renameVersionIndex: number | null = null; // Индекс версии для переименования

// Buffer for accumulating partial messages
let messageBuffer: string = '';

module.exports = Editor.Panel.define({
    listeners: {
        show() { },
        hide() { },
    },
    beforeClose() {
        // Убрали проверку несохраненных изменений - теперь проверяем только при закрытии редактора версий
        return true;
    },

    template: readFileSync(join(__dirname, '../../../static/template/builder/index.html'), 'utf-8'),
    style: readFileSync(join(__dirname, '../../../static/style/builder/index.css'), 'utf-8'),

    $: {
        app: '#app',
        buildButton: '.build-button',
        clearLogsButton: '.clear-logs-button',
        logContent: '#log-content',
        logSummary: '#log-summary',
        logSummaryText: '#log-summary-text',
        buildStatus: '#build-status',
        mainBuildCheckbox: '#main-build-checkbox',
        superhtmlCheckbox: '#superhtml-checkbox',
        clearDistCheckbox: '#clear-dist-checkbox',
        clearDistLabel: '#clear-dist-label',
        sftpCheckbox: '#sftp-checkbox',
        clearSftpCheckbox: '#clear-sftp-checkbox',
        clearSftpLabel: '#clear-sftp-label',
        // Checkbox sections for progress display
        mainBuildSection: '#main-build-section',
        superhtmlSection: '#superhtml-section',
        sftpSection: '#sftp-section',
        // Progress indicators inside sections
        mainBuildProgress: '#main-build-progress',
        superhtmlProgress: '#superhtml-progress',
        sftpProgress: '#sftp-progress',
        // Time elements
        mainBuildTime: '#main-build-time',
        superhtmlTime: '#superhtml-time',
        sftpTime: '#sftp-time',
        // Progress statuses
        mainBuildStatus: '#main-build-status',
        superhtmlStatus: '#superhtml-status',
        sftpStatus: '#sftp-status',
        // Progress bar elements
        mainBuildProgressFill: '#main-build-progress-fill',
        superhtmlProgressFill: '#superhtml-progress-fill',
        sftpProgressFill: '#sftp-progress-fill',
        mainBuildPercentage: '#main-build-percentage',
        superhtmlPercentage: '#superhtml-percentage',
        sftpPercentage: '#sftp-percentage',
        lastBuildInfo: '#last-build-info',
        lastBuildSummary: '#last-build-summary',
        buildTime: '#build-time',
        completedTasks: '#completed-tasks',
        buildLinks: '#build-links',
        versionsList: '#versions-list',
        suffixElement: '#suffixElement', // Add element for suffix display
        hashedFolderElement: '#hashedFolderElement', // Add element for hashed path display
        clientElement: '#clientElement', // Add element for client display
        titleKeyElement: '#titleKeyElement', // Add element for title key display
        languagesElement: '#languagesElement', // Add element for languages display
        pathsSection: '#paths-section', // Add element for paths section
        versionPathsList: '#version-paths-list', // Add element for version paths list
        togglePathsButton: '#toggle-paths-button', // Add element for toggle paths button
        closePathsButton: '#close-paths-button', // Add element for close paths button
        toggleInfoButton: '#toggle-info-button',
        infoSection: '#info-section',
        closeInfoButton: '#close-info-button',
        toggleValidatorButton: '#toggle-validator-button',
        validatorSection: '#validator-section',
        closeValidatorButton: '#close-validator-button',
        validatorContent: '.validator-content',
        refreshButton: '#refresh-button',
        updateBuilderButton: '#update-builder-button',
        openVersionFileButton: '#open-version-file-button',
        refreshVersionFileButton: '#refresh-version-file-button',
        saveVersionsButton: '#save-versions-button',
        autosaveCheckbox: '#autosave-checkbox',
        versionEditor: '#version-editor',
        variablesList: '#variables-list',
        versionsBuildList: '#versions-build-list',
        addVersionButton: '#add-version-button',
        addVersionModal: '#add-version-modal',
        addVersionInput: '#version-name-input',
        addVersionCancel: '#add-version-cancel',
        addVersionConfirm: '#add-version-confirm',
        addVariableButton: '#add-variable-button',
        addVariableModal: '#add-variable-modal',
        addVariableNameInput: '#variable-name-input',
        addVariableValueInput: '#variable-value-input',
        addVariableCancel: '#add-variable-cancel',
        addVariableConfirm: '#add-variable-confirm',
        warningModal: '#warning-modal',
        warningCancel: '#warning-cancel',
        warningContinue: '#warning-continue',
        sftpWarningModal: '#sftp-warning-modal',
        sftpWarningCancel: '#sftp-warning-cancel',
        sftpWarningContinue: '#sftp-warning-continue',
        sftpCleanInfo: '#sftp-clean-info',
        unsavedChangesModal: '#unsaved-changes-modal',
        unsavedChangesCancel: '#unsaved-changes-cancel',
        unsavedChangesDiscard: '#unsaved-changes-discard',
        unsavedSceneChangesModal: '#unsaved-scene-changes-modal',
        unsavedSceneCancel: '#unsaved-scene-cancel',
        unsavedSceneSave: '#unsaved-scene-save',
        unsavedSceneContinue: '#unsaved-scene-continue',
        updateCompletedModal: '#update-completed-modal',
        updateCompletedOk: '#update-completed-ok',
        builtFiles: '#built-files',
        builderVersion: '#builder-version'
    },

    methods: {
        // Функция для сравнения версий и хранилища переменных
        hasVersionsChanged(): boolean {
            if (versions.length !== originalVersions.length) {
                return true;
            }
            const versionsStr = JSON.stringify(versions);
            const originalVersionsStr = JSON.stringify(originalVersions);
            const variablesStr = JSON.stringify(variablesStorage);
            const originalVariablesStr = JSON.stringify(originalVariablesStorage);
            const selectedVersionChanged = selectedVersionName !== originalSelectedVersionName;
            return versionsStr !== originalVersionsStr || variablesStr !== originalVariablesStr || selectedVersionChanged;
        },

        // Функция для отметки наличия изменений
        markVersionsAsChanged() {
            hasUnsavedChanges = true;

            // Если автосейв включен и не идет процесс сохранения, сохраняем изменения
            const autosaveCheckbox = this.$.autosaveCheckbox as HTMLInputElement;
            if (autosaveCheckbox && autosaveCheckbox.checked && !isSaving) {
                // Используем небольшую задержку для debounce при быстрых изменениях
                setTimeout(() => {
                    if (hasUnsavedChanges && !isSaving) {
                        this.saveVersions();
                    }
                }, 300);
            }
        },

        appendLog(msg: string, type?: 'error' | 'warn' | 'success') {
            // Add message to buffer
            messageBuffer += msg;

            // Check if there are complete messages in buffer
            const lines = messageBuffer.split('\n');

            // Process all complete lines (except the last one, which may be incomplete)
            for (let i = 0; i < lines.length - 1; i++) {
                const line = lines[i].trim();
                if (line.length > 0) {
                    this.processCompleteMessage(line);
                }
            }

            // Keep the last line in buffer (it may be incomplete)
            messageBuffer = lines[lines.length - 1];

            // Use LogManager to display logs
            logManager.appendLog(msg, type);
        },

        processCompleteMessage(msg: string) {
            // Check if there are messages with file size

            // Parse URLs from logs
            const urls = this.parseUrlsFromLog(msg);
            if (urls.infoUrl) remoteUrls.infoUrl = urls.infoUrl;
            if (urls.infoQaUrl) remoteUrls.infoQaUrl = urls.infoQaUrl;

            // Parse structured SFTP logs
            const sftpUpdated = progressManager.parseSftpLogs(msg);

            // Parse main build progress
            const mainBuildUpdated = progressManager.parseMainBuildProgress(msg);

            // Parse SuperHTML build progress
            const superHtmlUpdated = progressManager.parseSuperHtmlProgress(msg);

            // If SuperHTML progress updated, log it
        },

        clearLogs() {
            logManager.clearLogs();
        },


        // Method for parsing URLs from logs
        parseUrlsFromLog(msg: string) {
            return logManager.parseUrlsFromLog(msg);
        },









        // Setup refresh button
        setupRefreshButton() {
            const refreshButton = this.$.refreshButton as HTMLButtonElement;
            if (refreshButton) {
                refreshButton.addEventListener('click', () => this.refreshData());
            }
        },


        // Continue build after warning
        continueBuild() {
            modalManager.hideWarningModal();
            // Start build directly
            this.proceedWithBuild();
        },

        // Continue build after SFTP warning
        continueSftpBuild() {
            modalManager.hideSftpWarningModal();
            // Continue with current settings (with SFTP cleanup)
            this.proceedWithBuild();
        },

        // Method for updating data
        refreshData() {
            const refreshButton = this.$.refreshButton as HTMLButtonElement;
            if (!refreshButton) return;

            // Block button and show loading animation
            refreshButton.disabled = true;
            refreshButton.classList.add('loading');
            refreshButton.textContent = '⏳';

            this.appendLog('Updating data...', 'warn');

            // Clear current data
            this.clearCurrentData();

            // Perform full reinitialization as in ready
            setTimeout(() => {
                // Reinitialize LogManager
                logManager = new LogManager(
                    this.$.logContent as HTMLElement,
                    this.$.logSummaryText as HTMLElement
                );

                // Reinitialize ProgressManager
                progressManager = new ProgressManager({
                    // Checkbox sections for progress display
                    mainBuildSection: this.$.mainBuildSection as HTMLElement,
                    superhtmlSection: this.$.superhtmlSection as HTMLElement,
                    sftpSection: this.$.sftpSection as HTMLElement,
                    // Progress indicators inside sections
                    mainBuildProgress: this.$.mainBuildProgress as HTMLElement,
                    superhtmlProgress: this.$.superhtmlProgress as HTMLElement,
                    sftpProgress: this.$.sftpProgress as HTMLElement,
                    // Time elements
                    mainBuildTime: this.$.mainBuildTime as HTMLElement,
                    superhtmlTime: this.$.superhtmlTime as HTMLElement,
                    sftpTime: this.$.sftpTime as HTMLElement,
                    // Progress statuses
                    mainBuildStatus: this.$.mainBuildStatus as HTMLElement,
                    superhtmlStatus: this.$.superhtmlStatus as HTMLElement,
                    sftpStatus: this.$.sftpStatus as HTMLElement,
                    sftpCleanInfo: this.$.sftpCleanInfo as HTMLElement
                });

                // Set additional progress bar elements
                (progressManager as any).uiElements.mainBuildProgressFill = this.$.mainBuildProgressFill as HTMLElement;
                (progressManager as any).uiElements.superhtmlProgressFill = this.$.superhtmlProgressFill as HTMLElement;
                (progressManager as any).uiElements.sftpProgressFill = this.$.sftpProgressFill as HTMLElement;
                (progressManager as any).uiElements.mainBuildPercentage = this.$.mainBuildPercentage as HTMLElement;
                (progressManager as any).uiElements.superhtmlPercentage = this.$.superhtmlPercentage as HTMLElement;
                (progressManager as any).uiElements.sftpPercentage = this.$.sftpPercentage as HTMLElement;

                // Reinitialize ModalManager
                modalManager = new ModalManager(
                    {
                        warningModal: this.$.warningModal as HTMLElement,
                        warningCancel: this.$.warningCancel as HTMLButtonElement,
                        warningContinue: this.$.warningContinue as HTMLButtonElement,
                        sftpWarningModal: this.$.sftpWarningModal as HTMLElement,
                        sftpWarningCancel: this.$.sftpWarningCancel as HTMLButtonElement,
                        sftpWarningContinue: this.$.sftpWarningContinue as HTMLButtonElement,
                        sftpCleanInfo: this.$.sftpCleanInfo as HTMLElement,
                        unsavedChangesModal: this.$.unsavedChangesModal as HTMLElement,
                        unsavedChangesCancel: this.$.unsavedChangesCancel as HTMLButtonElement,
                        unsavedChangesDiscard: this.$.unsavedChangesDiscard as HTMLButtonElement,
                        updateCompletedModal: this.$.updateCompletedModal as HTMLElement,
                        updateCompletedOk: this.$.updateCompletedOk as HTMLButtonElement,
                        infoSection: this.$.infoSection as HTMLElement,
                        toggleInfoButton: this.$.toggleInfoButton as HTMLButtonElement,
                        closeInfoButton: this.$.closeInfoButton as HTMLButtonElement,
                        pathsSection: this.$.pathsSection as HTMLElement,
                        togglePathsButton: this.$.togglePathsButton as HTMLButtonElement,
                        closePathsButton: this.$.closePathsButton as HTMLButtonElement,
                validatorSection: this.$.validatorSection as HTMLElement,
                toggleValidatorButton: this.$.toggleValidatorButton as HTMLButtonElement,
                closeValidatorButton: this.$.closeValidatorButton as HTMLButtonElement,
                unsavedSceneChangesModal: this.$.unsavedSceneChangesModal as HTMLElement,
                unsavedSceneCancel: this.$.unsavedSceneCancel as HTMLButtonElement,
                unsavedSceneSave: this.$.unsavedSceneSave as HTMLButtonElement,
                unsavedSceneContinue: this.$.unsavedSceneContinue as HTMLButtonElement
            },
                    {
                        onWarningContinue: () => this.continueBuild(),
                        onSftpWarningContinue: () => this.continueSftpBuild(),
                        onUnsavedChangesDiscard: () => {
                            // Просто скрываем модальное окно, закрытие info-section произойдет автоматически
                        },
                        onUnsavedSceneCancel: () => {
                            // Отменяем запуск билда
                        },
                        onUnsavedSceneSave: async () => {
                            // Сохраняем сцену и продолжаем билд
                            const saved = await this.saveScene();
                            if (saved) {
                                this.proceedWithBuildCheck();
                            }
                        },
                        onCheckUnsavedChanges: () => {
                            // Проверяем наличие несохраненных изменений
                            const autosaveCheckbox = this.$.autosaveCheckbox as HTMLInputElement;
                            const isAutosaveEnabled = autosaveCheckbox && autosaveCheckbox.checked;

                            // Если автосейв включен, не показываем модальное окно
                            if (isAutosaveEnabled) {
                                return false;
                            }

                            // Проверяем наличие несохраненных изменений
                            return hasUnsavedChanges && this.hasVersionsChanged();
                        },
                        onValidatorOpen: () => this.runValidation(),
                        onPathsOpen: () => this.refreshData(),
                        onInfoOpen: () => {
                            // Загружаем свежую информацию по требованию переменных из тайтл конфига при открытии редактора версий
                            const projectPath = join(__dirname, '../../../../../');
                            this.getSuffixAndHash(projectPath, () => {
                                // После загрузки titleConfig обновляем редактор версий
                                this.displayVersionEditor();
                            });
                        }
                    }
                );

                // Reinitialize validator
                const projectRoot = join(__dirname, '../../../../../');
                validator = new Validator(projectRoot);

                // Load versions
                this.getVersions(projectRoot);

                // Start validation
                this.runValidation();

                // Initialize cleanup checkboxes visibility
                this.toggleClearDistVisibility();
                this.toggleClearSftpVisibility();

                // Check for builder updates
                this.checkForBuilderUpdate();

                // Restore button after some time
                setTimeout(() => {
                    refreshButton.disabled = false;
                    refreshButton.classList.remove('loading');
                    refreshButton.textContent = '↻';
                    this.appendLog('Data updated', 'success');
                }, 2000);
            }, 500);
        },

        // Clear current data
        clearCurrentData() {
            // Clear versions
            const versionsList = this.$.versionsList as HTMLElement;
            if (versionsList) {
                versionsList.innerHTML = '';
            }

            // Clear playable information
            const suffixElement = this.$.suffixElement as HTMLElement;
            const hashElement = this.$.hashedFolderElement as HTMLElement;
            const clientElement = this.$.clientElement as HTMLElement;
            const titleKeyElement = this.$.titleKeyElement as HTMLElement;
            const languagesElement = this.$.languagesElement as HTMLElement;

            if (suffixElement) suffixElement.innerHTML = '-';
            if (hashElement) hashElement.innerHTML = '-';
            if (clientElement) clientElement.innerHTML = '-';
            if (titleKeyElement) titleKeyElement.innerHTML = '-';
            if (languagesElement) languagesElement.innerHTML = '-';
        },

        // Проверка наличия обновления билдера
        checkForBuilderUpdate() {
            try {
                const projectPath = join(__dirname, '../../../../../');
                const updateManager = new UpdateManager(projectPath);
                const updateInfo = updateManager.checkForUpdate();

                console.log('Проверка обновлений билдера:', {
                    currentVersion: updateInfo.currentVersion,
                    latestVersion: updateInfo.latestVersion,
                    hasUpdate: updateInfo.hasUpdate
                });

                if (updateInfo.hasUpdate && updateInfo.latestVersion) {
                    // Показываем кнопку обновления
                    const updateButton = this.$.updateBuilderButton as HTMLButtonElement;
                    if (updateButton) {
                        updateButton.classList.remove('hidden');
                        updateButton.title = `Update builder from ${updateInfo.currentVersion} to ${updateInfo.latestVersion}`;
                        this.appendLog(`🔄 Доступно обновление билдера: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`, 'warn');
                    } else {
                        console.warn('Кнопка обновления не найдена в DOM');
                    }
                } else {
                    // Скрываем кнопку обновления
                    const updateButton = this.$.updateBuilderButton as HTMLButtonElement;
                    if (updateButton) {
                        updateButton.classList.add('hidden');
                    }
                    // Логируем, если версии найдены, но обновления нет
                    if (updateInfo.currentVersion && updateInfo.latestVersion) {
                        console.log(`Билдер актуален: ${updateInfo.currentVersion} (последняя версия: ${updateInfo.latestVersion})`);
                    } else {
                        console.warn('Не удалось определить версии:', {
                            currentVersion: updateInfo.currentVersion,
                            latestVersion: updateInfo.latestVersion
                        });
                    }
                }
            } catch (error) {
                console.error('Ошибка при проверке обновлений билдера:', error);
                this.appendLog(`❌ Ошибка при проверке обновлений: ${error}`, 'error');
            }
        },

        // Обновление билдера
        async updateBuilder() {
            const updateButton = this.$.updateBuilderButton as HTMLButtonElement;
            if (!updateButton) return;

            // Блокируем кнопку и показываем индикатор загрузки
            updateButton.disabled = true;
            updateButton.textContent = '⏳ Обновление...';

            try {
                const projectPath = join(__dirname, '../../../../../');
                const updateManager = new UpdateManager(projectPath);

                this.appendLog('🔄 Начинаю обновление билдера...', 'warn');

                const result = await updateManager.updateBuilder();

                if (result.success) {
                    this.appendLog('✅ Билдер успешно обновлен! Перезапустите панель для применения изменений.', 'success');
                    updateButton.textContent = '✅ Обновлено';
                    updateButton.disabled = true;

                    // Показываем поп-ап о необходимости переоткрыть панель
                    if (modalManager) {
                        modalManager.showUpdateCompletedModal();
                    }

                    // Скрываем кнопку через некоторое время
                    setTimeout(() => {
                        updateButton.classList.add('hidden');
                    }, 3000);
                } else {
                    this.appendLog(`❌ Ошибка при обновлении билдера: ${result.error}`, 'error');
                    updateButton.textContent = '🔄 Update';
                    updateButton.disabled = false;
                }
            } catch (error: any) {
                this.appendLog(`❌ Ошибка при обновлении билдера: ${error.message || error}`, 'error');
                updateButton.textContent = '🔄 Update';
                updateButton.disabled = false;
            }
        },

        // Manage visibility of dist folder cleanup checkbox
        toggleClearDistVisibility() {
            const superhtmlCheckbox = this.$.superhtmlCheckbox as HTMLInputElement;
            const clearDistLabel = this.$.clearDistLabel as HTMLElement;

            if (!superhtmlCheckbox || !clearDistLabel) return;

            if (superhtmlCheckbox.checked) {
                clearDistLabel.classList.remove('hidden');
            } else {
                clearDistLabel.classList.add('hidden');
            }
        },

        // Manage visibility of SFTP folder cleanup checkbox
        toggleClearSftpVisibility() {
            const sftpCheckbox = this.$.sftpCheckbox as HTMLInputElement;
            const clearSftpLabel = this.$.clearSftpLabel as HTMLElement;

            if (!sftpCheckbox || !clearSftpLabel) return;

            if (sftpCheckbox.checked) {
                clearSftpLabel.classList.remove('hidden');
            } else {
                clearSftpLabel.classList.add('hidden');
            }
        },

        // Manage SFTP checkbox availability
        setSftpCheckboxEnabled(enabled: boolean) {
            // If build is in progress, don't unlock checkboxes
            if (isBuilding) {
                return;
            }

            const sftpCheckbox = this.$.sftpCheckbox as HTMLInputElement;
            const clearSftpCheckbox = this.$.clearSftpCheckbox as HTMLInputElement;
            const superhtmlCheckbox = this.$.superhtmlCheckbox as HTMLInputElement;

            // Allow SFTP if either folder exists or SuperHTML build is enabled
            const sftpAllowed = enabled || (superhtmlCheckbox && superhtmlCheckbox.checked);

            if (sftpCheckbox) {
                sftpCheckbox.disabled = !sftpAllowed;
                if (!sftpAllowed) {
                    sftpCheckbox.checked = false;
                }
            }

            if (clearSftpCheckbox) {
                clearSftpCheckbox.disabled = !sftpAllowed;
                if (!sftpAllowed) {
                    clearSftpCheckbox.checked = false;
                }
            }

            // Also manage visibility of SFTP cleanup label
            this.toggleClearSftpVisibility();
        },

        // Manage state of all checkboxes (enable/disable)
        setCheckboxesEnabled(enabled: boolean) {
            const checkboxes = [
                this.$.mainBuildCheckbox,
                this.$.superhtmlCheckbox,
                this.$.clearDistCheckbox,
                this.$.sftpCheckbox,
                this.$.clearSftpCheckbox
            ] as HTMLInputElement[];

            checkboxes.forEach(checkbox => {
                if (checkbox) {
                    // If main build checkbox is forcibly locked, don't touch it when locking
                    if (checkbox === this.$.mainBuildCheckbox && checkbox.disabled && !enabled) {
                        return; // Skip if it's already locked and we want to lock
                    }
                    // If SFTP checkbox is locked due to missing folder, don't touch it
                    if ((checkbox === this.$.sftpCheckbox || checkbox === this.$.clearSftpCheckbox) && checkbox.disabled) {
                        return; // Пропускаем, если SFTP галочки уже заблокированы
                    }
                    checkbox.disabled = !enabled;
                }
            });

            // Также управляем видимостью лейблов очистки
            this.toggleClearDistVisibility();
            this.toggleClearSftpVisibility();
        },

        // Принудительно разблокировать все галочки (для завершения/отмены сборки)
        forceEnableAllCheckboxes() {
            const projectPath = join(__dirname, '../../../../../');
            const sftpFolderExists = this.checkSftpFolderExists(projectPath);
            const superhtmlCheckbox = this.$.superhtmlCheckbox as HTMLInputElement;

            const checkboxes = [
                this.$.mainBuildCheckbox,
                this.$.superhtmlCheckbox,
                this.$.clearDistCheckbox,
                this.$.sftpCheckbox,
                this.$.clearSftpCheckbox
            ] as HTMLInputElement[];

            checkboxes.forEach(checkbox => {
                if (checkbox) {
                    // Если это SFTP галочки, проверяем доступность
                    if (checkbox === this.$.sftpCheckbox || checkbox === this.$.clearSftpCheckbox) {
                        const sftpAllowed = sftpFolderExists || (superhtmlCheckbox && superhtmlCheckbox.checked);
                        if (!sftpAllowed) {
                            return; // Пропускаем SFTP галочки, если они недоступны
                        }
                    }
                    checkbox.disabled = false;
                }
            });

            // Также управляем видимостью лейблов очистки
            this.toggleClearDistVisibility();
            this.toggleClearSftpVisibility();
        },

        // Очистка папки dist
        clearDistFolder(projectPath: string): Promise<void> {
            return new Promise<void>((resolve) => {
                const distPath = join(projectPath, 'dist');

                this.appendLog(`Clearing dist folder: ${distPath}`, 'warn');

                // Используем кроссплатформенную команду для удаления папки
                const command = PlatformUtils.spawnCommand(PlatformUtils.getRemoveDirectoryCommand(distPath), [], {
                    cwd: projectPath
                });

                command.stdout.on('data', (data: Buffer) => {
                    this.appendLog(data.toString());
                });

                command.stderr.on('data', (data: Buffer) => {
                    this.appendLog(data.toString(), 'error');
                });

                command.on('close', (code: number | null) => {
                    if (code === 0) {
                        this.appendLog('Dist folder successfully cleared', 'success');
                    } else {
                        this.appendLog(`Error clearing dist folder (code ${code})`, 'error');
                    }
                    resolve();
                });
            });
        },

        // Getting clean-info information for SFTP
        getSftpCleanInfo(projectPath: string): Promise<string> {
            return new Promise<string>((resolve) => {
                const command = PlatformUtils.runNpmCommand('run sftp -- clean-info', projectPath);
                runningProcesses.push(command);

                let cleanInfo = '';
                let errorInfo = '';

                command.stdout.on('data', (data: Buffer) => {
                    const log = data.toString();
                    cleanInfo += log;
                    // Parse structured logs in real time
                    progressManager.parseSftpLogs(log);

                });

                command.stderr.on('data', (data: Buffer) => {
                    const errorLog = data.toString();
                    errorInfo += errorLog;
                });

                command.on('close', (code: number | null) => {
                    runningProcesses = runningProcesses.filter(p => p !== command);

                    if (code === 0) {
                        // If we have structured data, use it
                        const sftpCleanInfo = progressManager.getSftpCleanInfo();

                        if (sftpCleanInfo.items.length > 0) {
                            resolve('Structured information loaded');
                        } else {
                            // Fallback to old parsing
                            const lines = cleanInfo.split('\n');
                            let infoText = '';

                            for (const line of lines) {
                                const trimmedLine = line.trim();

                                // Skip service messages
                                if (trimmedLine.includes('Configuration:') ||
                                    trimmedLine.includes('Waiting for connection') ||
                                    trimmedLine.includes('Sftp client connected') ||
                                    trimmedLine.includes('Total files to upload') ||
                                    trimmedLine.includes('GET CLEAN INFO') ||
                                    trimmedLine.includes('Information collection completed')) {
                                    continue;
                                }

                                // Start collecting information from the moment elements are found
                                if (trimmedLine.includes('Found') && trimmedLine.includes('elements')) {
                                    infoText += trimmedLine + '\n';
                                    continue;
                                }

                                // Collect information about files and folders
                                if (trimmedLine.includes('FOLDER:') || trimmedLine.includes('FILE:')) {
                                    infoText += trimmedLine + '\n';
                                    continue;
                                }

                                // Collect statistics
                                if (trimmedLine.includes('STATISTICS:') || trimmedLine.includes('Total elements:') ||
                                    trimmedLine.includes('Files:') || trimmedLine.includes('Folders:') ||
                                    trimmedLine.includes('Total file size:') || trimmedLine.includes('ALL THESE ELEMENTS WILL BE DELETED')) {
                                    infoText += trimmedLine + '\n';
                                    continue;
                                }

                                // If folder doesn't exist or is empty
                                if (trimmedLine.includes('does not exist') || trimmedLine.includes('already empty')) {
                                    infoText = trimmedLine;
                                    break;
                                }
                            }

                            resolve(infoText || 'Folder information not found');
                        }
                    } else {
                        resolve(errorInfo || 'Error getting SFTP folder information');
                    }
                });
            });
        },



        // Automatic data update after build (without blocking button)
        refreshDataAfterBuild() {
            // Clear current data
            this.clearCurrentData();

            // Update data
            setTimeout(() => {
                const projectPath = join(__dirname, '../../../../../');
                this.getVersions(projectPath);

                // Check if SFTP folder appeared after build
                setTimeout(() => {
                    const sftpFolderExists = this.checkSftpFolderExists(projectPath);
                    if (sftpFolderExists) {
                        this.setSftpCheckboxEnabled(true);
                        this.appendLog('✅ Dist/sftp folder found. SFTP upload is now available.', 'success');
                    }
                }, 1000);

                // Log successful update
                setTimeout(() => {
                    this.appendLog('Data automatically updated after build', 'success');
                }, 1500);
            }, 500);
        },
        // updateStatus(status: string) {
        //     const buildStatus = this.$.buildStatus as HTMLElement;
        //     if (buildStatus) buildStatus.textContent = status;
        // },

        toggleBuildButton(building: boolean) {
            const btn = this.$.buildButton as HTMLButtonElement;
            if (!btn) return;
            isBuilding = building;
            btn.textContent = building ? 'Cancel' : 'Build';
        },

        // Functions for managing progress checklist
        showBuildProgress() {
            const lastBuildInfo = this.$.lastBuildInfo as HTMLElement;

            // Reset all section states to initial state
            progressManager.resetAllSections();

            // Hide last build information
            if (lastBuildInfo) {
                lastBuildInfo.classList.add('hidden');
            }
        },

        hideBuildProgress() {
            // Reset all section states to initial state
            progressManager.resetAllSections();
        },



        showLastBuildInfo() {
            const lastBuildInfo = this.$.lastBuildInfo as HTMLElement;
            const lastBuildSummary = this.$.lastBuildSummary as HTMLElement;
            const buildTimeElement = this.$.buildTime as HTMLElement;
            const completedTasksElement = this.$.completedTasks as HTMLElement;
            const buildLinksElement = this.$.buildLinks as HTMLElement;
            const builtFilesElement = this.$.builtFiles as HTMLElement;

            if (!lastBuildInfo || !lastBuildSummary || !buildTimeElement || !completedTasksElement || !buildLinksElement || !builtFilesElement) return;

            // Calculate total build time
            const endTime = new Date();
            const buildDuration = Math.round((endTime.getTime() - buildStartTime.getTime()) / 1000);
            const minutes = Math.floor(buildDuration / 60);
            const seconds = buildDuration % 60;
            const timeString = `${minutes}m ${seconds}s (${buildStartTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()})`;

            buildTimeElement.textContent = timeString;

            // Clear previous tasks
            completedTasksElement.innerHTML = '';

            // Create a copy of current tasks to avoid duplication on multiple calls
            // Use Set to ensure unique tasks only
            const uniqueTasks = [...new Set(currentBuildTasks)];

            // Add completed tasks with execution time
            uniqueTasks.forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'completed-task';

                // Determine execution time for each task
                let taskTime = '';
                const stageTimings = progressManager.getStageTimings();
                if (task === 'Main Build' && stageTimings.mainBuild?.duration !== undefined) {
                    taskTime = ` - ${progressManager.formatStageTime(stageTimings.mainBuild.duration)}`;
                } else if (task === 'SuperHTML Build' && stageTimings.superHtmlBuild?.duration !== undefined) {
                    taskTime = ` - ${progressManager.formatStageTime(stageTimings.superHtmlBuild.duration)}`;
                } else if (task === 'SFTP Upload' && stageTimings.sftpLoad?.duration !== undefined) {
                    taskTime = ` - ${progressManager.formatStageTime(stageTimings.sftpLoad.duration)}`;
                }

                taskElement.textContent = task + taskTime;
                completedTasksElement.appendChild(taskElement);
            });

            // Display maximum playable size with retry mechanism
            this.displayFileSizeWithRetry(builtFilesElement, lastBuildSummary);

            // Clear previous links
            buildLinksElement.innerHTML = '';

            // Add build result links
            this.addBuildResultLinks(buildLinksElement);

            // Show information block
            lastBuildInfo.classList.remove('hidden');
            lastBuildInfo.classList.add('fade-in');

            // Clear file data after display (for next build)
            // Do this with delay so user can see the information
            setTimeout(() => {
                progressManager.clearBuiltFiles();
            }, 10000); // Clear after 10 seconds of display
        },

        // New method for displaying file size with retries
        displayFileSizeWithRetry(builtFilesElement: HTMLElement, lastBuildSummary: HTMLElement, retryCount: number = 0) {
            const maxRetries = 5; // Maximum 5 attempts
            const retryDelay = 1000; // 1 second delay between attempts

            builtFilesElement.innerHTML = '';
            const maxFileSize = progressManager.getMaxFileSize();


            if (maxFileSize) {
                const sizeElement = document.createElement('div');
                sizeElement.className = 'built-file';

                // Check if size exceeds 4.5 MB (4500 KB)
                const isOversized = maxFileSize.sizeKB > 4500;
                const sizeClass = isOversized ? 'built-file-oversized' : '';

                // Update spoiler header with icon if size exceeded
                if (isOversized) {
                    lastBuildSummary.innerHTML = '⚠️ Last Build';
                    lastBuildSummary.classList.add('oversized-warning');
                } else {
                    lastBuildSummary.textContent = 'Last Build';
                    lastBuildSummary.classList.remove('oversized-warning');
                }

                sizeElement.innerHTML = `
                    <div class="built-file-info">
                        <div class="built-file-name">Maximum playable size:</div>
                        <div class="built-file-details ${sizeClass}">${maxFileSize.sizeKB}KB (${maxFileSize.fileName})</div>
                    </div>
                `;
                builtFilesElement.appendChild(sizeElement);
            } else if (retryCount < maxRetries) {
                // If size not found and there are attempts, wait and try again
                const retryElement = document.createElement('div');
                retryElement.className = 'built-file';
                retryElement.style.color = '#888';
                retryElement.textContent = `Waiting for size data... (attempt ${retryCount + 1}/${maxRetries})`;
                builtFilesElement.appendChild(retryElement);

                // Reset spoiler header
                lastBuildSummary.textContent = 'Last Build';
                lastBuildSummary.classList.remove('oversized-warning');

                // Retry after delay
                setTimeout(() => {
                    this.displayFileSizeWithRetry(builtFilesElement, lastBuildSummary, retryCount + 1);
                }, retryDelay);
            } else {
                // If all attempts exhausted, show error message
                const noFilesElement = document.createElement('div');
                noFilesElement.className = 'built-file';
                noFilesElement.style.color = '#888';
                noFilesElement.textContent = 'Failed to determine file size';
                builtFilesElement.appendChild(noFilesElement);

                // Reset spoiler header
                lastBuildSummary.textContent = 'Last Build';
                lastBuildSummary.classList.remove('oversized-warning');
            }
        },

        // Method for adding build result links
        addBuildResultLinks(container: HTMLElement) {
            const projectPath = join(__dirname, '../../../../../');
            const mainBuildEnabled = (this.$.mainBuildCheckbox as HTMLInputElement).checked;
            const superHtmlEnabled = (this.$.superhtmlCheckbox as HTMLInputElement).checked;
            const loadToSftp = (this.$.sftpCheckbox as HTMLInputElement).checked;

            // Link to build folder (for main build)
            if (mainBuildEnabled && currentBuildTasks.includes('Main Build')) {
                const buildFolderLink = this.createBuildLink(
                    '📁 Open build folder',
                    () => this.openFolder(join(projectPath, 'build')),
                    'folder-link'
                );
                container.appendChild(buildFolderLink);
            }

            // Link to dist folder (for SuperHTML build)
            if (superHtmlEnabled && currentBuildTasks.includes('SuperHTML Build')) {
                const distFolderLink = this.createBuildLink(
                    '📁 Open dist folder',
                    () => this.openFolder(join(projectPath, 'dist')),
                    'folder-link'
                );
                container.appendChild(distFolderLink);
            }

            // Links to HTML files (after SFTP upload)
            if (loadToSftp && currentBuildTasks.includes('SFTP Upload')) {
                // Link to info.html (remote URL)
                if (remoteUrls.infoUrl) {
                    const infoHtmlLink = this.createBuildLink(
                        '🌐 Open info.html',
                        () => this.openRemoteUrl(remoteUrls.infoUrl!),
                        'html-link'
                    );
                    container.appendChild(infoHtmlLink);
                }

                // Link to info-qa.html (remote URL)
                if (remoteUrls.infoQaUrl) {
                    const infoQaHtmlLink = this.createBuildLink(
                        '🌐 Open info-qa.html',
                        () => this.openRemoteUrl(remoteUrls.infoQaUrl!),
                        'html-link'
                    );
                    container.appendChild(infoQaHtmlLink);
                }
            }
        },

        // Method for creating build result link
        createBuildLink(text: string, onClick: () => void, className: string): HTMLElement {
            const link = document.createElement('button');
            link.className = `build-link ${className}`;
            link.textContent = text;
            link.addEventListener('click', onClick);
            return link;
        },

        // Method for opening folder in file manager
        openFolder(folderPath: string) {
            try {
                const { spawn } = require('child_process');
                // Open folder in Windows Explorer
                spawn('explorer', [folderPath], { shell: true });
                this.appendLog(`Folder opened: ${folderPath}`, 'success');
            } catch (error) {
                this.appendLog(`Error opening folder: ${error}`, 'error');
            }
        },

        // Method for opening HTML file in browser
        openHtmlFile(filePath: string) {
            try {
                PlatformUtils.openFile(filePath);
                this.appendLog(`File opened: ${filePath}`, 'success');
            } catch (error) {
                this.appendLog(`Error opening file: ${error}`, 'error');
            }
        },

        // Method for opening remote URL in browser
        openRemoteUrl(url: string) {
            try {
                PlatformUtils.openUrl(url);
                this.appendLog(`URL opened: ${url}`, 'success');
            } catch (error) {
                this.appendLog(`Error opening URL: ${error}`, 'error');
            }
        },

        // Method for opening versions.cjs file
        openVersionFile() {
            try {
                const projectPath = join(__dirname, '../../../../../');
                const versionFilePath = join(projectPath, 'versions.cjs');

                // Check file existence
                if (!existsSync(versionFilePath)) {
                    this.appendLog(`versions.cjs file not found: ${versionFilePath}`, 'error');
                    return;
                }

                PlatformUtils.openFile(versionFilePath);
                this.appendLog(`versions.cjs file opened: ${versionFilePath}`, 'success');
            } catch (error) {
                this.appendLog(`Error opening versions.cjs file: ${error}`, 'error');
            }
        },

        // Method for updating data from versions.cjs file
        refreshVersionFile() {
            try {
                const projectPath = join(__dirname, '../../../../../');
                const versionFilePath = join(projectPath, 'versions.cjs');

                // Check file existence
                if (!existsSync(versionFilePath)) {
                    this.appendLog(`versions.cjs file not found: ${versionFilePath}`, 'error');
                    return;
                }

                this.appendLog('Updating data from versions.cjs file...', 'warn');
                this.appendLog(`File path: ${versionFilePath}`, 'warn');

                // Clear require cache for this file
                delete require.cache[require.resolve(versionFilePath)];
                this.appendLog('Require cache cleared', 'warn');

                // Clear current data
                this.clearCurrentData();
                this.appendLog('Current data cleared', 'warn');

                // Reload versions
                this.getVersions(projectPath);

                // Сохраняем оригинальные версии и хранилище переменных, сбрасываем флаг изменений
                // (getVersions уже загружает и обновляет originalVersions и originalVariablesStorage)
                hasUnsavedChanges = false;

                // Refresh version editor
                this.displayVersionEditor();

                this.appendLog('Data from versions.cjs file successfully updated', 'success');
            } catch (error) {
                this.appendLog(`Error updating versions.cjs file: ${error}`, 'error');
            }
        },

        // Initialize tooltip system
        initializeTooltips() {
            // Add handlers for all elements with tooltips
            const elementsWithTooltips = document.querySelectorAll('[title]');

            elementsWithTooltips.forEach(element => {
                // Remove standard title to avoid duplication
                const originalTitle = element.getAttribute('title');
                if (originalTitle) {
                    element.removeAttribute('title');
                    element.setAttribute('data-tooltip', originalTitle);

                    // Add event handlers
                    element.addEventListener('mouseenter', this.showTooltip.bind(this));
                    element.addEventListener('mouseleave', this.hideTooltip.bind(this));
                    element.addEventListener('focus', this.showTooltip.bind(this));
                    element.addEventListener('blur', this.hideTooltip.bind(this));
                }
            });
        },

        // Show tooltip
        showTooltip(event: Event) {
            const element = event.target as HTMLElement;
            const tooltipText = element.getAttribute('data-tooltip');

            if (!tooltipText) return;

            // Create tooltip element if it doesn't exist
            let tooltip = document.getElementById('custom-tooltip');
            if (!tooltip) {
                tooltip = document.createElement('div');
                tooltip.id = 'custom-tooltip';
                tooltip.className = 'custom-tooltip';
                document.body.appendChild(tooltip);
            }

            // Set text and position
            tooltip.textContent = tooltipText;
            tooltip.style.display = 'block';

            // Position tooltip
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();

            let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
            let top = rect.top - tooltipRect.height - 8;

            // Check screen boundaries
            if (left < 8) left = 8;
            if (left + tooltipRect.width > window.innerWidth - 8) {
                left = window.innerWidth - tooltipRect.width - 8;
            }
            if (top < 8) {
                top = rect.bottom + 8; // Show below if doesn't fit above
            }

            tooltip.style.left = left + 'px';
            tooltip.style.top = top + 'px';

            // Add class for animation
            setTimeout(() => {
                tooltip.classList.add('visible');
            }, 10);
        },

        // Hide tooltip
        hideTooltip(event: Event) {
            const tooltip = document.getElementById('custom-tooltip');
            if (tooltip) {
                tooltip.classList.remove('visible');
                setTimeout(() => {
                    tooltip.style.display = 'none';
                }, 200);
            }
        },

        cancelBuild() {
            isBuilding = false;
            for (const proc of runningProcesses) {
                if (proc.pid) {
                    // Кроссплатформенное завершение процесса
                    if (PlatformUtils.isWindows()) {
                        spawn('taskkill', ['/PID', proc.pid.toString(), '/F', '/T']);
                    } else {
                        // macOS и Linux
                        process.kill(proc.pid, 'SIGTERM');
                    }
                }
            }
            runningProcesses = [];
            this.toggleBuildButton(false);
            // this.updateStatus('Cancelled');
            this.appendLog('All processes cancelled', 'warn');

            // First reset all progress states and animations
            this.hideBuildProgress();

            // Then with delay unlock checkboxes
            setTimeout(() => {
                // Force enable all checkboxes back
                this.forceEnableAllCheckboxes();
            }, 500);

            // Clear all time intervals
            progressManager.clearAllProgressTimeIntervals();
        },
        runSuperHtmlBuild(projectPath: string) {
            return new Promise<void>((resolve) => {
                if (!isBuilding) { resolve(); return; }

                // Check if we need to clear dist folder
                const clearDistEnabled = (this.$.clearDistCheckbox as HTMLInputElement).checked;

                const runBuild = () => {
                    // Show progress bar for SuperHTML build
                    progressManager.showSectionProgress('superHtml');

                    // Initialize SuperHTML progress
                    const superHtmlProgress = progressManager.getSuperHtmlProgress();
                    superHtmlProgress.percentage = 0;
                    superHtmlProgress.currentTask = 'Starting...';
                    progressManager.updateSuperHtmlProgress();

                    // Update progress through ProgressManager
                    // this.updateStatus('Building SuperHTML...');
                    this.appendLog('Starting SuperHTML build...');

                    // Start time tracking
                    progressManager.startStageTiming('superHtmlBuild');

                    const command = PlatformUtils.runNpmCommand('run build', projectPath);
                    runningProcesses.push(command);

                    command.stdout.on('data', (data: Buffer) => this.appendLog(data.toString()));
                    command.stderr.on('data', (data: Buffer) => this.appendLog(data.toString(), 'error'));

                    command.on('close', (code: number | null) => {
                        runningProcesses = runningProcesses.filter(p => p !== command);

                        if (!isBuilding) {
                            this.appendLog('SuperHTML build was cancelled', 'warn');
                            resolve();
                            return;
                        }

                        if (code === 0) {
                            // Force complete SuperHTML build progress
                            progressManager.forceCompleteSuperHtmlBuild();
                            currentBuildTasks.push('SuperHTML Build');
                            this.appendLog(`SuperHTML build completed successfully`, 'success');

                            // Update data after successful SuperHTML build
                            this.appendLog('Updating data after SuperHTML build...', 'warn');
                            this.refreshDataAfterBuild();
                        } else {
                            this.appendLog(`SuperHTML build completed with error (code ${code})`, 'error');
                        }

                        // End time tracking
                        progressManager.endStageTiming('superHtmlBuild');

                        resolve();
                    });
                };

                // If we need to clear dist folder, do it before build
                if (clearDistEnabled) {
                    this.clearDistFolder(projectPath).then(() => {
                        if (isBuilding) {
                            runBuild();
                        } else {
                            resolve();
                        }
                    });
                } else {
                    runBuild();
                }
            });
        },
        runSFTPLoad(projectPath: string) {
            return new Promise<void>((resolve) => {
                if (!isBuilding) { resolve(); return; }

                // Check if we need to clear SFTP folder
                const clearSftpEnabled = (this.$.clearSftpCheckbox as HTMLInputElement).checked;

                const runSftpLoad = () => {
                    // Show progress bar for SFTP
                    this.appendLog('Showing SFTP progress bar...', 'warn');
                    progressManager.showSectionProgress('sftp');

                    // Initialize SFTP progress
                    const sftpProgress = progressManager.getSftpProgress();
                    sftpProgress.percentage = 0;
                    sftpProgress.current = 0;
                    sftpProgress.total = 1; // Set 1 to show task has started
                    progressManager.updateSftpProgress();

                    // Update progress through ProgressManager
                    // this.updateStatus('Uploading to server...');
                    this.appendLog('Starting SFTP upload...');

                    // Start time tracking
                    progressManager.startStageTiming('sftpLoad');

                    // Form command depending on need for cleanup
                    const sftpCommand = clearSftpEnabled ? 'run sftp clean' : 'run sftp';
                    const command = PlatformUtils.runNpmCommand(sftpCommand, projectPath);
                    runningProcesses.push(command);

                    command.stdout.on('data', (data: Buffer) => {
                        const log = data.toString();
                        this.appendLog(log);
                        // Parse structured SFTP logs in real time
                        progressManager.parseSftpLogs(log);
                    });
                    command.stderr.on('data', (data: Buffer) => this.appendLog(data.toString(), 'error'));

                    command.on('close', (code: number | null) => {
                        runningProcesses = runningProcesses.filter(p => p !== command);

                        if (!isBuilding) {
                            this.appendLog('SFTP upload was cancelled', 'warn');
                            resolve();
                            return;
                        }

                        if (code === 0) {
                            // Force complete SFTP progress
                            progressManager.forceCompleteSftpProgress();
                            currentBuildTasks.push('SFTP Upload');
                            this.appendLog(`SFTP upload completed successfully`, 'success');

                            // Update data after successful SFTP upload
                            this.appendLog('Updating data after SFTP upload...', 'warn');
                            this.refreshDataAfterBuild();
                        } else {
                            this.appendLog(`SFTP upload completed with error (code ${code})`, 'error');
                        }

                        // End time tracking
                        progressManager.endStageTiming('sftpLoad');

                        resolve();
                    });
                };

                // If we need to clear SFTP folder, show warning
                if (clearSftpEnabled) {
                    this.appendLog('⚠️ SFTP folder cleanup enabled before upload', 'warn');
                }

                runSftpLoad();
            });
        },
        // Check build/web-mobile folder existence
        checkBuildFolderExists(projectPath: string): boolean {
            const buildPath = join(projectPath, 'build', 'web-mobile');
            return existsSync(buildPath);
        },

        // Check dist/sftp folder existence
        checkSftpFolderExists(projectPath: string): boolean {
            const sftpPath = join(projectPath, 'dist', 'sftp');
            return existsSync(sftpPath);
        },

        // Check config through buildHandler
        async checkBuildHandlerConfig(projectPath: string): Promise<boolean> {
            return new Promise<boolean>((resolve) => {
                const command = PlatformUtils.runNpmCommand('run build info', projectPath);
                runningProcesses.push(command);

                let hasValidConfig = false;

                command.stdout.on('data', (data: Buffer) => {
                    const log = data.toString().trim();
                    // If we got JSON with config, build exists
                    if (log.includes('"name"') || log.includes('"suffix"')) {
                        hasValidConfig = true;
                    }
                });

                command.stderr.on('data', (data: Buffer) => {
                    // If there is error, build does not exist
                    hasValidConfig = false;
                });

                command.on('close', (code: number | null) => {
                    runningProcesses = runningProcesses.filter(p => p !== command);
                    resolve(hasValidConfig && code === 0);
                });
            });
        },

        // Check necessity of forced main build activation
        async checkAndForceMainBuild(projectPath: string) {
            const buildFolderExists = this.checkBuildFolderExists(projectPath);
            const hasValidConfig = await this.checkBuildHandlerConfig(projectPath);

            const shouldForceMainBuild = !buildFolderExists || !hasValidConfig;

            if (shouldForceMainBuild) {
                const mainBuildCheckbox = this.$.mainBuildCheckbox as HTMLInputElement;
                if (mainBuildCheckbox) {
                    mainBuildCheckbox.checked = true;
                    mainBuildCheckbox.disabled = true; // Block ability to uncheck
                    this.appendLog('⚠️ Main build forcibly activated (build/web-mobile folder or config missing)', 'warn');
                }
            } else {
                const mainBuildCheckbox = this.$.mainBuildCheckbox as HTMLInputElement;
                if (mainBuildCheckbox) {
                    // Unlock only if build is not running
                    if (!isBuilding) {
                        mainBuildCheckbox.disabled = false; // Unlock management ability
                    }
                }
            }

            return shouldForceMainBuild;
        },

        getVersions(projectPath: string) {
            return new Promise<void>((resolve) => {
                try {
                    // Clear require cache for versions.cjs file
                    const versionFilePath = join(projectPath, 'versions.cjs');
                    if (existsSync(versionFilePath)) {
                        delete require.cache[require.resolve(versionFilePath)];
                    }

                    // Load versions directly from file
                    const versionsManager = new VersionsManager(projectPath);
                    versions = versionsManager.loadVersions();
                    // Загружаем хранилище переменных
                    variablesStorage = versionsManager.loadVariablesStorage();
                    // Загружаем выбранную версию
                    selectedVersionName = versionsManager.loadSelectedVersion();

                    // Удаляем поле selected из версий (если оно есть) - теперь используем selectedVersionName
                    versions.forEach(version => {
                        if ('selected' in version) {
                            delete version.selected;
                        }
                    });

                    // Извлекаем переменные из версий и добавляем в хранилище, если их там нет
                    versions.forEach(version => {
                        Object.keys(version).forEach(key => {
                            if (key !== 'name' && key !== 'version' && key !== 'selected' && !(key in variablesStorage)) {
                                // Добавляем переменную в хранилище с дефолтным значением из версии
                                variablesStorage[key] = version[key];
                            }
                        });
                    });

                    // Применяем обязательные переменные из конфига (если titleConfig уже загружен)
                    if (titleConfig && titleConfig.requiredVariables) {
                        requiredVariables = { ...titleConfig.requiredVariables };
                        this.applyRequiredVariables();
                    }

                    // Сохраняем оригинальные версии и хранилище для сравнения
                    originalVersions = JSON.parse(JSON.stringify(versions));
                    originalVariablesStorage = JSON.parse(JSON.stringify(variablesStorage));
                    originalSelectedVersionName = selectedVersionName;
                    hasUnsavedChanges = false;

                    // Display version editor
                    this.displayVersionEditor();

                    // Check SFTP folder presence and manage checkbox availability
                    const sftpFolderExists = this.checkSftpFolderExists(projectPath);
                    this.setSftpCheckboxEnabled(sftpFolderExists);

                    if (!sftpFolderExists) {
                        const superhtmlCheckbox = this.$.superhtmlCheckbox as HTMLInputElement;
                        if (superhtmlCheckbox && superhtmlCheckbox.checked) {
                            this.appendLog('⚠️ dist/sftp folder not found, but SFTP upload is available thanks to enabled SuperHTML build.', 'success');
                        } else {
                            this.appendLog('⚠️ dist/sftp folder not found. SFTP upload unavailable until build is completed.', 'warn');
                        }
                    }

                    // Check necessity of forced main build activation
                    this.checkAndForceMainBuild(projectPath).then(() => {
                        // Get all information through external process (versions, hash, suffix, title config)
                        this.getSuffixAndHash(projectPath, resolve);
                    });
                } catch (error) {
                    this.appendLog(`Error loading versions: ${error}`, 'error');
                    resolve();
                }
            });
        },

        getSuffixAndHash(projectPath: string, resolve: () => void) {
            const command = PlatformUtils.runNpmCommand('run build info', projectPath);
            runningProcesses.push(command);

            let versionsData = '';
            let additionalInfoData = '';

            command.stdout.on('data', (data: Buffer) => {
                const log = data.toString().trim();

                // Split data into two parts: versions and additional information
                if (log.includes('"name"') && !log.includes('"suffix"')) {
                    // This is version data
                    versionsData = log;
                } else if (log.includes('"suffix"') || log.includes('"hashedFolder"')) {
                    // This is additional information
                    additionalInfoData = log;
                }

                // Process additional information
                if (additionalInfoData) {
                    try {
                        const additionalInfo = JSON.parse(additionalInfoData);

                        const suffixElement = this.$.suffixElement as HTMLElement;
                        const hashElement = this.$.hashedFolderElement as HTMLElement;
                        const clientElement = this.$.clientElement as HTMLElement;
                        const titleKeyElement = this.$.titleKeyElement as HTMLElement;
                        const languagesElement = this.$.languagesElement as HTMLElement;

                        // Update main fields
                        if (suffixElement) {
                            suffixElement.innerHTML = additionalInfo.suffix || '-';
                        }
                        if (hashElement) {
                            hashElement.innerHTML = additionalInfo.hashedFolder || '-';
                        }
                        if (clientElement) {
                            clientElement.innerHTML = additionalInfo.client || '-';
                        }
                        if (titleKeyElement) {
                            titleKeyElement.innerHTML = additionalInfo.titleKey || '-';
                        }
                        if (languagesElement) {
                            const languages = additionalInfo.languages || ['en'];
                            const formattedLanguages = Array.isArray(languages)
                                ? languages.map(lang => lang.replace(/^lang_/, '')).join(', ')
                                : languages.replace(/^lang_/, '');
                            languagesElement.innerHTML = formattedLanguages;
                        }

                        // Save title config (but don't display it)
                        if (additionalInfo.titleConfig) {
                            titleConfig = additionalInfo.titleConfig;
                            // Загружаем обязательные переменные из конфига тайтла
                            if (titleConfig.requiredVariables && typeof titleConfig.requiredVariables === 'object') {
                                requiredVariables = { ...titleConfig.requiredVariables };
                                // Принудительно добавляем обязательные переменные в версии
                                this.applyRequiredVariables();
                            } else {
                                requiredVariables = {};
                            }
                        }

                        // Display paths and naming information
                        if (additionalInfo.versionPaths && Array.isArray(additionalInfo.versionPaths)) {
                            this.displayVersionPaths(additionalInfo.versionPaths);
                        }
                    } catch (error) {
                        // Error parsing additional information
                    }
                }
            });

            command.stderr.on('data', (data: Buffer) => {
                const errorLog = data.toString();
                this.appendLog(errorLog, 'error');
            });

            command.on('close', (code: number | null) => {
                runningProcesses = runningProcesses.filter(p => p !== command);
                resolve();
            });
        },

        // Метод для отображения версий в виде спойлеров
        displayVersions() {
            const versionsList = this.$.versionsList as HTMLElement;  // Получаем контейнер для версий

            // Проверяем, что контейнер существует
            if (!versionsList) {
                return;
            }

            // Очищаем контейнер от старых данных
            versionsList.innerHTML = '';


            // Создаем спойлер для каждой версии
            versions.forEach((versionObj, index) => {
                // Создаем основной спойлер для версии
                const versionSpoiler = document.createElement('details');
                versionSpoiler.className = 'version-spoiler';

                // Создаем summary с названием версии
                const summary = document.createElement('summary');
                const versionName = versionObj.name || versionObj.version || `Version ${index + 1}`;
                summary.textContent = versionName;
                versionSpoiler.appendChild(summary);

                // Создаем контейнер для деталей версии
                const versionDetails = document.createElement('div');
                versionDetails.className = 'version-details';

                // Добавляем все поля версии
                Object.keys(versionObj).forEach(key => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'version-field';

                    const labelSpan = document.createElement('span');
                    labelSpan.className = 'version-field-label';
                    labelSpan.textContent = key.charAt(0).toUpperCase() + key.slice(1) + ':';

                    const valueSpan = document.createElement('span');
                    valueSpan.className = 'version-field-value';
                    valueSpan.textContent = versionObj[key] !== undefined ? versionObj[key] : '-';

                    fieldDiv.appendChild(labelSpan);
                    fieldDiv.appendChild(valueSpan);
                    versionDetails.appendChild(fieldDiv);
                });

                versionSpoiler.appendChild(versionDetails);
                versionsList.appendChild(versionSpoiler);
            });
        },

        // Метод для применения обязательных переменных из конфига тайтла
        applyRequiredVariables() {
            if (!requiredVariables || Object.keys(requiredVariables).length === 0) {
                return;
            }

            // Добавляем обязательные переменные в хранилище
            Object.keys(requiredVariables).forEach(varName => {
                if (!(varName in variablesStorage)) {
                    variablesStorage[varName] = requiredVariables[varName];
                }
            });

            // Принудительно добавляем обязательные переменные во все версии
            versions.forEach(version => {
                Object.keys(requiredVariables).forEach(varName => {
                    if (!(varName in version)) {
                        version[varName] = requiredVariables[varName];
                    }
                });
            });

            // Обновляем отображение, если редактор уже открыт
            if (this.$.versionEditor) {
                this.displayVersionEditor();
            }
        },

        // Метод для проверки, является ли переменная обязательной
        isRequiredVariable(variableName: string): boolean {
            return variableName in requiredVariables;
        },

        // Метод для получения всех переменных (из хранилища и из версий)
        getAllVariables(): Set<string> {
            const allVariables = new Set<string>(Object.keys(variablesStorage));

            // Добавляем обязательные переменные из конфига
            Object.keys(requiredVariables).forEach(varName => {
                allVariables.add(varName);
            });

            // Добавляем переменные из версий
            versions.forEach(version => {
                Object.keys(version).forEach(key => {
                    if (key !== 'name' && key !== 'version') {
                        allVariables.add(key);
                    }
                });
            });

            return allVariables;
        },

        // Метод для отображения редактора версий
        displayVersionEditor() {
            const versionEditor = this.$.versionEditor as HTMLElement;
            const variablesList = this.$.variablesList as HTMLElement;
            const versionsBuildList = this.$.versionsBuildList as HTMLElement;

            if (!versionEditor || !variablesList || !versionsBuildList) {
                return;
            }


            // Очищаем контейнеры
            variablesList.innerHTML = '';
            versionsBuildList.innerHTML = '';

            // Получаем все переменные (из хранилища и из версий)
            const allVariables = this.getAllVariables();

            // Отображаем все переменные
            allVariables.forEach(variableName => {
                const isRequired = this.isRequiredVariable(variableName);
                const variableItem = document.createElement('div');
                variableItem.className = isRequired ? 'variable-item required-variable' : 'variable-item';
                variableItem.draggable = true;
                variableItem.dataset.variableName = variableName;

                const nameSpan = document.createElement('span');
                nameSpan.className = 'variable-name';
                nameSpan.textContent = variableName;
                if (isRequired) {
                    nameSpan.title = 'Обязательная переменная (из конфига тайтла)';
                }

                // Получаем значение из хранилища, если есть, иначе из первой версии
                let defaultValue = variablesStorage[variableName];
                if (defaultValue === undefined) {
                    const exampleVersion = versions.find(v => variableName in v);
                    defaultValue = exampleVersion ? exampleVersion[variableName] : '';
                }

                // Создаем контейнер для значения и кнопки редактирования
                const valueContainer = document.createElement('div');
                valueContainer.className = 'variable-value-container';

                // Создаем отображаемое значение (readonly)
                const valueDisplay = document.createElement('span');
                valueDisplay.className = 'variable-value-display';
                valueDisplay.textContent = defaultValue !== undefined ? String(defaultValue) : '';
                valueDisplay.title = 'Дефолтное значение переменной';

                // Кнопка редактирования
                const editButton = document.createElement('button');
                editButton.className = 'variable-item-edit';
                editButton.textContent = '✎';
                editButton.title = 'Редактировать переменную';
                editButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showEditVariableModal(variableName);
                });

                // Кнопка удаления переменной из хранилища (показываем только если переменная в хранилище и не обязательная)
                let removeButton: HTMLElement | null = null;
                if (variableName in variablesStorage && !isRequired) {
                    removeButton = document.createElement('span');
                    removeButton.className = 'variable-item-remove';
                    removeButton.textContent = '×';
                    removeButton.title = 'Удалить переменную из хранилища';
                    removeButton.addEventListener('click', (e) => {
                        e.stopPropagation();
                        if (confirm(`Удалить переменную "${variableName}" из хранилища? Это не удалит её из версий, где она используется.`)) {
                            delete variablesStorage[variableName];
                            this.markVersionsAsChanged();
                            this.displayVersionEditor();
                        }
                    });
                }

                valueContainer.appendChild(valueDisplay);
                valueContainer.appendChild(editButton);

                variableItem.appendChild(nameSpan);
                variableItem.appendChild(valueContainer);
                if (removeButton) {
                    variableItem.appendChild(removeButton);
                }

                // Добавляем обработчики drag and drop
                variableItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer!.effectAllowed = 'move';
                    e.dataTransfer!.setData('text/plain', variableName);
                    variableItem.classList.add('dragging');
                });

                variableItem.addEventListener('dragend', () => {
                    variableItem.classList.remove('dragging');
                });

                variablesList.appendChild(variableItem);
            });

            // Отображаем контейнеры для версий
            versions.forEach((versionObj, index) => {
                const versionContainer = this.createVersionContainer(versionObj, index);
                versionsBuildList.appendChild(versionContainer);
            });

            // Убеждаемся, что обработчик кнопки добавления версии привязан
            const addVersionButton = document.getElementById('add-version-button') as HTMLButtonElement;
            if (addVersionButton) {
                // Удаляем старый обработчик, если есть
                const newButton = addVersionButton.cloneNode(true) as HTMLButtonElement;
                addVersionButton.parentNode?.replaceChild(newButton, addVersionButton);
                // Добавляем новый обработчик
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showAddVersionModal();
                });
            }

            // Убеждаемся, что обработчик кнопки добавления переменной привязан
            const addVariableButton = document.getElementById('add-variable-button') as HTMLButtonElement;
            if (addVariableButton) {
                // Удаляем старый обработчик, если есть
                const newVariableButton = addVariableButton.cloneNode(true) as HTMLButtonElement;
                addVariableButton.parentNode?.replaceChild(newVariableButton, addVariableButton);
                // Добавляем новый обработчик
                newVariableButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showAddVariableModal();
                });
            }
        },

        // Метод для отображения путей и нейминга версий
        displayVersionPaths(versionPaths: any[]) {
            const versionPathsList = this.$.versionPathsList as HTMLElement;

            if (!versionPathsList) {
                return;
            }

            // Очищаем список
            versionPathsList.innerHTML = '';

            if (!versionPaths || versionPaths.length === 0) {
                const noData = document.createElement('div');
                noData.className = 'version-path-no-data';
                noData.textContent = 'No paths data available';
                versionPathsList.appendChild(noData);
                return;
            }

            // Создаем контейнеры для каждой версии со спойлерами
            versionPaths.forEach((versionInfo) => {
                const versionSpoiler = document.createElement('details');
                versionSpoiler.className = 'version-path-spoiler';

                const versionSummary = document.createElement('summary');
                versionSummary.className = 'version-path-summary';
                versionSummary.innerHTML = `
                    <span class="version-path-name">Version: <strong>${versionInfo.versionName || 'base'}</strong></span>
                    <span class="version-path-count">${versionInfo.files ? versionInfo.files.length : 0} files</span>
                `;

                const versionContent = document.createElement('div');
                versionContent.className = 'version-path-content';

                const outputDirInfo = document.createElement('div');
                outputDirInfo.className = 'version-path-output-info';
                outputDirInfo.innerHTML = `
                    <span class="version-path-label">Output Directory:</span>
                    <span class="version-path-output-dir" title="${versionInfo.outputDir}">${versionInfo.outputDir}</span>
                `;
                versionContent.appendChild(outputDirInfo);

                if (versionInfo.files && versionInfo.files.length > 0) {
                    // Проверяем, есть ли у файлов variantName (режим множественных шаблонов)
                    const hasVariants = versionInfo.files.some((file: any) => file.variantName);

                    if (hasVariants) {
                        // Группируем файлы сначала по variantName, потом по языкам
                        const filesByVariant: { [key: string]: any[] } = {};
                        versionInfo.files.forEach((file: any) => {
                            const variant = file.variantName || 'default';
                            if (!filesByVariant[variant]) {
                                filesByVariant[variant] = [];
                            }
                            filesByVariant[variant].push(file);
                        });

                        Object.keys(filesByVariant).forEach((variantName) => {
                            const variantFiles = filesByVariant[variantName];
                            const variantSpoiler = document.createElement('details');
                            variantSpoiler.className = 'version-path-variant-spoiler';

                            const variantSummary = document.createElement('summary');
                            variantSummary.className = 'version-path-variant-summary';
                            variantSummary.innerHTML = `
                                <span class="version-path-variant-icon">📦</span>
                                <span class="version-path-variant-name">${variantName}</span>
                                <span class="version-path-variant-count">${variantFiles.length} files</span>
                            `;

                            const variantContent = document.createElement('div');
                            variantContent.className = 'version-path-variant-content';

                            // Внутри варианта группируем по языкам
                            const filesByLanguage: { [key: string]: any[] } = {};
                            variantFiles.forEach((file: any) => {
                                if (!filesByLanguage[file.language]) {
                                    filesByLanguage[file.language] = [];
                                }
                                filesByLanguage[file.language].push(file);
                            });

                            Object.keys(filesByLanguage).forEach((lang) => {
                                const langSpoiler = document.createElement('details');
                                langSpoiler.className = 'version-path-lang-spoiler';

                                const langSummary = document.createElement('summary');
                                langSummary.className = 'version-path-lang-summary';
                                langSummary.textContent = `Language: ${lang} (${filesByLanguage[lang].length} files)`;

                                const filesContainer = document.createElement('div');
                                filesContainer.className = 'version-path-files-list';

                                filesByLanguage[lang].forEach((file: any) => {
                                    const fileItem = document.createElement('div');
                                    fileItem.className = 'version-path-file-item';

                                    const fileInfo = document.createElement('div');
                                    fileInfo.className = 'version-path-file-info';
                                    fileInfo.innerHTML = `
                                        <span class="version-path-platform">${file.platform}</span>
                                        <span class="version-path-file-name" title="${file.fullPath}">${file.fileName}</span>
                                        <span class="version-path-file-type">${file.isZip ? 'ZIP' : 'HTML'}</span>
                                    `;

                                    const filePath = document.createElement('div');
                                    filePath.className = 'version-path-file-path';
                                    filePath.textContent = file.directory;
                                    filePath.title = file.fullPath;

                                    fileItem.appendChild(fileInfo);
                                    fileItem.appendChild(filePath);
                                    filesContainer.appendChild(fileItem);
                                });

                                langSpoiler.appendChild(langSummary);
                                langSpoiler.appendChild(filesContainer);
                                variantContent.appendChild(langSpoiler);
                            });

                            variantSpoiler.appendChild(variantSummary);
                            variantSpoiler.appendChild(variantContent);
                            versionContent.appendChild(variantSpoiler);
                        });
                    } else {
                        // Обычный режим — группируем файлы только по языкам
                        const filesByLanguage: { [key: string]: any[] } = {};
                        versionInfo.files.forEach((file: any) => {
                            if (!filesByLanguage[file.language]) {
                                filesByLanguage[file.language] = [];
                            }
                            filesByLanguage[file.language].push(file);
                        });

                        // Отображаем файлы по языкам в спойлерах
                        Object.keys(filesByLanguage).forEach((lang) => {
                            const langSpoiler = document.createElement('details');
                            langSpoiler.className = 'version-path-lang-spoiler';

                            const langSummary = document.createElement('summary');
                            langSummary.className = 'version-path-lang-summary';
                            langSummary.textContent = `Language: ${lang} (${filesByLanguage[lang].length} files)`;

                            const filesContainer = document.createElement('div');
                            filesContainer.className = 'version-path-files-list';

                            filesByLanguage[lang].forEach((file: any) => {
                                const fileItem = document.createElement('div');
                                fileItem.className = 'version-path-file-item';

                                const fileInfo = document.createElement('div');
                                fileInfo.className = 'version-path-file-info';
                                fileInfo.innerHTML = `
                                    <span class="version-path-platform">${file.platform}</span>
                                    <span class="version-path-file-name" title="${file.fullPath}">${file.fileName}</span>
                                    <span class="version-path-file-type">${file.isZip ? 'ZIP' : 'HTML'}</span>
                                `;

                                const filePath = document.createElement('div');
                                filePath.className = 'version-path-file-path';
                                filePath.textContent = file.directory;
                                filePath.title = file.fullPath;

                                fileItem.appendChild(fileInfo);
                                fileItem.appendChild(filePath);
                                filesContainer.appendChild(fileItem);
                            });

                            langSpoiler.appendChild(langSummary);
                            langSpoiler.appendChild(filesContainer);
                            versionContent.appendChild(langSpoiler);
                        });
                    }
                } else {
                    const noFiles = document.createElement('div');
                    noFiles.className = 'version-path-no-files';
                    noFiles.textContent = 'No files for this version';
                    versionContent.appendChild(noFiles);
                }

                versionSpoiler.appendChild(versionSummary);
                versionSpoiler.appendChild(versionContent);
                versionPathsList.appendChild(versionSpoiler);
            });
        },

        // Метод для создания контейнера версии
        createVersionContainer(versionObj: any, index: number): HTMLElement {
            const container = document.createElement('div');
            container.className = 'version-container';
            container.dataset.versionIndex = String(index);

            const header = document.createElement('div');
            header.className = 'version-container-header';

            // Чекбокс для выбора версии (для не прод режима)
            const versionName = versionObj.name || versionObj.version || `Version ${index + 1}`;
            const selectCheckbox = document.createElement('input');
            selectCheckbox.type = 'checkbox';
            selectCheckbox.className = 'version-select-checkbox';
            selectCheckbox.checked = selectedVersionName === versionName;
            selectCheckbox.title = 'Использовать эту версию в не прод режиме';
            selectCheckbox.addEventListener('change', () => {
                if (selectCheckbox.checked) {
                    selectedVersionName = versionName;
                } else {
                    selectedVersionName = null;
                }
                this.markVersionsAsChanged();
                this.displayVersionEditor();
            });

            const nameSpan = document.createElement('span');
            nameSpan.className = 'version-container-name';
            nameSpan.textContent = versionObj.name || versionObj.version || `Version ${index + 1}`;

            const copyButton = document.createElement('button');
            copyButton.className = 'version-container-copy';
            copyButton.textContent = 'Copy';
            copyButton.title = 'Создать копию версии';
            copyButton.addEventListener('click', () => {
                this.showCopyVersionModal(index);
            });

            const renameButton = document.createElement('button');
            renameButton.className = 'version-container-rename';
            renameButton.textContent = 'Rename';
            renameButton.title = 'Переименовать версию';
            renameButton.addEventListener('click', () => {
                this.showRenameVersionModal(index);
            });

            const removeButton = document.createElement('button');
            removeButton.className = 'version-container-remove';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                if (confirm(`Удалить версию "${nameSpan.textContent}"?`)) {
                    versions.splice(index, 1);
                    this.markVersionsAsChanged();
                    this.displayVersionEditor();
                }
            });

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'version-container-buttons';
            buttonsContainer.appendChild(copyButton);
            buttonsContainer.appendChild(renameButton);
            buttonsContainer.appendChild(removeButton);

            header.appendChild(selectCheckbox);
            header.appendChild(nameSpan);
            header.appendChild(buttonsContainer);

            const itemsContainer = document.createElement('div');
            itemsContainer.className = 'version-container-items';

            // Добавляем переменные из версии
            Object.keys(versionObj).forEach(key => {
                if (key !== 'name' && key !== 'version') {
                    const item = this.createVersionItem(key, versionObj[key], index);
                    itemsContainer.appendChild(item);
                }
            });

            if (itemsContainer.children.length === 0) {
                const emptyMsg = document.createElement('div');
                emptyMsg.className = 'version-container-empty';
                emptyMsg.textContent = 'Перетащите переменные сюда';
                itemsContainer.appendChild(emptyMsg);
            }

            // Обработчики drag and drop
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer!.dropEffect = 'move';
                container.classList.add('drag-over');
            });

            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                const variableName = e.dataTransfer!.getData('text/plain');
                if (variableName) {
                    // Для обязательных переменных используем значение из конфига
                    let value: any;
                    if (this.isRequiredVariable(variableName) && variableName in requiredVariables) {
                        value = requiredVariables[variableName];
                    } else {
                        // Получаем значение из хранилища, если есть, иначе из первой версии где используется
                        value = variablesStorage[variableName];
                        if (value === undefined) {
                            const exampleVersion = versions.find(v => variableName in v);
                            value = exampleVersion ? exampleVersion[variableName] : '';
                        }
                    }

                    // Если переменной нет в хранилище, но она используется в версиях, добавляем её в хранилище
                    if (!(variableName in variablesStorage) && value !== undefined) {
                        variablesStorage[variableName] = value;
                    }

                    // Добавляем переменную в версию
                    if (!(variableName in versionObj)) {
                        versionObj[variableName] = value;
                        this.markVersionsAsChanged();
                        this.displayVersionEditor();
                    }
                }
            });

            container.appendChild(header);
            container.appendChild(itemsContainer);

            return container;
        },

        // Метод для создания элемента переменной в контейнере версии
        createVersionItem(variableName: string, value: any, versionIndex: number): HTMLElement {
            const isRequired = this.isRequiredVariable(variableName);
            const item = document.createElement('div');
            item.className = isRequired ? 'version-container-item required-variable' : 'version-container-item';
            item.dataset.variableName = variableName;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = `${variableName}: `;
            if (isRequired) {
                nameSpan.title = 'Обязательная переменная (из конфига тайтла)';
            }

            // Создаем контейнер для значения и кнопки редактирования
            const valueContainer = document.createElement('div');
            valueContainer.className = 'version-item-value-container';

            // Создаем отображаемое значение (readonly)
            const valueDisplay = document.createElement('span');
            valueDisplay.className = 'version-item-value-display';
            valueDisplay.textContent = value !== undefined ? String(value) : '';
            valueDisplay.title = 'Значение переменной в версии';

            // Кнопка редактирования
            const editButton = document.createElement('button');
            editButton.className = 'version-item-edit';
            editButton.textContent = '✎';
            editButton.title = 'Редактировать значение переменной';
            editButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showEditVersionVariableModal(variableName, versionIndex);
            });

            // Кнопка удаления (скрываем для обязательных переменных)
            let removeButton: HTMLElement | null = null;
            if (!isRequired) {
                removeButton = document.createElement('span');
                removeButton.className = 'version-container-item-remove';
                removeButton.textContent = '×';
                removeButton.title = 'Удалить переменную из версии';
                removeButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (versions[versionIndex]) {
                        delete versions[versionIndex][variableName];
                        this.markVersionsAsChanged();
                        this.displayVersionEditor();
                    }
                });
            }

            valueContainer.appendChild(valueDisplay);
            valueContainer.appendChild(editButton);

            item.appendChild(nameSpan);
            item.appendChild(valueContainer);
            if (removeButton) {
                item.appendChild(removeButton);
            }

            return item;
        },

        // Метод для показа модального окна добавления версии
        showAddVersionModal() {
            copyVersionIndex = null;
            renameVersionIndex = null;
            const modal = this.$.addVersionModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const input = this.$.addVersionInput as HTMLInputElement;
            const confirmButton = this.$.addVersionConfirm as HTMLButtonElement;
            if (modal && input && modalTitle && confirmButton) {
                modalTitle.textContent = 'Add New Version';
                confirmButton.textContent = 'Add';
                modal.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        },

        // Метод для показа модального окна копирования версии
        showCopyVersionModal(index: number) {
            copyVersionIndex = index;
            renameVersionIndex = null;
            const modal = this.$.addVersionModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const input = this.$.addVersionInput as HTMLInputElement;
            const confirmButton = this.$.addVersionConfirm as HTMLButtonElement;
            if (modal && input && modalTitle && confirmButton) {
                const versionName = versions[index]?.name || versions[index]?.version || `Version ${index + 1}`;
                modalTitle.textContent = 'Copy Version';
                confirmButton.textContent = 'Copy';
                modal.classList.remove('hidden');
                input.value = `${versionName}_copy`;
                input.focus();
                input.select();
            }
        },

        // Метод для показа модального окна переименования версии
        showRenameVersionModal(index: number) {
            renameVersionIndex = index;
            copyVersionIndex = null;
            const modal = this.$.addVersionModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const input = this.$.addVersionInput as HTMLInputElement;
            const confirmButton = this.$.addVersionConfirm as HTMLButtonElement;
            if (modal && input && modalTitle && confirmButton) {
                const versionName = versions[index]?.name || versions[index]?.version || `Version ${index + 1}`;
                modalTitle.textContent = 'Rename Version';
                confirmButton.textContent = 'Rename';
                modal.classList.remove('hidden');
                input.value = versionName;
                input.focus();
                input.select();
            }
        },

        // Метод для скрытия модального окна добавления версии
        hideAddVersionModal() {
            const modal = this.$.addVersionModal as HTMLElement;
            if (modal) {
                modal.classList.add('hidden');
                copyVersionIndex = null;
                renameVersionIndex = null;
            }
        },

        // Метод для добавления новой версии
        addNewVersion() {
            try {
                const input = this.$.addVersionInput as HTMLInputElement;
                if (!input) {
                    if (renameVersionIndex !== null) {
                        this.showRenameVersionModal(renameVersionIndex);
                    } else if (copyVersionIndex !== null) {
                        this.showCopyVersionModal(copyVersionIndex);
                    } else {
                        this.showAddVersionModal();
                    }
                    return;
                }

                const versionName = input.value.trim();
                if (versionName) {
                    if (renameVersionIndex !== null && renameVersionIndex >= 0 && renameVersionIndex < versions.length) {
                        // Переименовываем версию
                        const version = versions[renameVersionIndex];
                        const oldName = version.name || version.version || `Version ${renameVersionIndex + 1}`;

                        // Проверяем, не существует ли уже версия с таким именем (кроме текущей)
                        const existingVersion = versions.find((v, idx) =>
                            idx !== renameVersionIndex && (v.name === versionName || v.version === versionName)
                        );
                        if (existingVersion) {
                            this.appendLog(`Version with name "${versionName}" already exists`, 'error');
                            input.focus();
                            input.select();
                            return;
                        }

                        // Обновляем имя версии
                        version.name = versionName;
                        if (version.version) {
                            delete version.version;
                        }

                        // Обновляем selectedVersionName, если переименовывается выбранная версия
                        if (selectedVersionName === oldName) {
                            selectedVersionName = versionName;
                        }

                        this.appendLog(`Version "${oldName}" renamed to "${versionName}" successfully`, 'success');
                        renameVersionIndex = null;
                    } else if (copyVersionIndex !== null && copyVersionIndex >= 0 && copyVersionIndex < versions.length) {
                        // Копируем версию
                        const originalVersion = versions[copyVersionIndex];
                        const newVersion: any = { ...originalVersion };
                        newVersion.name = versionName;
                        versions.push(newVersion);
                        this.appendLog(`Version "${versionName}" copied successfully from "${originalVersion.name || originalVersion.version}"`, 'success');
                        copyVersionIndex = null;
                    } else {
                        // Создаем новую версию
                        const newVersion: any = {
                            name: versionName,
                            prod: true
                        };
                        // Добавляем обязательные переменные из конфига
                        if (requiredVariables && Object.keys(requiredVariables).length > 0) {
                            Object.keys(requiredVariables).forEach(varName => {
                                newVersion[varName] = requiredVariables[varName];
                            });
                        }
                        versions.push(newVersion);
                        this.appendLog(`Version "${versionName}" added successfully`, 'success');
                    }
                    // Применяем обязательные переменные ко всем версиям (на случай, если они изменились)
                    this.applyRequiredVariables();
                    this.markVersionsAsChanged();
                    this.hideAddVersionModal();
                    this.displayVersionEditor();
                } else {
                    this.appendLog('Version name cannot be empty', 'error');
                    input.focus();
                }
            } catch (error) {
                this.appendLog(`Error adding/copying/renaming version: ${error}`, 'error');
            }
        },

        // Метод для показа модального окна добавления переменной
        showAddVariableModal() {
            const modal = this.$.addVariableModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const nameInput = this.$.addVariableNameInput as HTMLInputElement;
            const valueInput = this.$.addVariableValueInput as HTMLInputElement;
            const confirmButton = this.$.addVariableConfirm as HTMLButtonElement;
            if (modal && nameInput && valueInput && modalTitle && confirmButton) {
                modalTitle.textContent = 'Add New Variable';
                confirmButton.textContent = 'Add';
                nameInput.value = '';
                valueInput.value = '';
                nameInput.disabled = false;
                nameInput.focus();

                // Очищаем флаги редактирования
                delete modal.dataset.editingVariable;
                delete modal.dataset.editingVersionIndex;

                modal.classList.remove('hidden');
            }
        },

        // Метод для скрытия модального окна добавления переменной
        hideAddVariableModal() {
            const modal = this.$.addVariableModal as HTMLElement;
            const nameInput = this.$.addVariableNameInput as HTMLInputElement;
            if (modal) {
                // Очищаем флаг редактирования и разблокируем input
                delete modal.dataset.editingVariable;
                if (nameInput) {
                    nameInput.disabled = false;
                }
                modal.classList.add('hidden');
            }
        },

        // Метод для показа модального окна редактирования переменной
        showEditVariableModal(variableName: string) {
            const modal = this.$.addVariableModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const nameInput = this.$.addVariableNameInput as HTMLInputElement;
            const valueInput = this.$.addVariableValueInput as HTMLInputElement;
            const confirmButton = this.$.addVariableConfirm as HTMLButtonElement;

            if (modal && nameInput && valueInput && modalTitle && confirmButton) {
                // Получаем текущее значение переменной
                let currentValue = variablesStorage[variableName];
                if (currentValue === undefined) {
                    const exampleVersion = versions.find(v => variableName in v);
                    currentValue = exampleVersion ? exampleVersion[variableName] : '';
                }

                modalTitle.textContent = 'Edit Variable';
                confirmButton.textContent = 'Save';
                nameInput.value = variableName;
                nameInput.disabled = true; // Имя переменной нельзя редактировать
                valueInput.value = currentValue !== undefined ? String(currentValue) : '';
                valueInput.focus();
                valueInput.select();

                // Сохраняем имя редактируемой переменной в data-атрибуте
                modal.dataset.editingVariable = variableName;
                delete modal.dataset.editingVersionIndex; // Очищаем флаг редактирования версии

                modal.classList.remove('hidden');
            }
        },

        // Метод для показа модального окна редактирования переменной в версии
        showEditVersionVariableModal(variableName: string, versionIndex: number) {
            const modal = this.$.addVariableModal as HTMLElement;
            const modalTitle = modal.querySelector('.warning-header h3') as HTMLElement;
            const nameInput = this.$.addVariableNameInput as HTMLInputElement;
            const valueInput = this.$.addVariableValueInput as HTMLInputElement;
            const confirmButton = this.$.addVariableConfirm as HTMLButtonElement;

            if (modal && nameInput && valueInput && modalTitle && confirmButton && versions[versionIndex]) {
                // Получаем текущее значение переменной в версии
                const currentValue = versions[versionIndex][variableName];
                const versionName = versions[versionIndex].name || versions[versionIndex].version || `Version ${versionIndex + 1}`;

                modalTitle.textContent = `Edit Variable in "${versionName}"`;
                confirmButton.textContent = 'Save';
                nameInput.value = variableName;
                nameInput.disabled = true; // Имя переменной нельзя редактировать
                valueInput.value = currentValue !== undefined ? String(currentValue) : '';
                valueInput.focus();
                valueInput.select();

                // Сохраняем имя редактируемой переменной и индекс версии в data-атрибутах
                modal.dataset.editingVariable = variableName;
                modal.dataset.editingVersionIndex = String(versionIndex);

                modal.classList.remove('hidden');
            }
        },

        // Метод для добавления новой переменной
        addNewVariable() {
            try {
                const modal = this.$.addVariableModal as HTMLElement;
                const nameInput = this.$.addVariableNameInput as HTMLInputElement;
                const valueInput = this.$.addVariableValueInput as HTMLInputElement;
                if (!nameInput || !valueInput) {
                    this.showAddVariableModal();
                    return;
                }

                // Проверяем, редактируем ли мы существующую переменную
                const editingVariable = modal.dataset.editingVariable;
                const editingVersionIndex = modal.dataset.editingVersionIndex;

                if (editingVariable) {
                    const variableName = editingVariable;
                    const valueStr = valueInput.value.trim();
                    let typedValue: any = valueStr;

                    // Пытаемся определить тип значения
                    if (valueStr === 'true' || valueStr === 'false') {
                        typedValue = valueStr === 'true';
                    } else if (!isNaN(Number(valueStr)) && valueStr !== '') {
                        typedValue = Number(valueStr);
                    } else if (valueStr === '') {
                        typedValue = '';
                    }

                    if (editingVersionIndex !== undefined) {
                        // Режим редактирования переменной в конкретной версии
                        const versionIndex = parseInt(editingVersionIndex, 10);
                        if (versions[versionIndex]) {
                            versions[versionIndex][variableName] = typedValue;
                            const versionName = versions[versionIndex].name || versions[versionIndex].version || `Version ${versionIndex + 1}`;
                            this.appendLog(`Variable "${variableName}" in version "${versionName}" updated successfully`, 'success');
                        }
                    } else {
                        // Режим редактирования дефолтного значения переменной
                        // Обновляем значение в хранилище
                        variablesStorage[variableName] = typedValue;

                        // Обновляем значение во всех версиях, где используется эта переменная
                        versions.forEach(versionObj => {
                            if (variableName in versionObj) {
                                versionObj[variableName] = typedValue;
                            }
                        });

                        this.appendLog(`Variable "${variableName}" updated successfully`, 'success');
                    }

                    this.markVersionsAsChanged();
                    this.hideAddVariableModal();
                    this.displayVersionEditor();

                    // Очищаем флаги редактирования
                    delete modal.dataset.editingVariable;
                    delete modal.dataset.editingVersionIndex;
                    nameInput.disabled = false;
                } else {
                    // Режим добавления новой переменной
                    const variableName = nameInput.value.trim();
                    if (!variableName) {
                        this.appendLog('Variable name cannot be empty', 'error');
                        nameInput.focus();
                        return;
                    }

                    // Проверяем, не существует ли уже такая переменная (в хранилище или в версиях)
                    const allVariables = this.getAllVariables();
                    if (allVariables.has(variableName)) {
                        this.appendLog(`Variable "${variableName}" already exists`, 'error');
                        nameInput.focus();
                        nameInput.select();
                        return;
                    }

                    // Получаем значение переменной
                    const valueStr = valueInput.value.trim();
                    let defaultValue: any = valueStr;

                    // Пытаемся определить тип значения
                    if (valueStr === 'true' || valueStr === 'false') {
                        defaultValue = valueStr === 'true';
                    } else if (!isNaN(Number(valueStr)) && valueStr !== '') {
                        defaultValue = Number(valueStr);
                    } else if (valueStr === '') {
                        defaultValue = '';
                    }

                    // Добавляем переменную в хранилище
                    variablesStorage[variableName] = defaultValue;

                    this.appendLog(`Variable "${variableName}" added successfully to variables storage`, 'success');
                    this.markVersionsAsChanged();
                    this.hideAddVariableModal();
                    this.displayVersionEditor();
                }
            } catch (error) {
                this.appendLog(`Error adding/editing variable: ${error}`, 'error');
            }
        },

        // Метод для сохранения версий в файл
        saveVersions() {
            // Предотвращаем множественные одновременные сохранения
            if (isSaving) {
                return;
            }

            try {
                isSaving = true;

                // Перед сохранением гарантируем наличие обязательных переменных во всех версиях
                this.applyRequiredVariables();

                const projectPath = join(__dirname, '../../../../../');
                const versionFilePath = join(projectPath, 'versions.cjs');

                if (!existsSync(versionFilePath)) {
                    this.appendLog(`versions.cjs file not found: ${versionFilePath}`, 'error');
                    isSaving = false;
                    return;
                }

                // Читаем оригинальный файл для сохранения language и комментариев
                const originalContent = readFileSync(versionFilePath, 'utf-8');
                const languageMatch = originalContent.match(/versions\.language\s*=\s*['"]([^'"]+)['"]/);
                const language = languageMatch ? languageMatch[1] : 'en';

                // Извлекаем комментарии после module.exports
                const commentsMatch = originalContent.match(/module\.exports\s*=\s*versions;\s*([\s\S]*)$/);
                const comments = commentsMatch ? commentsMatch[1] : '';

                // Формируем содержимое файла
                let fileContent = 'let versions = [\n';

                versions.forEach((version, index) => {
                    fileContent += '    {\n';
                    // Сортируем ключи, чтобы name был первым
                    const keys = Object.keys(version).sort((a, b) => {
                        if (a === 'name' || a === 'version') return -1;
                        if (b === 'name' || b === 'version') return 1;
                        return a.localeCompare(b);
                    });
                    keys.forEach((key, keyIndex) => {
                        const value = version[key];
                        let valueStr = '';

                        if (typeof value === 'string') {
                            // Экранируем кавычки в строках
                            const escapedValue = value.replace(/"/g, '\\"');
                            valueStr = `"${escapedValue}"`;
                        } else if (typeof value === 'boolean') {
                            valueStr = String(value);
                        } else if (typeof value === 'number') {
                            valueStr = String(value);
                        } else if (value === null || value === undefined) {
                            valueStr = 'null';
                        } else {
                            valueStr = JSON.stringify(value);
                        }

                        fileContent += `        ${key}: ${valueStr}`;
                        if (keyIndex < keys.length - 1) {
                            fileContent += ',';
                        }
                        fileContent += '\n';
                    });
                    fileContent += '    }';
                    if (index < versions.length - 1) {
                        fileContent += ',';
                    }
                    fileContent += '\n';
                });

                fileContent += '];\n';
                fileContent += `versions.language = '${language}';\n`;

                // Сохраняем выбранную версию
                if (selectedVersionName) {
                    fileContent += `versions.selectedVersion = '${selectedVersionName.replace(/'/g, "\\'")}';\n`;
                }
                fileContent += '\n';

                // Убеждаемся, что все переменные из версий есть в хранилище
                versions.forEach(version => {
                    Object.keys(version).forEach(key => {
                        if (key !== 'name' && key !== 'version' && !(key in variablesStorage)) {
                            // Добавляем переменную в хранилище с дефолтным значением из версии
                            variablesStorage[key] = version[key];
                        }
                    });
                });

                // Сохраняем хранилище переменных
                const variablesKeys = Object.keys(variablesStorage);
                if (variablesKeys.length > 0) {
                    fileContent += '// Variables storage with default values\n';
                    fileContent += 'versions.variables = {\n';
                    variablesKeys.forEach((key, index) => {
                        const value = variablesStorage[key];
                        let valueStr = '';

                        if (typeof value === 'string') {
                            const escapedValue = value.replace(/"/g, '\\"');
                            valueStr = `"${escapedValue}"`;
                        } else if (typeof value === 'boolean') {
                            valueStr = String(value);
                        } else if (typeof value === 'number') {
                            valueStr = String(value);
                        } else if (value === null || value === undefined) {
                            valueStr = 'null';
                        } else {
                            valueStr = JSON.stringify(value);
                        }

                        fileContent += `    ${key}: ${valueStr}`;
                        if (index < variablesKeys.length - 1) {
                            fileContent += ',';
                        }
                        fileContent += '\n';
                    });
                    fileContent += '};\n\n';
                }

                fileContent += 'module.exports = versions;\n';
                if (comments.trim()) {
                    fileContent += comments;
                }

                // Записываем файл
                writeFileSync(versionFilePath, fileContent, 'utf-8');

                // Проверяем, было ли это автоматическое сохранение
                const autosaveCheckbox = this.$.autosaveCheckbox as HTMLInputElement;
                const isAutosave = autosaveCheckbox && autosaveCheckbox.checked;

                if (!isAutosave) {
                    // Показываем сообщение только при ручном сохранении
                    this.appendLog('Versions saved successfully', 'success');
                }

                // Сохраняем текущие версии и хранилище как оригинальные и сбрасываем флаг изменений
                originalVersions = JSON.parse(JSON.stringify(versions));
                originalVariablesStorage = JSON.parse(JSON.stringify(variablesStorage));
                originalSelectedVersionName = selectedVersionName;
                hasUnsavedChanges = false;

                // Обновляем отображение
                this.displayVersionEditor();
            } catch (error) {
                this.appendLog(`Error saving versions: ${error}`, 'error');
            } finally {
                isSaving = false;
            }
        },

        finalizeBuild() {
            // Дополнительная проверка, что все процессы завершены
            if (runningProcesses.length > 0) {
                this.appendLog(`Warning: ${runningProcesses.length} processes are still active, waiting for completion...`, 'warn');
                this.waitForAllProcessesToComplete();
                return;
            }

            this.toggleBuildButton(false);
            // this.updateStatus('Готово');

            // Сначала сбрасываем все состояния прогресса и анимации
            this.hideBuildProgress();

            // Затем с задержкой разблокируем галочки
            setTimeout(() => {
                // Принудительно включаем все галочки обратно
                this.forceEnableAllCheckboxes();

                // Даем дополнительное время на обработку всех логов перед показом итогов
                setTimeout(() => {
                    // Показываем итоги
                    this.showLastBuildInfo();

                    // Автоматически обновляем данные после завершения сборки
                    this.appendLog('Automatic data update after build...', 'warn');
                    this.refreshDataAfterBuild();
                }, 2000); // Даем 2 секунды на обработку всех логов
            }, 500); // Уменьшаем задержку, но даем время на сброс анимации
        },

        /**
         * Проверяет наличие несохраненных изменений в текущей сцене
         * Используем API: Editor.Message.request('scene', 'query-dirty')
         * Документация: @cocos/creator-types/editor/packages/scene/@types/message.d.ts
         * Возвращает boolean
         */
        async checkSceneDirty(): Promise<boolean> {
            try {
                if (typeof Editor === 'undefined' || !Editor.Message) {
                    return false;
                }
                
                const isDirty: boolean = await Editor.Message.request('scene', 'query-dirty');
                return isDirty;
            } catch (error) {
                console.warn('Failed to check scene dirty state:', error);
                return false;
            }
        },

        /**
         * Сохраняет текущую сцену
         * Используем API: Editor.Message.request('scene', 'save-scene')
         * Документация: @cocos/creator-types/editor/packages/scene/@types/message.d.ts
         */
        async saveScene(): Promise<boolean> {
            try {
                if (typeof Editor === 'undefined' || !Editor.Message) {
                    this.appendLog('API редактора недоступен', 'warn');
                    return false;
                }
                
                // Сообщение 'save-scene' принимает опциональный boolean параметр
                // и возвращает string | undefined (путь к сохраненной сцене)
                const result = await Editor.Message.request('scene', 'save-scene');
                this.appendLog('Сцена сохранена', 'success');
                return true;
            } catch (error) {
                console.error('Failed to save scene:', error);
                this.appendLog('Ошибка при сохранении сцены: ' + error, 'error');
                return false;
            }
        },

        triggerBuild() {
            if (isBuilding) {
                this.cancelBuild();
                return;
            }

            // Проверяем наличие несохраненных изменений в сцене
            this.checkSceneDirty().then((hasUnsavedSceneChanges: boolean) => {
                if (hasUnsavedSceneChanges) {
                    // Показываем модальное окно с предложением сохранить сцену
                    modalManager.showUnsavedSceneChangesModal();
                    return;
                }

                // Если нет несохраненных изменений, продолжаем обычную проверку
                this.proceedWithBuildCheck();
            });
        },

        /**
         * Продолжает проверку перед запуском билда (после проверки сцены)
         */
        proceedWithBuildCheck() {
            const mainBuildEnabled = (this.$.mainBuildCheckbox as HTMLInputElement).checked;
            const superHtmlEnabled = (this.$.superhtmlCheckbox as HTMLInputElement).checked;
            const loadToSftp = (this.$.sftpCheckbox as HTMLInputElement).checked;
            const clearSftpEnabled = (this.$.clearSftpCheckbox as HTMLInputElement).checked;
            const projectPath = join(__dirname, '../../../../../');

            // Проверяем, нужно ли принудительно активировать основной билд
            this.checkAndForceMainBuild(projectPath).then((forcedMainBuild: boolean) => {
                const finalMainBuildEnabled = forcedMainBuild || mainBuildEnabled;

                // Если основной билд не включен и не принудительно активирован, показываем предупреждение
                if (!finalMainBuildEnabled && !forcedMainBuild) {
                    modalManager.showWarningModal();
                    return;
                }

                // Если все в порядке, запускаем сборку
                this.proceedWithBuild();
            });
        },

        // Показать предупреждение SFTP с информацией о clean-info
        async showSftpWarningWithInfo(projectPath: string) {
            // Показываем модальное окно с индикатором загрузки
            modalManager.showSftpWarningWithInfo();

            try {
                // Очищаем предыдущие данные
                progressManager.clearSftpCleanInfo();

                const cleanInfo = await this.getSftpCleanInfo(projectPath);

                // Если у нас есть структурированные данные, используем их
                const sftpCleanInfo = progressManager.getSftpCleanInfo();


                if (sftpCleanInfo.items.length > 0) {
                    progressManager.updateSftpCleanInfo();
                } else {
                    // Fallback к старому форматированию
                    const formattedInfo = cleanInfo
                        .split('\n')
                        .filter((line: string) => line.trim())
                        .map((line: string) => `<div>${line}</div>`)
                        .join('');

                    modalManager.updateSftpCleanInfo(formattedInfo || '<p>Folder information not found</p>');
                }
            } catch (error) {
                modalManager.updateSftpCleanInfo(`<p>Error getting information: ${error}</p>`);
            }
        },

        // Метод для продолжения сборки (вызывается после предупреждения или если предупреждение не нужно)
        proceedWithBuild() {
            // Инициализация сборки
            buildStartTime = new Date();
            currentBuildTasks = [];
            remoteUrls = {}; // Очищаем URL предыдущей сборки
            // Очищаем время этапов предыдущей сборки
            progressManager.clearAllProgressTimeIntervals();

            // Сбрасываем прогресс мейн билда (но НЕ очищаем данные о файлах)
            progressManager.resetProgressOnly();

            // Очищаем все интервалы времени
            progressManager.clearAllProgressTimeIntervals();

            this.toggleBuildButton(true);
            // this.updateStatus('Сборка запущена...');
            this.showBuildProgress();

            const mainBuildEnabled = (this.$.mainBuildCheckbox as HTMLInputElement).checked;
            const superHtmlEnabled = (this.$.superhtmlCheckbox as HTMLInputElement).checked;
            const loadToSftp = (this.$.sftpCheckbox as HTMLInputElement).checked;
            const projectPath = join(__dirname, '../../../../../');

            // Проверяем, нужно ли принудительно активировать основной билд
            this.checkAndForceMainBuild(projectPath).then((forcedMainBuild: boolean) => {
                // Отключаем галочки во время сборки ПОСЛЕ проверки принудительной активации
                this.setCheckboxesEnabled(false);
                const finalMainBuildEnabled = forcedMainBuild || mainBuildEnabled;

                // Отмечаем пропущенные этапы через ProgressManager
                if (!finalMainBuildEnabled) {
                    progressManager.resetSectionState('mainBuild');
                }
                if (!loadToSftp) {
                    progressManager.resetSectionState('sftp');
                }
                if (!superHtmlEnabled) {
                    progressManager.resetSectionState('superHtml');
                }

                // Запускаем сборку с обновленными параметрами
                this.runBuildProcess(finalMainBuildEnabled, superHtmlEnabled, loadToSftp, projectPath);
            });
        },

        runBuildProcess(mainBuildEnabled: boolean, superHtmlEnabled: boolean, loadToSftp: boolean, projectPath: string) {
            // Основной билд
            const runMainBuild = () => new Promise<void>((resolve) => {
                if (!isBuilding || !mainBuildEnabled) { resolve(); return; }

                // Показываем прогресс-бар для основного билда
                progressManager.showSectionProgress('mainBuild');

                // Прогресс основного билда управляется через ProgressManager
                this.appendLog('Starting main build...');

                // Начинаем отслеживание времени
                progressManager.startStageTiming('mainBuild');

                // Запускаем мониторинг застрявшего прогресса
                progressManager.startStuckProgressMonitoring();

                const cocosExePath = Object.keys(Editor.App.args)[0];
                // Кроссплатформенное определение рабочей директории
                const cwd = require('path').dirname(cocosExePath);
                const configPath = join(projectPath, 'build-templates', 'crada_playable_2D.json');

                const mainBuild = spawn(cocosExePath, [`--project`, projectPath, `--build`, `configPath=${configPath}`], { cwd, shell: false });
                runningProcesses.push(mainBuild);

                mainBuild.stdout.on('data', (data: Buffer) => this.appendLog(data.toString()));
                mainBuild.stderr.on('data', (data: Buffer) => this.appendLog(data.toString(), 'error'));

                mainBuild.on('close', (code) => {
                    runningProcesses = runningProcesses.filter(p => p !== mainBuild);

                    if (!isBuilding) {
                        this.appendLog('Main build was cancelled', 'warn');
                        resolve();
                        return;
                    }

                    if (code === 36) {
                        // Принудительно завершаем прогресс основного билда
                        progressManager.forceCompleteMainBuild();
                        currentBuildTasks.push('Main Build');
                        this.appendLog(`Main build completed successfully`, 'success');

                        // Обновляем данные после успешного основного билда
                        this.appendLog('Updating data after main build...', 'warn');
                        this.refreshDataAfterBuild();
                    } else {
                        this.appendLog(`Main build completed with error (code ${code})`, 'error');
                    }

                    // Завершаем отслеживание времени
                    progressManager.endStageTiming('mainBuild');

                    // Останавливаем мониторинг застрявшего прогресса
                    progressManager.stopStuckProgressMonitoring();

                    resolve();
                });
            });

            runMainBuild()
                .then(() => {
                    if (!isBuilding) return;
                    if (superHtmlEnabled) {
                        return this.runSuperHtmlBuild(projectPath)
                    } else {
                        return Promise.resolve();
                    }
                })
                .then(() => {
                    if (!isBuilding) return;
                    if (loadToSftp) {
                        return this.runSFTPLoad(projectPath)
                    } else {
                        return Promise.resolve();
                    }
                })
                .then(() => {
                    if (isBuilding) {
                        // Проверяем, что все процессы завершены
                        if (runningProcesses.length === 0) {
                            this.finalizeBuild();
                        } else {
                            // Если есть активные процессы, ждем их завершения
                            this.waitForAllProcessesToComplete();
                        }
                    }
                })
                .catch((err) => {
                    this.appendLog(`Build error: ${err}`, 'error');
                    // Сначала сбрасываем все состояния прогресса и анимации
                    this.hideBuildProgress();

                    // Затем с задержкой разблокируем галочки при ошибке
                    setTimeout(() => {
                        // Принудительно включаем все галочки обратно при ошибке
                        this.forceEnableAllCheckboxes();
                    }, 500);
                });
        },

        /**
         * Ожидание завершения всех активных процессов
         */
        waitForAllProcessesToComplete() {
            if (runningProcesses.length === 0) {
                this.finalizeBuild();
                return;
            }

            // Проверяем каждые 100мс, есть ли еще активные процессы
            const checkInterval = setInterval(() => {
                if (runningProcesses.length === 0) {
                    clearInterval(checkInterval);
                    this.finalizeBuild();
                } else if (!isBuilding) {
                    // Если билд отменен, прерываем ожидание
                    clearInterval(checkInterval);
                }
            }, 100);
        },

        /**
         * Обновляет состояние кнопки валидатора в зависимости от результатов валидации
         */
        updateValidatorButtonState() {
            const toggleValidatorButton = this.$.toggleValidatorButton as HTMLButtonElement;
            if (!toggleValidatorButton) return;

            if (validationState.hasErrors) {
                toggleValidatorButton.classList.add('has-errors');
                toggleValidatorButton.classList.remove('no-errors');
                // Меняем иконку на восклицательный знак при ошибках
                toggleValidatorButton.textContent = '!';
            } else {
                toggleValidatorButton.classList.add('no-errors');
                toggleValidatorButton.classList.remove('has-errors');
                // Меняем иконку на галочку при успешной валидации
                toggleValidatorButton.textContent = '✓';
            }
        },

        /**
         * Запуск валидации параметров
         */
        async runValidation() {
            try {

                // Показываем индикатор загрузки
                const validatorContent = this.$.validatorContent as HTMLElement;
                if (validatorContent) {
                    validatorContent.innerHTML = `
                        <div class="validator-loading">
                            <div class="loading-spinner"></div>
                            <p>Scanning TypeScript files...</p>
                        </div>
                    `;
                }

                // Start validation
                const summary = await validator.validate();

                // Сохраняем состояние валидации
                validationState.lastValidation = summary;
                validationState.hasErrors = !summary.isValidationSuccessful;

                // Обновляем состояние кнопки валидатора
                this.updateValidatorButtonState();

                // Генерируем HTML отчет
                const htmlReport = validator.generateHtmlReport(summary);

                // Отображаем результат
                if (validatorContent) {
                    validatorContent.innerHTML = htmlReport;
                }


            } catch (error) {

                const validatorContent = this.$.validatorContent as HTMLElement;
                if (validatorContent) {
                    validatorContent.innerHTML = `
                        <div class="validator-error">
                            <h3>❌ Validation Error</h3>
                            <p>Failed to validate parameters:</p>
                            <div class="error-details">${error}</div>
                        </div>
                    `;
                }
            }
        }
    },

    ready() {
        // Устанавливаем версию билдера
        if (this.$.builderVersion) {
            this.$.builderVersion.textContent = packageJSON.version || 'unknown';
        }

        // Инициализируем LogManager
        logManager = new LogManager(
            this.$.logContent as HTMLElement,
            this.$.logSummaryText as HTMLElement
        );

        // Инициализируем ProgressManager
        progressManager = new ProgressManager({
            // Checkbox sections for progress display
            mainBuildSection: this.$.mainBuildSection as HTMLElement,
            superhtmlSection: this.$.superhtmlSection as HTMLElement,
            sftpSection: this.$.sftpSection as HTMLElement,
            // Progress indicators inside sections
            mainBuildProgress: this.$.mainBuildProgress as HTMLElement,
            superhtmlProgress: this.$.superhtmlProgress as HTMLElement,
            sftpProgress: this.$.sftpProgress as HTMLElement,
            // Time elements
            mainBuildTime: this.$.mainBuildTime as HTMLElement,
            superhtmlTime: this.$.superhtmlTime as HTMLElement,
            sftpTime: this.$.sftpTime as HTMLElement,
            // Progress statuses
            mainBuildStatus: this.$.mainBuildStatus as HTMLElement,
            superhtmlStatus: this.$.superhtmlStatus as HTMLElement,
            sftpStatus: this.$.sftpStatus as HTMLElement,
            sftpCleanInfo: this.$.sftpCleanInfo as HTMLElement
        });

        // Устанавливаем дополнительные элементы прогресс-баров
        (progressManager as any).uiElements.mainBuildProgressFill = this.$.mainBuildProgressFill as HTMLElement;
        (progressManager as any).uiElements.superhtmlProgressFill = this.$.superhtmlProgressFill as HTMLElement;
        (progressManager as any).uiElements.sftpProgressFill = this.$.sftpProgressFill as HTMLElement;
        (progressManager as any).uiElements.mainBuildPercentage = this.$.mainBuildPercentage as HTMLElement;
        (progressManager as any).uiElements.superhtmlPercentage = this.$.superhtmlPercentage as HTMLElement;
        (progressManager as any).uiElements.sftpPercentage = this.$.sftpPercentage as HTMLElement;

        if (this.$.buildButton) {
            this.$.buildButton.addEventListener('click', () => this.triggerBuild());
        }
        if (this.$.clearLogsButton) {
            this.$.clearLogsButton.addEventListener('click', () => this.clearLogs());
        }


        // Добавляем обработчик для галочки SuperHTML билда
        if (this.$.superhtmlCheckbox) {
            this.$.superhtmlCheckbox.addEventListener('change', () => {
                this.toggleClearDistVisibility();
                // Обновляем доступность SFTP при изменении SuperHTML галочки
                const projectPath = join(__dirname, '../../../../../');
                const sftpFolderExists = this.checkSftpFolderExists(projectPath);
                this.setSftpCheckboxEnabled(sftpFolderExists);
            });
        }

        // Добавляем обработчик для галочки SFTP
        if (this.$.sftpCheckbox) {
            this.$.sftpCheckbox.addEventListener('change', () => this.toggleClearSftpVisibility());
        }

        // Инициализируем ModalManager
        modalManager = new ModalManager(
            {
                warningModal: this.$.warningModal as HTMLElement,
                warningCancel: this.$.warningCancel as HTMLButtonElement,
                warningContinue: this.$.warningContinue as HTMLButtonElement,
                sftpWarningModal: this.$.sftpWarningModal as HTMLElement,
                sftpWarningCancel: this.$.sftpWarningCancel as HTMLButtonElement,
                sftpWarningContinue: this.$.sftpWarningContinue as HTMLButtonElement,
                sftpCleanInfo: this.$.sftpCleanInfo as HTMLElement,
                unsavedChangesModal: this.$.unsavedChangesModal as HTMLElement,
                unsavedChangesCancel: this.$.unsavedChangesCancel as HTMLButtonElement,
                unsavedChangesDiscard: this.$.unsavedChangesDiscard as HTMLButtonElement,
                updateCompletedModal: this.$.updateCompletedModal as HTMLElement,
                updateCompletedOk: this.$.updateCompletedOk as HTMLButtonElement,
                infoSection: this.$.infoSection as HTMLElement,
                toggleInfoButton: this.$.toggleInfoButton as HTMLButtonElement,
                closeInfoButton: this.$.closeInfoButton as HTMLButtonElement,
                pathsSection: this.$.pathsSection as HTMLElement,
                togglePathsButton: this.$.togglePathsButton as HTMLButtonElement,
                closePathsButton: this.$.closePathsButton as HTMLButtonElement,
                validatorSection: this.$.validatorSection as HTMLElement,
                toggleValidatorButton: this.$.toggleValidatorButton as HTMLButtonElement,
                closeValidatorButton: this.$.closeValidatorButton as HTMLButtonElement,
                        unsavedSceneChangesModal: this.$.unsavedSceneChangesModal as HTMLElement,
                        unsavedSceneCancel: this.$.unsavedSceneCancel as HTMLButtonElement,
                        unsavedSceneSave: this.$.unsavedSceneSave as HTMLButtonElement,
                        unsavedSceneContinue: this.$.unsavedSceneContinue as HTMLButtonElement
                    },
                    {
                        onWarningContinue: () => this.continueBuild(),
                        onSftpWarningContinue: () => this.continueSftpBuild(),
                        onUnsavedChangesDiscard: () => {
                            // Просто скрываем модальное окно, закрытие info-section произойдет автоматически
                        },
                        onUnsavedSceneCancel: () => {
                            // Отменяем запуск билда
                        },
                onUnsavedSceneSave: async () => {
                    // Сохраняем сцену и продолжаем билд
                    const saved = await this.saveScene();
                    if (saved) {
                        this.proceedWithBuildCheck();
                    }
                },
                onUnsavedSceneContinue: () => {
                    // Продолжаем билд без сохранения
                    this.appendLog('Билд продолжается без сохранения сцены. Убедитесь, что сцена сохранена вручную.', 'warn');
                    this.proceedWithBuildCheck();
                },
                onCheckUnsavedChanges: () => {
                    // Проверяем наличие несохраненных изменений
                    const autosaveCheckbox = this.$.autosaveCheckbox as HTMLInputElement;
                    const isAutosaveEnabled = autosaveCheckbox && autosaveCheckbox.checked;

                    // Если автосейв включен, не показываем модальное окно
                    if (isAutosaveEnabled) {
                        return false;
                    }

                    // Проверяем наличие несохраненных изменений
                    return hasUnsavedChanges && this.hasVersionsChanged();
                },
                onValidatorOpen: () => this.runValidation(),
                onPathsOpen: () => this.refreshData(),
                onInfoOpen: () => {
                    // Загружаем свежую информацию по требованию переменных из тайтл конфига при открытии редактора версий
                    const projectPath = join(__dirname, '../../../../../');
                    this.getSuffixAndHash(projectPath, () => {
                        // После загрузки titleConfig обновляем редактор версий
                        this.displayVersionEditor();
                    });
                }
            }
        );

        // Инициализируем валидатор
        const projectRoot = join(__dirname, '../../../../../');
        validator = new Validator(projectRoot);

        this.getVersions(join(__dirname, '../../../../../'));
        this.setupRefreshButton();

        // Проверяем наличие обновлений билдера (с небольшой задержкой, чтобы DOM был готов)
        setTimeout(() => {
            this.checkForBuilderUpdate();
        }, 500);

        // Запускаем валидацию при старте
        this.runValidation();

        // Добавляем обработчик для кнопки открытия файла version
        if (this.$.openVersionFileButton) {
            this.$.openVersionFileButton.addEventListener('click', () => this.openVersionFile());
        }

        // Добавляем обработчик для кнопки обновления файла version
        if (this.$.refreshVersionFileButton) {
            this.$.refreshVersionFileButton.addEventListener('click', () => this.refreshVersionFile());
        }

        // Добавляем обработчик для кнопки обновления билдера
        if (this.$.updateBuilderButton) {
            this.$.updateBuilderButton.addEventListener('click', () => this.updateBuilder());
        }

        // Добавляем обработчик для чекбокса автосейва
        if (this.$.autosaveCheckbox) {
            this.$.autosaveCheckbox.addEventListener('change', () => {
                const autosaveCheckbox = this.$.autosaveCheckbox as HTMLInputElement;
                if (autosaveCheckbox && autosaveCheckbox.checked && hasUnsavedChanges && this.hasVersionsChanged()) {
                    // Если автосейв включен и есть несохраненные изменения, сохраняем их
                    this.saveVersions();
                }
            });
        }

        // Добавляем обработчик для кнопки сохранения версий
        if (this.$.saveVersionsButton) {
            this.$.saveVersionsButton.addEventListener('click', () => this.saveVersions());
        }

        // Добавляем обработчик для кнопки добавления версии
        if (this.$.addVersionButton) {
            this.$.addVersionButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showAddVersionModal();
            });
        }

        // Обработчики для модального окна добавления версии
        if (this.$.addVersionCancel) {
            this.$.addVersionCancel.addEventListener('click', () => {
                this.hideAddVersionModal();
            });
        }

        if (this.$.addVersionConfirm) {
            this.$.addVersionConfirm.addEventListener('click', () => {
                this.addNewVersion();
            });
        }

        // Обработка Enter в поле ввода
        if (this.$.addVersionInput) {
            this.$.addVersionInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addNewVersion();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.hideAddVersionModal();
                }
            });
        }

        // Обработчики для кнопки добавления переменной
        if (this.$.addVariableButton) {
            this.$.addVariableButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.showAddVariableModal();
            });
        }

        // Обработчики для модального окна добавления переменной
        if (this.$.addVariableCancel) {
            this.$.addVariableCancel.addEventListener('click', () => {
                this.hideAddVariableModal();
            });
        }

        if (this.$.addVariableConfirm) {
            this.$.addVariableConfirm.addEventListener('click', () => {
                this.addNewVariable();
            });
        }

        // Обработка Enter в полях ввода переменной
        if (this.$.addVariableNameInput) {
            this.$.addVariableNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const valueInput = this.$.addVariableValueInput as HTMLInputElement;
                    if (valueInput) {
                        valueInput.focus();
                    }
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.hideAddVariableModal();
                }
            });
        }

        if (this.$.addVariableValueInput) {
            this.$.addVariableValueInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addNewVariable();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    this.hideAddVariableModal();
                }
            });
        }

        // Инициализируем видимость галочек очистки
        this.toggleClearDistVisibility();
        this.toggleClearSftpVisibility();

        // Инициализируем систему подсказок
        this.initializeTooltips();
    }
});

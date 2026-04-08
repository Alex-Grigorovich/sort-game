"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const child_process_1 = require("child_process");
const LogManager_1 = require("./modules/LogManager");
const ProgressManager_1 = require("./ProgressManager");
const ModalManager_1 = require("./modules/ModalManager");
const VersionsManager_1 = require("./modules/VersionsManager");
const UpdateManager_1 = require("./modules/UpdateManager");
const Validator_1 = require("./Validator");
const platform_1 = require("../../utils/platform");
// @ts-ignore
const package_json_1 = __importDefault(require("../../../package.json"));
let isBuilding = false;
let runningProcesses = [];
let buildStartTime;
let currentBuildTasks = [];
let versions = [];
let originalVersions = []; // Оригинальные версии для сравнения
let variablesStorage = {}; // Хранилище переменных с дефолтными значениями
let originalVariablesStorage = {}; // Оригинальное хранилище для сравнения
let selectedVersionName = null; // Имя выбранной версии для не прод режима
let originalSelectedVersionName = null; // Оригинальное значение для сравнения
let hasUnsavedChanges = false; // Флаг наличия несохраненных изменений
let isSaving = false; // Флаг процесса сохранения
let titleConfig = null;
let requiredVariables = {}; // Обязательные переменные из конфига тайтла
let remoteUrls = {};
let logManager;
let progressManager;
let modalManager;
let validator;
let validationState = {
    hasErrors: false,
    lastValidation: null
};
let copyVersionIndex = null; // Индекс версии для копирования
let renameVersionIndex = null; // Индекс версии для переименования
// Buffer for accumulating partial messages
let messageBuffer = '';
module.exports = Editor.Panel.define({
    listeners: {
        show() { },
        hide() { },
    },
    beforeClose() {
        // Убрали проверку несохраненных изменений - теперь проверяем только при закрытии редактора версий
        return true;
    },
    template: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/template/builder/index.html'), 'utf-8'),
    style: (0, fs_extra_1.readFileSync)((0, path_1.join)(__dirname, '../../../static/style/builder/index.css'), 'utf-8'),
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
        hasVersionsChanged() {
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
            const autosaveCheckbox = this.$.autosaveCheckbox;
            if (autosaveCheckbox && autosaveCheckbox.checked && !isSaving) {
                // Используем небольшую задержку для debounce при быстрых изменениях
                setTimeout(() => {
                    if (hasUnsavedChanges && !isSaving) {
                        this.saveVersions();
                    }
                }, 300);
            }
        },
        appendLog(msg, type) {
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
        processCompleteMessage(msg) {
            // Check if there are messages with file size
            // Parse URLs from logs
            const urls = this.parseUrlsFromLog(msg);
            if (urls.infoUrl)
                remoteUrls.infoUrl = urls.infoUrl;
            if (urls.infoQaUrl)
                remoteUrls.infoQaUrl = urls.infoQaUrl;
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
        parseUrlsFromLog(msg) {
            return logManager.parseUrlsFromLog(msg);
        },
        // Setup refresh button
        setupRefreshButton() {
            const refreshButton = this.$.refreshButton;
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
            const refreshButton = this.$.refreshButton;
            if (!refreshButton)
                return;
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
                logManager = new LogManager_1.LogManager(this.$.logContent, this.$.logSummaryText);
                // Reinitialize ProgressManager
                progressManager = new ProgressManager_1.ProgressManager({
                    // Checkbox sections for progress display
                    mainBuildSection: this.$.mainBuildSection,
                    superhtmlSection: this.$.superhtmlSection,
                    sftpSection: this.$.sftpSection,
                    // Progress indicators inside sections
                    mainBuildProgress: this.$.mainBuildProgress,
                    superhtmlProgress: this.$.superhtmlProgress,
                    sftpProgress: this.$.sftpProgress,
                    // Time elements
                    mainBuildTime: this.$.mainBuildTime,
                    superhtmlTime: this.$.superhtmlTime,
                    sftpTime: this.$.sftpTime,
                    // Progress statuses
                    mainBuildStatus: this.$.mainBuildStatus,
                    superhtmlStatus: this.$.superhtmlStatus,
                    sftpStatus: this.$.sftpStatus,
                    sftpCleanInfo: this.$.sftpCleanInfo
                });
                // Set additional progress bar elements
                progressManager.uiElements.mainBuildProgressFill = this.$.mainBuildProgressFill;
                progressManager.uiElements.superhtmlProgressFill = this.$.superhtmlProgressFill;
                progressManager.uiElements.sftpProgressFill = this.$.sftpProgressFill;
                progressManager.uiElements.mainBuildPercentage = this.$.mainBuildPercentage;
                progressManager.uiElements.superhtmlPercentage = this.$.superhtmlPercentage;
                progressManager.uiElements.sftpPercentage = this.$.sftpPercentage;
                // Reinitialize ModalManager
                modalManager = new ModalManager_1.ModalManager({
                    warningModal: this.$.warningModal,
                    warningCancel: this.$.warningCancel,
                    warningContinue: this.$.warningContinue,
                    sftpWarningModal: this.$.sftpWarningModal,
                    sftpWarningCancel: this.$.sftpWarningCancel,
                    sftpWarningContinue: this.$.sftpWarningContinue,
                    sftpCleanInfo: this.$.sftpCleanInfo,
                    unsavedChangesModal: this.$.unsavedChangesModal,
                    unsavedChangesCancel: this.$.unsavedChangesCancel,
                    unsavedChangesDiscard: this.$.unsavedChangesDiscard,
                    updateCompletedModal: this.$.updateCompletedModal,
                    updateCompletedOk: this.$.updateCompletedOk,
                    infoSection: this.$.infoSection,
                    toggleInfoButton: this.$.toggleInfoButton,
                    closeInfoButton: this.$.closeInfoButton,
                    pathsSection: this.$.pathsSection,
                    togglePathsButton: this.$.togglePathsButton,
                    closePathsButton: this.$.closePathsButton,
                    validatorSection: this.$.validatorSection,
                    toggleValidatorButton: this.$.toggleValidatorButton,
                    closeValidatorButton: this.$.closeValidatorButton,
                    unsavedSceneChangesModal: this.$.unsavedSceneChangesModal,
                    unsavedSceneCancel: this.$.unsavedSceneCancel,
                    unsavedSceneSave: this.$.unsavedSceneSave,
                    unsavedSceneContinue: this.$.unsavedSceneContinue
                }, {
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
                        const autosaveCheckbox = this.$.autosaveCheckbox;
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
                        const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                        this.getSuffixAndHash(projectPath, () => {
                            // После загрузки titleConfig обновляем редактор версий
                            this.displayVersionEditor();
                        });
                    }
                });
                // Reinitialize validator
                const projectRoot = (0, path_1.join)(__dirname, '../../../../../');
                validator = new Validator_1.Validator(projectRoot);
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
            const versionsList = this.$.versionsList;
            if (versionsList) {
                versionsList.innerHTML = '';
            }
            // Clear playable information
            const suffixElement = this.$.suffixElement;
            const hashElement = this.$.hashedFolderElement;
            const clientElement = this.$.clientElement;
            const titleKeyElement = this.$.titleKeyElement;
            const languagesElement = this.$.languagesElement;
            if (suffixElement)
                suffixElement.innerHTML = '-';
            if (hashElement)
                hashElement.innerHTML = '-';
            if (clientElement)
                clientElement.innerHTML = '-';
            if (titleKeyElement)
                titleKeyElement.innerHTML = '-';
            if (languagesElement)
                languagesElement.innerHTML = '-';
        },
        // Проверка наличия обновления билдера
        checkForBuilderUpdate() {
            try {
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const updateManager = new UpdateManager_1.UpdateManager(projectPath);
                const updateInfo = updateManager.checkForUpdate();
                console.log('Проверка обновлений билдера:', {
                    currentVersion: updateInfo.currentVersion,
                    latestVersion: updateInfo.latestVersion,
                    hasUpdate: updateInfo.hasUpdate
                });
                if (updateInfo.hasUpdate && updateInfo.latestVersion) {
                    // Показываем кнопку обновления
                    const updateButton = this.$.updateBuilderButton;
                    if (updateButton) {
                        updateButton.classList.remove('hidden');
                        updateButton.title = `Update builder from ${updateInfo.currentVersion} to ${updateInfo.latestVersion}`;
                        this.appendLog(`🔄 Доступно обновление билдера: ${updateInfo.currentVersion} → ${updateInfo.latestVersion}`, 'warn');
                    }
                    else {
                        console.warn('Кнопка обновления не найдена в DOM');
                    }
                }
                else {
                    // Скрываем кнопку обновления
                    const updateButton = this.$.updateBuilderButton;
                    if (updateButton) {
                        updateButton.classList.add('hidden');
                    }
                    // Логируем, если версии найдены, но обновления нет
                    if (updateInfo.currentVersion && updateInfo.latestVersion) {
                        console.log(`Билдер актуален: ${updateInfo.currentVersion} (последняя версия: ${updateInfo.latestVersion})`);
                    }
                    else {
                        console.warn('Не удалось определить версии:', {
                            currentVersion: updateInfo.currentVersion,
                            latestVersion: updateInfo.latestVersion
                        });
                    }
                }
            }
            catch (error) {
                console.error('Ошибка при проверке обновлений билдера:', error);
                this.appendLog(`❌ Ошибка при проверке обновлений: ${error}`, 'error');
            }
        },
        // Обновление билдера
        async updateBuilder() {
            const updateButton = this.$.updateBuilderButton;
            if (!updateButton)
                return;
            // Блокируем кнопку и показываем индикатор загрузки
            updateButton.disabled = true;
            updateButton.textContent = '⏳ Обновление...';
            try {
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const updateManager = new UpdateManager_1.UpdateManager(projectPath);
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
                }
                else {
                    this.appendLog(`❌ Ошибка при обновлении билдера: ${result.error}`, 'error');
                    updateButton.textContent = '🔄 Update';
                    updateButton.disabled = false;
                }
            }
            catch (error) {
                this.appendLog(`❌ Ошибка при обновлении билдера: ${error.message || error}`, 'error');
                updateButton.textContent = '🔄 Update';
                updateButton.disabled = false;
            }
        },
        // Manage visibility of dist folder cleanup checkbox
        toggleClearDistVisibility() {
            const superhtmlCheckbox = this.$.superhtmlCheckbox;
            const clearDistLabel = this.$.clearDistLabel;
            if (!superhtmlCheckbox || !clearDistLabel)
                return;
            if (superhtmlCheckbox.checked) {
                clearDistLabel.classList.remove('hidden');
            }
            else {
                clearDistLabel.classList.add('hidden');
            }
        },
        // Manage visibility of SFTP folder cleanup checkbox
        toggleClearSftpVisibility() {
            const sftpCheckbox = this.$.sftpCheckbox;
            const clearSftpLabel = this.$.clearSftpLabel;
            if (!sftpCheckbox || !clearSftpLabel)
                return;
            if (sftpCheckbox.checked) {
                clearSftpLabel.classList.remove('hidden');
            }
            else {
                clearSftpLabel.classList.add('hidden');
            }
        },
        // Manage SFTP checkbox availability
        setSftpCheckboxEnabled(enabled) {
            // If build is in progress, don't unlock checkboxes
            if (isBuilding) {
                return;
            }
            const sftpCheckbox = this.$.sftpCheckbox;
            const clearSftpCheckbox = this.$.clearSftpCheckbox;
            const superhtmlCheckbox = this.$.superhtmlCheckbox;
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
        setCheckboxesEnabled(enabled) {
            const checkboxes = [
                this.$.mainBuildCheckbox,
                this.$.superhtmlCheckbox,
                this.$.clearDistCheckbox,
                this.$.sftpCheckbox,
                this.$.clearSftpCheckbox
            ];
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
            const projectPath = (0, path_1.join)(__dirname, '../../../../../');
            const sftpFolderExists = this.checkSftpFolderExists(projectPath);
            const superhtmlCheckbox = this.$.superhtmlCheckbox;
            const checkboxes = [
                this.$.mainBuildCheckbox,
                this.$.superhtmlCheckbox,
                this.$.clearDistCheckbox,
                this.$.sftpCheckbox,
                this.$.clearSftpCheckbox
            ];
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
        clearDistFolder(projectPath) {
            return new Promise((resolve) => {
                const distPath = (0, path_1.join)(projectPath, 'dist');
                this.appendLog(`Clearing dist folder: ${distPath}`, 'warn');
                // Используем кроссплатформенную команду для удаления папки
                const command = platform_1.PlatformUtils.spawnCommand(platform_1.PlatformUtils.getRemoveDirectoryCommand(distPath), [], {
                    cwd: projectPath
                });
                command.stdout.on('data', (data) => {
                    this.appendLog(data.toString());
                });
                command.stderr.on('data', (data) => {
                    this.appendLog(data.toString(), 'error');
                });
                command.on('close', (code) => {
                    if (code === 0) {
                        this.appendLog('Dist folder successfully cleared', 'success');
                    }
                    else {
                        this.appendLog(`Error clearing dist folder (code ${code})`, 'error');
                    }
                    resolve();
                });
            });
        },
        // Getting clean-info information for SFTP
        getSftpCleanInfo(projectPath) {
            return new Promise((resolve) => {
                const command = platform_1.PlatformUtils.runNpmCommand('run sftp -- clean-info', projectPath);
                runningProcesses.push(command);
                let cleanInfo = '';
                let errorInfo = '';
                command.stdout.on('data', (data) => {
                    const log = data.toString();
                    cleanInfo += log;
                    // Parse structured logs in real time
                    progressManager.parseSftpLogs(log);
                });
                command.stderr.on('data', (data) => {
                    const errorLog = data.toString();
                    errorInfo += errorLog;
                });
                command.on('close', (code) => {
                    runningProcesses = runningProcesses.filter(p => p !== command);
                    if (code === 0) {
                        // If we have structured data, use it
                        const sftpCleanInfo = progressManager.getSftpCleanInfo();
                        if (sftpCleanInfo.items.length > 0) {
                            resolve('Structured information loaded');
                        }
                        else {
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
                    }
                    else {
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
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
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
        toggleBuildButton(building) {
            const btn = this.$.buildButton;
            if (!btn)
                return;
            isBuilding = building;
            btn.textContent = building ? 'Cancel' : 'Build';
        },
        // Functions for managing progress checklist
        showBuildProgress() {
            const lastBuildInfo = this.$.lastBuildInfo;
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
            const lastBuildInfo = this.$.lastBuildInfo;
            const lastBuildSummary = this.$.lastBuildSummary;
            const buildTimeElement = this.$.buildTime;
            const completedTasksElement = this.$.completedTasks;
            const buildLinksElement = this.$.buildLinks;
            const builtFilesElement = this.$.builtFiles;
            if (!lastBuildInfo || !lastBuildSummary || !buildTimeElement || !completedTasksElement || !buildLinksElement || !builtFilesElement)
                return;
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
                var _a, _b, _c;
                const taskElement = document.createElement('div');
                taskElement.className = 'completed-task';
                // Determine execution time for each task
                let taskTime = '';
                const stageTimings = progressManager.getStageTimings();
                if (task === 'Main Build' && ((_a = stageTimings.mainBuild) === null || _a === void 0 ? void 0 : _a.duration) !== undefined) {
                    taskTime = ` - ${progressManager.formatStageTime(stageTimings.mainBuild.duration)}`;
                }
                else if (task === 'SuperHTML Build' && ((_b = stageTimings.superHtmlBuild) === null || _b === void 0 ? void 0 : _b.duration) !== undefined) {
                    taskTime = ` - ${progressManager.formatStageTime(stageTimings.superHtmlBuild.duration)}`;
                }
                else if (task === 'SFTP Upload' && ((_c = stageTimings.sftpLoad) === null || _c === void 0 ? void 0 : _c.duration) !== undefined) {
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
        displayFileSizeWithRetry(builtFilesElement, lastBuildSummary, retryCount = 0) {
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
                }
                else {
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
            }
            else if (retryCount < maxRetries) {
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
            }
            else {
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
        addBuildResultLinks(container) {
            const projectPath = (0, path_1.join)(__dirname, '../../../../../');
            const mainBuildEnabled = this.$.mainBuildCheckbox.checked;
            const superHtmlEnabled = this.$.superhtmlCheckbox.checked;
            const loadToSftp = this.$.sftpCheckbox.checked;
            // Link to build folder (for main build)
            if (mainBuildEnabled && currentBuildTasks.includes('Main Build')) {
                const buildFolderLink = this.createBuildLink('📁 Open build folder', () => this.openFolder((0, path_1.join)(projectPath, 'build')), 'folder-link');
                container.appendChild(buildFolderLink);
            }
            // Link to dist folder (for SuperHTML build)
            if (superHtmlEnabled && currentBuildTasks.includes('SuperHTML Build')) {
                const distFolderLink = this.createBuildLink('📁 Open dist folder', () => this.openFolder((0, path_1.join)(projectPath, 'dist')), 'folder-link');
                container.appendChild(distFolderLink);
            }
            // Links to HTML files (after SFTP upload)
            if (loadToSftp && currentBuildTasks.includes('SFTP Upload')) {
                // Link to info.html (remote URL)
                if (remoteUrls.infoUrl) {
                    const infoHtmlLink = this.createBuildLink('🌐 Open info.html', () => this.openRemoteUrl(remoteUrls.infoUrl), 'html-link');
                    container.appendChild(infoHtmlLink);
                }
                // Link to info-qa.html (remote URL)
                if (remoteUrls.infoQaUrl) {
                    const infoQaHtmlLink = this.createBuildLink('🌐 Open info-qa.html', () => this.openRemoteUrl(remoteUrls.infoQaUrl), 'html-link');
                    container.appendChild(infoQaHtmlLink);
                }
            }
        },
        // Method for creating build result link
        createBuildLink(text, onClick, className) {
            const link = document.createElement('button');
            link.className = `build-link ${className}`;
            link.textContent = text;
            link.addEventListener('click', onClick);
            return link;
        },
        // Method for opening folder in file manager
        openFolder(folderPath) {
            try {
                const { spawn } = require('child_process');
                // Open folder in Windows Explorer
                spawn('explorer', [folderPath], { shell: true });
                this.appendLog(`Folder opened: ${folderPath}`, 'success');
            }
            catch (error) {
                this.appendLog(`Error opening folder: ${error}`, 'error');
            }
        },
        // Method for opening HTML file in browser
        openHtmlFile(filePath) {
            try {
                platform_1.PlatformUtils.openFile(filePath);
                this.appendLog(`File opened: ${filePath}`, 'success');
            }
            catch (error) {
                this.appendLog(`Error opening file: ${error}`, 'error');
            }
        },
        // Method for opening remote URL in browser
        openRemoteUrl(url) {
            try {
                platform_1.PlatformUtils.openUrl(url);
                this.appendLog(`URL opened: ${url}`, 'success');
            }
            catch (error) {
                this.appendLog(`Error opening URL: ${error}`, 'error');
            }
        },
        // Method for opening versions.cjs file
        openVersionFile() {
            try {
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const versionFilePath = (0, path_1.join)(projectPath, 'versions.cjs');
                // Check file existence
                if (!(0, fs_extra_1.existsSync)(versionFilePath)) {
                    this.appendLog(`versions.cjs file not found: ${versionFilePath}`, 'error');
                    return;
                }
                platform_1.PlatformUtils.openFile(versionFilePath);
                this.appendLog(`versions.cjs file opened: ${versionFilePath}`, 'success');
            }
            catch (error) {
                this.appendLog(`Error opening versions.cjs file: ${error}`, 'error');
            }
        },
        // Method for updating data from versions.cjs file
        refreshVersionFile() {
            try {
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const versionFilePath = (0, path_1.join)(projectPath, 'versions.cjs');
                // Check file existence
                if (!(0, fs_extra_1.existsSync)(versionFilePath)) {
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
            }
            catch (error) {
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
        showTooltip(event) {
            const element = event.target;
            const tooltipText = element.getAttribute('data-tooltip');
            if (!tooltipText)
                return;
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
            if (left < 8)
                left = 8;
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
        hideTooltip(event) {
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
                    if (platform_1.PlatformUtils.isWindows()) {
                        (0, child_process_1.spawn)('taskkill', ['/PID', proc.pid.toString(), '/F', '/T']);
                    }
                    else {
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
        runSuperHtmlBuild(projectPath) {
            return new Promise((resolve) => {
                if (!isBuilding) {
                    resolve();
                    return;
                }
                // Check if we need to clear dist folder
                const clearDistEnabled = this.$.clearDistCheckbox.checked;
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
                    const command = platform_1.PlatformUtils.runNpmCommand('run build', projectPath);
                    runningProcesses.push(command);
                    command.stdout.on('data', (data) => this.appendLog(data.toString()));
                    command.stderr.on('data', (data) => this.appendLog(data.toString(), 'error'));
                    command.on('close', (code) => {
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
                        }
                        else {
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
                        }
                        else {
                            resolve();
                        }
                    });
                }
                else {
                    runBuild();
                }
            });
        },
        runSFTPLoad(projectPath) {
            return new Promise((resolve) => {
                if (!isBuilding) {
                    resolve();
                    return;
                }
                // Check if we need to clear SFTP folder
                const clearSftpEnabled = this.$.clearSftpCheckbox.checked;
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
                    const command = platform_1.PlatformUtils.runNpmCommand(sftpCommand, projectPath);
                    runningProcesses.push(command);
                    command.stdout.on('data', (data) => {
                        const log = data.toString();
                        this.appendLog(log);
                        // Parse structured SFTP logs in real time
                        progressManager.parseSftpLogs(log);
                    });
                    command.stderr.on('data', (data) => this.appendLog(data.toString(), 'error'));
                    command.on('close', (code) => {
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
                        }
                        else {
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
        checkBuildFolderExists(projectPath) {
            const buildPath = (0, path_1.join)(projectPath, 'build', 'web-mobile');
            return (0, fs_extra_1.existsSync)(buildPath);
        },
        // Check dist/sftp folder existence
        checkSftpFolderExists(projectPath) {
            const sftpPath = (0, path_1.join)(projectPath, 'dist', 'sftp');
            return (0, fs_extra_1.existsSync)(sftpPath);
        },
        // Check config through buildHandler
        async checkBuildHandlerConfig(projectPath) {
            return new Promise((resolve) => {
                const command = platform_1.PlatformUtils.runNpmCommand('run build info', projectPath);
                runningProcesses.push(command);
                let hasValidConfig = false;
                command.stdout.on('data', (data) => {
                    const log = data.toString().trim();
                    // If we got JSON with config, build exists
                    if (log.includes('"name"') || log.includes('"suffix"')) {
                        hasValidConfig = true;
                    }
                });
                command.stderr.on('data', (data) => {
                    // If there is error, build does not exist
                    hasValidConfig = false;
                });
                command.on('close', (code) => {
                    runningProcesses = runningProcesses.filter(p => p !== command);
                    resolve(hasValidConfig && code === 0);
                });
            });
        },
        // Check necessity of forced main build activation
        async checkAndForceMainBuild(projectPath) {
            const buildFolderExists = this.checkBuildFolderExists(projectPath);
            const hasValidConfig = await this.checkBuildHandlerConfig(projectPath);
            const shouldForceMainBuild = !buildFolderExists || !hasValidConfig;
            if (shouldForceMainBuild) {
                const mainBuildCheckbox = this.$.mainBuildCheckbox;
                if (mainBuildCheckbox) {
                    mainBuildCheckbox.checked = true;
                    mainBuildCheckbox.disabled = true; // Block ability to uncheck
                    this.appendLog('⚠️ Main build forcibly activated (build/web-mobile folder or config missing)', 'warn');
                }
            }
            else {
                const mainBuildCheckbox = this.$.mainBuildCheckbox;
                if (mainBuildCheckbox) {
                    // Unlock only if build is not running
                    if (!isBuilding) {
                        mainBuildCheckbox.disabled = false; // Unlock management ability
                    }
                }
            }
            return shouldForceMainBuild;
        },
        getVersions(projectPath) {
            return new Promise((resolve) => {
                try {
                    // Clear require cache for versions.cjs file
                    const versionFilePath = (0, path_1.join)(projectPath, 'versions.cjs');
                    if ((0, fs_extra_1.existsSync)(versionFilePath)) {
                        delete require.cache[require.resolve(versionFilePath)];
                    }
                    // Load versions directly from file
                    const versionsManager = new VersionsManager_1.VersionsManager(projectPath);
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
                        requiredVariables = Object.assign({}, titleConfig.requiredVariables);
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
                        const superhtmlCheckbox = this.$.superhtmlCheckbox;
                        if (superhtmlCheckbox && superhtmlCheckbox.checked) {
                            this.appendLog('⚠️ dist/sftp folder not found, but SFTP upload is available thanks to enabled SuperHTML build.', 'success');
                        }
                        else {
                            this.appendLog('⚠️ dist/sftp folder not found. SFTP upload unavailable until build is completed.', 'warn');
                        }
                    }
                    // Check necessity of forced main build activation
                    this.checkAndForceMainBuild(projectPath).then(() => {
                        // Get all information through external process (versions, hash, suffix, title config)
                        this.getSuffixAndHash(projectPath, resolve);
                    });
                }
                catch (error) {
                    this.appendLog(`Error loading versions: ${error}`, 'error');
                    resolve();
                }
            });
        },
        getSuffixAndHash(projectPath, resolve) {
            const command = platform_1.PlatformUtils.runNpmCommand('run build info', projectPath);
            runningProcesses.push(command);
            let versionsData = '';
            let additionalInfoData = '';
            command.stdout.on('data', (data) => {
                const log = data.toString().trim();
                // Split data into two parts: versions and additional information
                if (log.includes('"name"') && !log.includes('"suffix"')) {
                    // This is version data
                    versionsData = log;
                }
                else if (log.includes('"suffix"') || log.includes('"hashedFolder"')) {
                    // This is additional information
                    additionalInfoData = log;
                }
                // Process additional information
                if (additionalInfoData) {
                    try {
                        const additionalInfo = JSON.parse(additionalInfoData);
                        const suffixElement = this.$.suffixElement;
                        const hashElement = this.$.hashedFolderElement;
                        const clientElement = this.$.clientElement;
                        const titleKeyElement = this.$.titleKeyElement;
                        const languagesElement = this.$.languagesElement;
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
                                requiredVariables = Object.assign({}, titleConfig.requiredVariables);
                                // Принудительно добавляем обязательные переменные в версии
                                this.applyRequiredVariables();
                            }
                            else {
                                requiredVariables = {};
                            }
                        }
                        // Display paths and naming information
                        if (additionalInfo.versionPaths && Array.isArray(additionalInfo.versionPaths)) {
                            this.displayVersionPaths(additionalInfo.versionPaths);
                        }
                    }
                    catch (error) {
                        // Error parsing additional information
                    }
                }
            });
            command.stderr.on('data', (data) => {
                const errorLog = data.toString();
                this.appendLog(errorLog, 'error');
            });
            command.on('close', (code) => {
                runningProcesses = runningProcesses.filter(p => p !== command);
                resolve();
            });
        },
        // Метод для отображения версий в виде спойлеров
        displayVersions() {
            const versionsList = this.$.versionsList; // Получаем контейнер для версий
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
        isRequiredVariable(variableName) {
            return variableName in requiredVariables;
        },
        // Метод для получения всех переменных (из хранилища и из версий)
        getAllVariables() {
            const allVariables = new Set(Object.keys(variablesStorage));
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
            var _a, _b;
            const versionEditor = this.$.versionEditor;
            const variablesList = this.$.variablesList;
            const versionsBuildList = this.$.versionsBuildList;
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
                let removeButton = null;
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
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', variableName);
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
            const addVersionButton = document.getElementById('add-version-button');
            if (addVersionButton) {
                // Удаляем старый обработчик, если есть
                const newButton = addVersionButton.cloneNode(true);
                (_a = addVersionButton.parentNode) === null || _a === void 0 ? void 0 : _a.replaceChild(newButton, addVersionButton);
                // Добавляем новый обработчик
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showAddVersionModal();
                });
            }
            // Убеждаемся, что обработчик кнопки добавления переменной привязан
            const addVariableButton = document.getElementById('add-variable-button');
            if (addVariableButton) {
                // Удаляем старый обработчик, если есть
                const newVariableButton = addVariableButton.cloneNode(true);
                (_b = addVariableButton.parentNode) === null || _b === void 0 ? void 0 : _b.replaceChild(newVariableButton, addVariableButton);
                // Добавляем новый обработчик
                newVariableButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showAddVariableModal();
                });
            }
        },
        // Метод для отображения путей и нейминга версий
        displayVersionPaths(versionPaths) {
            const versionPathsList = this.$.versionPathsList;
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
                    const hasVariants = versionInfo.files.some((file) => file.variantName);
                    if (hasVariants) {
                        // Группируем файлы сначала по variantName, потом по языкам
                        const filesByVariant = {};
                        versionInfo.files.forEach((file) => {
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
                            const filesByLanguage = {};
                            variantFiles.forEach((file) => {
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
                                filesByLanguage[lang].forEach((file) => {
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
                    }
                    else {
                        // Обычный режим — группируем файлы только по языкам
                        const filesByLanguage = {};
                        versionInfo.files.forEach((file) => {
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
                            filesByLanguage[lang].forEach((file) => {
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
                }
                else {
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
        createVersionContainer(versionObj, index) {
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
                }
                else {
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
                e.dataTransfer.dropEffect = 'move';
                container.classList.add('drag-over');
            });
            container.addEventListener('dragleave', () => {
                container.classList.remove('drag-over');
            });
            container.addEventListener('drop', (e) => {
                e.preventDefault();
                container.classList.remove('drag-over');
                const variableName = e.dataTransfer.getData('text/plain');
                if (variableName) {
                    // Для обязательных переменных используем значение из конфига
                    let value;
                    if (this.isRequiredVariable(variableName) && variableName in requiredVariables) {
                        value = requiredVariables[variableName];
                    }
                    else {
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
        createVersionItem(variableName, value, versionIndex) {
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
            let removeButton = null;
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
            const modal = this.$.addVersionModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const input = this.$.addVersionInput;
            const confirmButton = this.$.addVersionConfirm;
            if (modal && input && modalTitle && confirmButton) {
                modalTitle.textContent = 'Add New Version';
                confirmButton.textContent = 'Add';
                modal.classList.remove('hidden');
                input.value = '';
                input.focus();
            }
        },
        // Метод для показа модального окна копирования версии
        showCopyVersionModal(index) {
            var _a, _b;
            copyVersionIndex = index;
            renameVersionIndex = null;
            const modal = this.$.addVersionModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const input = this.$.addVersionInput;
            const confirmButton = this.$.addVersionConfirm;
            if (modal && input && modalTitle && confirmButton) {
                const versionName = ((_a = versions[index]) === null || _a === void 0 ? void 0 : _a.name) || ((_b = versions[index]) === null || _b === void 0 ? void 0 : _b.version) || `Version ${index + 1}`;
                modalTitle.textContent = 'Copy Version';
                confirmButton.textContent = 'Copy';
                modal.classList.remove('hidden');
                input.value = `${versionName}_copy`;
                input.focus();
                input.select();
            }
        },
        // Метод для показа модального окна переименования версии
        showRenameVersionModal(index) {
            var _a, _b;
            renameVersionIndex = index;
            copyVersionIndex = null;
            const modal = this.$.addVersionModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const input = this.$.addVersionInput;
            const confirmButton = this.$.addVersionConfirm;
            if (modal && input && modalTitle && confirmButton) {
                const versionName = ((_a = versions[index]) === null || _a === void 0 ? void 0 : _a.name) || ((_b = versions[index]) === null || _b === void 0 ? void 0 : _b.version) || `Version ${index + 1}`;
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
            const modal = this.$.addVersionModal;
            if (modal) {
                modal.classList.add('hidden');
                copyVersionIndex = null;
                renameVersionIndex = null;
            }
        },
        // Метод для добавления новой версии
        addNewVersion() {
            try {
                const input = this.$.addVersionInput;
                if (!input) {
                    if (renameVersionIndex !== null) {
                        this.showRenameVersionModal(renameVersionIndex);
                    }
                    else if (copyVersionIndex !== null) {
                        this.showCopyVersionModal(copyVersionIndex);
                    }
                    else {
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
                        const existingVersion = versions.find((v, idx) => idx !== renameVersionIndex && (v.name === versionName || v.version === versionName));
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
                    }
                    else if (copyVersionIndex !== null && copyVersionIndex >= 0 && copyVersionIndex < versions.length) {
                        // Копируем версию
                        const originalVersion = versions[copyVersionIndex];
                        const newVersion = Object.assign({}, originalVersion);
                        newVersion.name = versionName;
                        versions.push(newVersion);
                        this.appendLog(`Version "${versionName}" copied successfully from "${originalVersion.name || originalVersion.version}"`, 'success');
                        copyVersionIndex = null;
                    }
                    else {
                        // Создаем новую версию
                        const newVersion = {
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
                }
                else {
                    this.appendLog('Version name cannot be empty', 'error');
                    input.focus();
                }
            }
            catch (error) {
                this.appendLog(`Error adding/copying/renaming version: ${error}`, 'error');
            }
        },
        // Метод для показа модального окна добавления переменной
        showAddVariableModal() {
            const modal = this.$.addVariableModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const nameInput = this.$.addVariableNameInput;
            const valueInput = this.$.addVariableValueInput;
            const confirmButton = this.$.addVariableConfirm;
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
            const modal = this.$.addVariableModal;
            const nameInput = this.$.addVariableNameInput;
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
        showEditVariableModal(variableName) {
            const modal = this.$.addVariableModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const nameInput = this.$.addVariableNameInput;
            const valueInput = this.$.addVariableValueInput;
            const confirmButton = this.$.addVariableConfirm;
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
        showEditVersionVariableModal(variableName, versionIndex) {
            const modal = this.$.addVariableModal;
            const modalTitle = modal.querySelector('.warning-header h3');
            const nameInput = this.$.addVariableNameInput;
            const valueInput = this.$.addVariableValueInput;
            const confirmButton = this.$.addVariableConfirm;
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
                const modal = this.$.addVariableModal;
                const nameInput = this.$.addVariableNameInput;
                const valueInput = this.$.addVariableValueInput;
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
                    let typedValue = valueStr;
                    // Пытаемся определить тип значения
                    if (valueStr === 'true' || valueStr === 'false') {
                        typedValue = valueStr === 'true';
                    }
                    else if (!isNaN(Number(valueStr)) && valueStr !== '') {
                        typedValue = Number(valueStr);
                    }
                    else if (valueStr === '') {
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
                    }
                    else {
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
                }
                else {
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
                    let defaultValue = valueStr;
                    // Пытаемся определить тип значения
                    if (valueStr === 'true' || valueStr === 'false') {
                        defaultValue = valueStr === 'true';
                    }
                    else if (!isNaN(Number(valueStr)) && valueStr !== '') {
                        defaultValue = Number(valueStr);
                    }
                    else if (valueStr === '') {
                        defaultValue = '';
                    }
                    // Добавляем переменную в хранилище
                    variablesStorage[variableName] = defaultValue;
                    this.appendLog(`Variable "${variableName}" added successfully to variables storage`, 'success');
                    this.markVersionsAsChanged();
                    this.hideAddVariableModal();
                    this.displayVersionEditor();
                }
            }
            catch (error) {
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
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const versionFilePath = (0, path_1.join)(projectPath, 'versions.cjs');
                if (!(0, fs_extra_1.existsSync)(versionFilePath)) {
                    this.appendLog(`versions.cjs file not found: ${versionFilePath}`, 'error');
                    isSaving = false;
                    return;
                }
                // Читаем оригинальный файл для сохранения language и комментариев
                const originalContent = (0, fs_extra_1.readFileSync)(versionFilePath, 'utf-8');
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
                        if (a === 'name' || a === 'version')
                            return -1;
                        if (b === 'name' || b === 'version')
                            return 1;
                        return a.localeCompare(b);
                    });
                    keys.forEach((key, keyIndex) => {
                        const value = version[key];
                        let valueStr = '';
                        if (typeof value === 'string') {
                            // Экранируем кавычки в строках
                            const escapedValue = value.replace(/"/g, '\\"');
                            valueStr = `"${escapedValue}"`;
                        }
                        else if (typeof value === 'boolean') {
                            valueStr = String(value);
                        }
                        else if (typeof value === 'number') {
                            valueStr = String(value);
                        }
                        else if (value === null || value === undefined) {
                            valueStr = 'null';
                        }
                        else {
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
                        }
                        else if (typeof value === 'boolean') {
                            valueStr = String(value);
                        }
                        else if (typeof value === 'number') {
                            valueStr = String(value);
                        }
                        else if (value === null || value === undefined) {
                            valueStr = 'null';
                        }
                        else {
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
                (0, fs_extra_1.writeFileSync)(versionFilePath, fileContent, 'utf-8');
                // Проверяем, было ли это автоматическое сохранение
                const autosaveCheckbox = this.$.autosaveCheckbox;
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
            }
            catch (error) {
                this.appendLog(`Error saving versions: ${error}`, 'error');
            }
            finally {
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
        async checkSceneDirty() {
            try {
                if (typeof Editor === 'undefined' || !Editor.Message) {
                    return false;
                }
                const isDirty = await Editor.Message.request('scene', 'query-dirty');
                return isDirty;
            }
            catch (error) {
                console.warn('Failed to check scene dirty state:', error);
                return false;
            }
        },
        /**
         * Сохраняет текущую сцену
         * Используем API: Editor.Message.request('scene', 'save-scene')
         * Документация: @cocos/creator-types/editor/packages/scene/@types/message.d.ts
         */
        async saveScene() {
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
            }
            catch (error) {
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
            this.checkSceneDirty().then((hasUnsavedSceneChanges) => {
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
            const mainBuildEnabled = this.$.mainBuildCheckbox.checked;
            const superHtmlEnabled = this.$.superhtmlCheckbox.checked;
            const loadToSftp = this.$.sftpCheckbox.checked;
            const clearSftpEnabled = this.$.clearSftpCheckbox.checked;
            const projectPath = (0, path_1.join)(__dirname, '../../../../../');
            // Проверяем, нужно ли принудительно активировать основной билд
            this.checkAndForceMainBuild(projectPath).then((forcedMainBuild) => {
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
        async showSftpWarningWithInfo(projectPath) {
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
                }
                else {
                    // Fallback к старому форматированию
                    const formattedInfo = cleanInfo
                        .split('\n')
                        .filter((line) => line.trim())
                        .map((line) => `<div>${line}</div>`)
                        .join('');
                    modalManager.updateSftpCleanInfo(formattedInfo || '<p>Folder information not found</p>');
                }
            }
            catch (error) {
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
            const mainBuildEnabled = this.$.mainBuildCheckbox.checked;
            const superHtmlEnabled = this.$.superhtmlCheckbox.checked;
            const loadToSftp = this.$.sftpCheckbox.checked;
            const projectPath = (0, path_1.join)(__dirname, '../../../../../');
            // Проверяем, нужно ли принудительно активировать основной билд
            this.checkAndForceMainBuild(projectPath).then((forcedMainBuild) => {
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
        runBuildProcess(mainBuildEnabled, superHtmlEnabled, loadToSftp, projectPath) {
            // Основной билд
            const runMainBuild = () => new Promise((resolve) => {
                if (!isBuilding || !mainBuildEnabled) {
                    resolve();
                    return;
                }
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
                const configPath = (0, path_1.join)(projectPath, 'build-templates', 'crada_playable_2D.json');
                const mainBuild = (0, child_process_1.spawn)(cocosExePath, [`--project`, projectPath, `--build`, `configPath=${configPath}`], { cwd, shell: false });
                runningProcesses.push(mainBuild);
                mainBuild.stdout.on('data', (data) => this.appendLog(data.toString()));
                mainBuild.stderr.on('data', (data) => this.appendLog(data.toString(), 'error'));
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
                    }
                    else {
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
                if (!isBuilding)
                    return;
                if (superHtmlEnabled) {
                    return this.runSuperHtmlBuild(projectPath);
                }
                else {
                    return Promise.resolve();
                }
            })
                .then(() => {
                if (!isBuilding)
                    return;
                if (loadToSftp) {
                    return this.runSFTPLoad(projectPath);
                }
                else {
                    return Promise.resolve();
                }
            })
                .then(() => {
                if (isBuilding) {
                    // Проверяем, что все процессы завершены
                    if (runningProcesses.length === 0) {
                        this.finalizeBuild();
                    }
                    else {
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
                }
                else if (!isBuilding) {
                    // Если билд отменен, прерываем ожидание
                    clearInterval(checkInterval);
                }
            }, 100);
        },
        /**
         * Обновляет состояние кнопки валидатора в зависимости от результатов валидации
         */
        updateValidatorButtonState() {
            const toggleValidatorButton = this.$.toggleValidatorButton;
            if (!toggleValidatorButton)
                return;
            if (validationState.hasErrors) {
                toggleValidatorButton.classList.add('has-errors');
                toggleValidatorButton.classList.remove('no-errors');
                // Меняем иконку на восклицательный знак при ошибках
                toggleValidatorButton.textContent = '!';
            }
            else {
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
                const validatorContent = this.$.validatorContent;
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
            }
            catch (error) {
                const validatorContent = this.$.validatorContent;
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
            this.$.builderVersion.textContent = package_json_1.default.version || 'unknown';
        }
        // Инициализируем LogManager
        logManager = new LogManager_1.LogManager(this.$.logContent, this.$.logSummaryText);
        // Инициализируем ProgressManager
        progressManager = new ProgressManager_1.ProgressManager({
            // Checkbox sections for progress display
            mainBuildSection: this.$.mainBuildSection,
            superhtmlSection: this.$.superhtmlSection,
            sftpSection: this.$.sftpSection,
            // Progress indicators inside sections
            mainBuildProgress: this.$.mainBuildProgress,
            superhtmlProgress: this.$.superhtmlProgress,
            sftpProgress: this.$.sftpProgress,
            // Time elements
            mainBuildTime: this.$.mainBuildTime,
            superhtmlTime: this.$.superhtmlTime,
            sftpTime: this.$.sftpTime,
            // Progress statuses
            mainBuildStatus: this.$.mainBuildStatus,
            superhtmlStatus: this.$.superhtmlStatus,
            sftpStatus: this.$.sftpStatus,
            sftpCleanInfo: this.$.sftpCleanInfo
        });
        // Устанавливаем дополнительные элементы прогресс-баров
        progressManager.uiElements.mainBuildProgressFill = this.$.mainBuildProgressFill;
        progressManager.uiElements.superhtmlProgressFill = this.$.superhtmlProgressFill;
        progressManager.uiElements.sftpProgressFill = this.$.sftpProgressFill;
        progressManager.uiElements.mainBuildPercentage = this.$.mainBuildPercentage;
        progressManager.uiElements.superhtmlPercentage = this.$.superhtmlPercentage;
        progressManager.uiElements.sftpPercentage = this.$.sftpPercentage;
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
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                const sftpFolderExists = this.checkSftpFolderExists(projectPath);
                this.setSftpCheckboxEnabled(sftpFolderExists);
            });
        }
        // Добавляем обработчик для галочки SFTP
        if (this.$.sftpCheckbox) {
            this.$.sftpCheckbox.addEventListener('change', () => this.toggleClearSftpVisibility());
        }
        // Инициализируем ModalManager
        modalManager = new ModalManager_1.ModalManager({
            warningModal: this.$.warningModal,
            warningCancel: this.$.warningCancel,
            warningContinue: this.$.warningContinue,
            sftpWarningModal: this.$.sftpWarningModal,
            sftpWarningCancel: this.$.sftpWarningCancel,
            sftpWarningContinue: this.$.sftpWarningContinue,
            sftpCleanInfo: this.$.sftpCleanInfo,
            unsavedChangesModal: this.$.unsavedChangesModal,
            unsavedChangesCancel: this.$.unsavedChangesCancel,
            unsavedChangesDiscard: this.$.unsavedChangesDiscard,
            updateCompletedModal: this.$.updateCompletedModal,
            updateCompletedOk: this.$.updateCompletedOk,
            infoSection: this.$.infoSection,
            toggleInfoButton: this.$.toggleInfoButton,
            closeInfoButton: this.$.closeInfoButton,
            pathsSection: this.$.pathsSection,
            togglePathsButton: this.$.togglePathsButton,
            closePathsButton: this.$.closePathsButton,
            validatorSection: this.$.validatorSection,
            toggleValidatorButton: this.$.toggleValidatorButton,
            closeValidatorButton: this.$.closeValidatorButton,
            unsavedSceneChangesModal: this.$.unsavedSceneChangesModal,
            unsavedSceneCancel: this.$.unsavedSceneCancel,
            unsavedSceneSave: this.$.unsavedSceneSave,
            unsavedSceneContinue: this.$.unsavedSceneContinue
        }, {
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
                const autosaveCheckbox = this.$.autosaveCheckbox;
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
                const projectPath = (0, path_1.join)(__dirname, '../../../../../');
                this.getSuffixAndHash(projectPath, () => {
                    // После загрузки titleConfig обновляем редактор версий
                    this.displayVersionEditor();
                });
            }
        });
        // Инициализируем валидатор
        const projectRoot = (0, path_1.join)(__dirname, '../../../../../');
        validator = new Validator_1.Validator(projectRoot);
        this.getVersions((0, path_1.join)(__dirname, '../../../../../'));
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
                const autosaveCheckbox = this.$.autosaveCheckbox;
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
                }
                else if (e.key === 'Escape') {
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
                    const valueInput = this.$.addVariableValueInput;
                    if (valueInput) {
                        valueInput.focus();
                    }
                }
                else if (e.key === 'Escape') {
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
                }
                else if (e.key === 'Escape') {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9zb3VyY2UvcGFuZWxzL2RlZmF1bHQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSx1Q0FBbUU7QUFDbkUsK0JBQTRCO0FBQzVCLGlEQUFzRTtBQUN0RSxxREFBa0Q7QUFDbEQsdURBQW9EO0FBQ3BELHlEQUFzRDtBQUN0RCwrREFBNEQ7QUFDNUQsMkRBQXdEO0FBQ3hELDJDQUEyRDtBQUMzRCxtREFBcUQ7QUFDckQsYUFBYTtBQUNiLHlFQUFnRDtBQUVoRCxJQUFJLFVBQVUsR0FBRyxLQUFLLENBQUM7QUFDdkIsSUFBSSxnQkFBZ0IsR0FBcUMsRUFBRSxDQUFDO0FBQzVELElBQUksY0FBb0IsQ0FBQztBQUN6QixJQUFJLGlCQUFpQixHQUFhLEVBQUUsQ0FBQztBQUNyQyxJQUFJLFFBQVEsR0FBVSxFQUFFLENBQUM7QUFDekIsSUFBSSxnQkFBZ0IsR0FBVSxFQUFFLENBQUMsQ0FBQyxvQ0FBb0M7QUFDdEUsSUFBSSxnQkFBZ0IsR0FBMkIsRUFBRSxDQUFDLENBQUMsK0NBQStDO0FBQ2xHLElBQUksd0JBQXdCLEdBQTJCLEVBQUUsQ0FBQyxDQUFDLHVDQUF1QztBQUNsRyxJQUFJLG1CQUFtQixHQUFrQixJQUFJLENBQUMsQ0FBQywwQ0FBMEM7QUFDekYsSUFBSSwyQkFBMkIsR0FBa0IsSUFBSSxDQUFDLENBQUMsc0NBQXNDO0FBQzdGLElBQUksaUJBQWlCLEdBQVksS0FBSyxDQUFDLENBQUMsdUNBQXVDO0FBQy9FLElBQUksUUFBUSxHQUFZLEtBQUssQ0FBQyxDQUFDLDJCQUEyQjtBQUMxRCxJQUFJLFdBQVcsR0FBUSxJQUFJLENBQUM7QUFDNUIsSUFBSSxpQkFBaUIsR0FBMkIsRUFBRSxDQUFDLENBQUMsNENBQTRDO0FBQ2hHLElBQUksVUFBVSxHQUE2QyxFQUFFLENBQUM7QUFDOUQsSUFBSSxVQUFzQixDQUFDO0FBQzNCLElBQUksZUFBZ0MsQ0FB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QixJQUFJLENBQUMsQ0FBQyxDQUFDLHFCQUFxQixDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxDQUFDLENBQUMsRUFBRSxFQUFFO2dCQUMzRCxJQUFJLENBQUMsQ0FBQyxHQUFHLEtBQUssT0FBTyxFQUFFLENBQUM7b0JBQ3BCLENBQUMsQ0FBQyxjQUFjLEVBQUUsQ0FBQztvQkFDbkIsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO2dCQUMxQixDQUFDO3FCQUFNLElBQUksQ0FBQyxDQUFDLEdBQUcsS0FBSyxRQUFRLEVBQUUsQ0FBQztvQkFDNUIsQ0FBQyxDQUFDLGNBQWMsRUFBRSxDQUFDO29CQUNuQixJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztnQkFDaEMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1FBQ1AsQ0FBQztRQUVELDJDQUEyQztRQUMzQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNqQyxJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUVqQyxtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDOUIsQ0FBQztDQUNKLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IHJlYWRGaWxlU3luYywgZXhpc3RzU3luYywgd3JpdGVGaWxlU3luYyB9IGZyb20gJ2ZzLWV4dHJhJztcclxuaW1wb3J0IHsgam9pbiB9IGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgeyBzcGF3biwgQ2hpbGRQcm9jZXNzV2l0aG91dE51bGxTdHJlYW1zIH0gZnJvbSAnY2hpbGRfcHJvY2Vzcyc7XHJcbmltcG9ydCB7IExvZ01hbmFnZXIgfSBmcm9tICcuL21vZHVsZXMvTG9nTWFuYWdlcic7XHJcbmltcG9ydCB7IFByb2dyZXNzTWFuYWdlciB9IGZyb20gJy4vUHJvZ3Jlc3NNYW5hZ2VyJztcclxuaW1wb3J0IHsgTW9kYWxNYW5hZ2VyIH0gZnJvbSAnLi9tb2R1bGVzL01vZGFsTWFuYWdlcic7XHJcbmltcG9ydCB7IFZlcnNpb25zTWFuYWdlciB9IGZyb20gJy4vbW9kdWxlcy9WZXJzaW9uc01hbmFnZXInO1xyXG5pbXBvcnQgeyBVcGRhdGVNYW5hZ2VyIH0gZnJvbSAnLi9tb2R1bGVzL1VwZGF0ZU1hbmFnZXInO1xyXG5pbXBvcnQgeyBWYWxpZGF0b3IsIFZhbGlkYXRpb25TdW1tYXJ5IH0gZnJvbSAnLi9WYWxpZGF0b3InO1xyXG5pbXBvcnQgeyBQbGF0Zm9ybVV0aWxzIH0gZnJvbSAnLi4vLi4vdXRpbHMvcGxhdGZvcm0nO1xyXG4vLyBAdHMtaWdub3JlXHJcbmltcG9ydCBwYWNrYWdlSlNPTiBmcm9tICcuLi8uLi8uLi9wYWNrYWdlLmpzb24nO1xyXG5cclxubGV0IGlzQnVpbGRpbmcgPSBmYWxzZTtcclxubGV0IHJ1bm5pbmdQcm9jZXNzZXM6IENoaWxkUHJvY2Vzc1dpdGhvdXROdWxsU3RyZWFtc1tdID0gW107XHJcbmxldCBidWlsZFN0YXJ0VGltZTogRGF0ZTtcclxubGV0IGN1cnJlbnRCdWlsZFRhc2tzOiBzdHJpbmdbXSA9IFtdO1xyXG5sZXQgdmVyc2lvbnM6IGFueVtdID0gW107XHJcbmxldCBvcmlnaW5hbFZlcnNpb25zOiBhbnlbXSA9IFtdOyAvLyDQntGA0LjQs9C40L3QsNC70YzQvdGL0LUg0LLQtdGA0YHQuNC4INC00LvRjyDRgdGA0LDQstC90LXQvdC40Y9cclxubGV0IHZhcmlhYmxlc1N0b3JhZ2U6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTsgLy8g0KXRgNCw0L3QuNC70LjRidC1INC/0LXRgNC10LzQtdC90L3Ri9GFINGBINC00LXRhNC+0LvRgtC90YvQvNC4INC30L3QsNGH0LXQvdC40Y/QvNC4XHJcbmxldCBvcmlnaW5hbFZhcmlhYmxlc1N0b3JhZ2U6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTsgLy8g0J7RgNC40LPQuNC90LDQu9GM0L3QvtC1INGF0YDQsNC90LjQu9C40YnQtSDQtNC70Y8g0YHRgNCw0LLQvdC10L3QuNGPXHJcbmxldCBzZWxlY3RlZFZlcnNpb25OYW1lOiBzdHJpbmcgfCBudWxsID0gbnVsbDsgLy8g0JjQvNGPINCy0YvQsdGA0LDQvdC90L7QuSDQstC10YDRgdC40Lgg0LTQu9GPINC90LUg0L/RgNC+0LQg0YDQtdC20LjQvNCwXHJcbmxldCBvcmlnaW5hbFNlbGVjdGVkVmVyc2lvbk5hbWU6IHN0cmluZyB8IG51bGwgPSBudWxsOyAvLyDQntGA0LjQs9C40L3QsNC70YzQvdC+0LUg0LfQvdCw0YfQtdC90LjQtSDQtNC70Y8g0YHRgNCw0LLQvdC10L3QuNGPXHJcbmxldCBoYXNVbnNhdmVkQ2hhbmdlczogYm9vbGVhbiA9IGZhbHNlOyAvLyDQpNC70LDQsyDQvdCw0LvQuNGH0LjRjyDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40LlcclxubGV0IGlzU2F2aW5nOiBib29sZWFuID0gZmFsc2U7IC8vINCk0LvQsNCzINC/0YDQvtGG0LXRgdGB0LAg0YHQvtGF0YDQsNC90LXQvdC40Y9cclxubGV0IHRpdGxlQ29uZmlnOiBhbnkgPSBudWxsO1xyXG5sZXQgcmVxdWlyZWRWYXJpYWJsZXM6IHsgW2tleTogc3RyaW5nXTogYW55IH0gPSB7fTsgLy8g0J7QsdGP0LfQsNGC0LXQu9GM0L3Ri9C1INC/0LXRgNC10LzQtdC90L3Ri9C1INC40Lcg0LrQvtC90YTQuNCz0LAg0YLQsNC50YLQu9CwXHJcbmxldCByZW1vdGVVcmxzOiB7IGluZm9Vcmw/OiBzdHJpbmc7IGluZm9RYVVybD86IHN0cmluZyB9ID0ge307XHJcbmxldCBsb2dNYW5hZ2VyOiBMb2dNYW5hZ2VyO1xyXG5sZXQgcHJvZ3Jlc3NNYW5hZ2VyOiBQcm9ncmVzc01hbmFnZXI7XHJcbmxldCBtb2RhbE1hbmFnZXI6IE1vZGFsTWFuYWdlcjtcclxubGV0IHZhbGlkYXRvcjogVmFsaWRhdG9yO1xyXG5sZXQgdmFsaWRhdGlvblN0YXRlOiB7XHJcbiAgICBoYXNFcnJvcnM6IGJvb2xlYW47XHJcbiAgICBsYXN0VmFsaWRhdGlvbjogVmFsaWRhdGlvblN1bW1hcnkgfCBudWxsO1xyXG59ID0ge1xyXG4gICAgaGFzRXJyb3JzOiBmYWxzZSxcclxuICAgIGxhc3RWYWxpZGF0aW9uOiBudWxsXHJcbn07XHJcbmxldCBjb3B5VmVyc2lvbkluZGV4OiBudW1iZXIgfCBudWxsID0gbnVsbDsgLy8g0JjQvdC00LXQutGBINCy0LXRgNGB0LjQuCDQtNC70Y8g0LrQvtC/0LjRgNC+0LLQsNC90LjRj1xyXG5sZXQgcmVuYW1lVmVyc2lvbkluZGV4OiBudW1iZXIgfCBudWxsID0gbnVsbDsgLy8g0JjQvdC00LXQutGBINCy0LXRgNGB0LjQuCDQtNC70Y8g0L/QtdGA0LXQuNC80LXQvdC+0LLQsNC90LjRj1xyXG5cclxuLy8gQnVmZmVyIGZvciBhY2N1bXVsYXRpbmcgcGFydGlhbCBtZXNzYWdlc1xyXG5sZXQgbWVzc2FnZUJ1ZmZlcjogc3RyaW5nID0gJyc7XHJcblxyXG5tb2R1bGUuZXhwb3J0cyA9IEVkaXRvci5QYW5lbC5kZWZpbmUoe1xyXG4gICAgbGlzdGVuZXJzOiB7XHJcbiAgICAgICAgc2hvdygpIHsgfSxcclxuICAgICAgICBoaWRlKCkgeyB9LFxyXG4gICAgfSxcclxuICAgIGJlZm9yZUNsb3NlKCkge1xyXG4gICAgICAgIC8vINCj0LHRgNCw0LvQuCDQv9GA0L7QstC10YDQutGDINC90LXRgdC+0YXRgNCw0L3QtdC90L3Ri9GFINC40LfQvNC10L3QtdC90LjQuSAtINGC0LXQv9C10YDRjCDQv9GA0L7QstC10YDRj9C10Lwg0YLQvtC70YzQutC+INC/0YDQuCDQt9Cw0LrRgNGL0YLQuNC4INGA0LXQtNCw0LrRgtC+0YDQsCDQstC10YDRgdC40LlcclxuICAgICAgICByZXR1cm4gdHJ1ZTtcclxuICAgIH0sXHJcblxyXG4gICAgdGVtcGxhdGU6IHJlYWRGaWxlU3luYyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uL3N0YXRpYy90ZW1wbGF0ZS9idWlsZGVyL2luZGV4Lmh0bWwnKSwgJ3V0Zi04JyksXHJcbiAgICBzdHlsZTogcmVhZEZpbGVTeW5jKGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vc3RhdGljL3N0eWxlL2J1aWxkZXIvaW5kZXguY3NzJyksICd1dGYtOCcpLFxyXG5cclxuICAgICQ6IHtcclxuICAgICAgICBhcHA6ICcjYXBwJyxcclxuICAgICAgICBidWlsZEJ1dHRvbjogJy5idWlsZC1idXR0b24nLFxyXG4gICAgICAgIGNsZWFyTG9nc0J1dHRvbjogJy5jbGVhci1sb2dzLWJ1dHRvbicsXHJcbiAgICAgICAgbG9nQ29udGVudDogJyNsb2ctY29udGVudCcsXHJcbiAgICAgICAgbG9nU3VtbWFyeTogJyNsb2ctc3VtbWFyeScsXHJcbiAgICAgICAgbG9nU3VtbWFyeVRleHQ6ICcjbG9nLXN1bW1hcnktdGV4dCcsXHJcbiAgICAgICAgYnVpbGRTdGF0dXM6ICcjYnVpbGQtc3RhdHVzJyxcclxuICAgICAgICBtYWluQnVpbGRDaGVja2JveDogJyNtYWluLWJ1aWxkLWNoZWNrYm94JyxcclxuICAgICAgICBzdXBlcmh0bWxDaGVja2JveDogJyNzdXBlcmh0bWwtY2hlY2tib3gnLFxyXG4gICAgICAgIGNsZWFyRGlzdENoZWNrYm94OiAnI2NsZWFyLWRpc3QtY2hlY2tib3gnLFxyXG4gICAgICAgIGNsZWFyRGlzdExhYmVsOiAnI2NsZWFyLWRpc3QtbGFiZWwnLFxyXG4gICAgICAgIHNmdHBDaGVja2JveDogJyNzZnRwLWNoZWNrYm94JyxcclxuICAgICAgICBjbGVhclNmdHBDaGVja2JveDogJyNjbGVhci1zZnRwLWNoZWNrYm94JyxcclxuICAgICAgICBjbGVhclNmdHBMYWJlbDogJyNjbGVhci1zZnRwLWxhYmVsJyxcclxuICAgICAgICAvLyBDaGVja2JveCBzZWN0aW9ucyBmb3IgcHJvZ3Jlc3MgZGlzcGxheVxyXG4gICAgICAgIG1haW5CdWlsZFNlY3Rpb246ICcjbWFpbi1idWlsZC1zZWN0aW9uJyxcclxuICAgICAgICBzdXBlcmh0bWxTZWN0aW9uOiAnI3N1cGVyaHRtbC1zZWN0aW9uJyxcclxuICAgICAgICBzZnRwU2VjdGlvbjogJyNzZnRwLXNlY3Rpb24nLFxyXG4gICAgICAgIC8vIFByb2dyZXNzIGluZGljYXRvcnMgaW5zaWRlIHNlY3Rpb25zXHJcbiAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3M6ICcjbWFpbi1idWlsZC1wcm9ncmVzcycsXHJcbiAgICAgICAgc3VwZXJodG1sUHJvZ3Jlc3M6ICcjc3VwZXJodG1sLXByb2dyZXNzJyxcclxuICAgICAgICBzZnRwUHJvZ3Jlc3M6ICcjc2Z0cC1wcm9ncmVzcycsXHJcbiAgICAgICAgLy8gVGltZSBlbGVtZW50c1xyXG4gICAgICAgIG1haW5CdWlsZFRpbWU6ICcjbWFpbi1idWlsZC10aW1lJyxcclxuICAgICAgICBzdXBlcmh0bWxUaW1lOiAnI3N1cGVyaHRtbC10aW1lJyxcclxuICAgICAgICBzZnRwVGltZTogJyNzZnRwLXRpbWUnLFxyXG4gICAgICAgIC8vIFByb2dyZXNzIHN0YXR1c2VzXHJcbiAgICAgICAgbWFpbkJ1aWxkU3RhdHVzOiAnI21haW4tYnVpbGQtc3RhdHVzJyxcclxuICAgICAgICBzdXBlcmh0bWxTdGF0dXM6ICcjc3VwZXJodG1sLXN0YXR1cycsXHJcbiAgICAgICAgc2Z0cFN0YXR1czogJyNzZnRwLXN0YXR1cycsXHJcbiAgICAgICAgLy8gUHJvZ3Jlc3MgYmFyIGVsZW1lbnRzXHJcbiAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3NGaWxsOiAnI21haW4tYnVpbGQtcHJvZ3Jlc3MtZmlsbCcsXHJcbiAgICAgICAgc3VwZXJodG1sUHJvZ3Jlc3NGaWxsOiAnI3N1cGVyaHRtbC1wcm9ncmVzcy1maWxsJyxcclxuICAgICAgICBzZnRwUHJvZ3Jlc3NGaWxsOiAnI3NmdHAtcHJvZ3Jlc3MtZmlsbCcsXHJcbiAgICAgICAgbWFpbkJ1aWxkUGVyY2VudGFnZTogJyNtYWluLWJ1aWxkLXBlcmNlbnRhZ2UnLFxyXG4gICAgICAgIHN1cGVyaHRtbFBlcmNlbnRhZ2U6ICcjc3VwZXJodG1sLXBlcmNlbnRhZ2UnLFxyXG4gICAgICAgIHNmdHBQZXJjZW50YWdlOiAnI3NmdHAtcGVyY2VudGFnZScsXHJcbiAgICAgICAgbGFzdEJ1aWxkSW5mbzogJyNsYXN0LWJ1aWxkLWluZm8nLFxyXG4gICAgICAgIGxhc3RCdWlsZFN1bW1hcnk6ICcjbGFzdC1idWlsZC1zdW1tYXJ5JyxcclxuICAgICAgICBidWlsZFRpbWU6ICcjYnVpbGQtdGltZScsXHJcbiAgICAgICAgY29tcGxldGVkVGFza3M6ICcjY29tcGxldGVkLXRhc2tzJyxcclxuICAgICAgICBidWlsZExpbmtzOiAnI2J1aWxkLWxpbmtzJyxcclxuICAgICAgICB2ZXJzaW9uc0xpc3Q6ICcjdmVyc2lvbnMtbGlzdCcsXHJcbiAgICAgICAgc3VmZml4RWxlbWVudDogJyNzdWZmaXhFbGVtZW50JywgLy8gQWRkIGVsZW1lbnQgZm9yIHN1ZmZpeCBkaXNwbGF5XHJcbiAgICAgICAgaGFzaGVkRm9sZGVyRWxlbWVudDogJyNoYXNoZWRGb2xkZXJFbGVtZW50JywgLy8gQWRkIGVsZW1lbnQgZm9yIGhhc2hlZCBwYXRoIGRpc3BsYXlcclxuICAgICAgICBjbGllbnRFbGVtZW50OiAnI2NsaWVudEVsZW1lbnQnLCAvLyBBZGQgZWxlbWVudCBmb3IgY2xpZW50IGRpc3BsYXlcclxuICAgICAgICB0aXRsZUtleUVsZW1lbnQ6ICcjdGl0bGVLZXlFbGVtZW50JywgLy8gQWRkIGVsZW1lbnQgZm9yIHRpdGxlIGtleSBkaXNwbGF5XHJcbiAgICAgICAgbGFuZ3VhZ2VzRWxlbWVudDogJyNsYW5ndWFnZXNFbGVtZW50JywgLy8gQWRkIGVsZW1lbnQgZm9yIGxhbmd1YWdlcyBkaXNwbGF5XHJcbiAgICAgICAgcGF0aHNTZWN0aW9uOiAnI3BhdGhzLXNlY3Rpb24nLCAvLyBBZGQgZWxlbWVudCBmb3IgcGF0aHMgc2VjdGlvblxyXG4gICAgICAgIHZlcnNpb25QYXRoc0xpc3Q6ICcjdmVyc2lvbi1wYXRocy1saXN0JywgLy8gQWRkIGVsZW1lbnQgZm9yIHZlcnNpb24gcGF0aHMgbGlzdFxyXG4gICAgICAgIHRvZ2dsZVBhdGhzQnV0dG9uOiAnI3RvZ2dsZS1wYXRocy1idXR0b24nLCAvLyBBZGQgZWxlbWVudCBmb3IgdG9nZ2xlIHBhdGhzIGJ1dHRvblxyXG4gICAgICAgIGNsb3NlUGF0aHNCdXR0b246ICcjY2xvc2UtcGF0aHMtYnV0dG9uJywgLy8gQWRkIGVsZW1lbnQgZm9yIGNsb3NlIHBhdGhzIGJ1dHRvblxyXG4gICAgICAgIHRvZ2dsZUluZm9CdXR0b246ICcjdG9nZ2xlLWluZm8tYnV0dG9uJyxcclxuICAgICAgICBpbmZvU2VjdGlvbjogJyNpbmZvLXNlY3Rpb24nLFxyXG4gICAgICAgIGNsb3NlSW5mb0J1dHRvbjogJyNjbG9zZS1pbmZvLWJ1dHRvbicsXHJcbiAgICAgICAgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uOiAnI3RvZ2dsZS12YWxpZGF0b3ItYnV0dG9uJyxcclxuICAgICAgICB2YWxpZGF0b3JTZWN0aW9uOiAnI3ZhbGlkYXRvci1zZWN0aW9uJyxcclxuICAgICAgICBjbG9zZVZhbGlkYXRvckJ1dHRvbjogJyNjbG9zZS12YWxpZGF0b3ItYnV0dG9uJyxcclxuICAgICAgICB2YWxpZGF0b3JDb250ZW50OiAnLnZhbGlkYXRvci1jb250ZW50JyxcclxuICAgICAgICByZWZyZXNoQnV0dG9uOiAnI3JlZnJlc2gtYnV0dG9uJyxcclxuICAgICAgICB1cGRhdGVCdWlsZGVyQnV0dG9uOiAnI3VwZGF0ZS1idWlsZGVyLWJ1dHRvbicsXHJcbiAgICAgICAgb3BlblZlcnNpb25GaWxlQnV0dG9uOiAnI29wZW4tdmVyc2lvbi1maWxlLWJ1dHRvbicsXHJcbiAgICAgICAgcmVmcmVzaFZlcnNpb25GaWxlQnV0dG9uOiAnI3JlZnJlc2gtdmVyc2lvbi1maWxlLWJ1dHRvbicsXHJcbiAgICAgICAgc2F2ZVZlcnNpb25zQnV0dG9uOiAnI3NhdmUtdmVyc2lvbnMtYnV0dG9uJyxcclxuICAgICAgICBhdXRvc2F2ZUNoZWNrYm94OiAnI2F1dG9zYXZlLWNoZWNrYm94JyxcclxuICAgICAgICB2ZXJzaW9uRWRpdG9yOiAnI3ZlcnNpb24tZWRpdG9yJyxcclxuICAgICAgICB2YXJpYWJsZXNMaXN0OiAnI3ZhcmlhYmxlcy1saXN0JyxcclxuICAgICAgICB2ZXJzaW9uc0J1aWxkTGlzdDogJyN2ZXJzaW9ucy1idWlsZC1saXN0JyxcclxuICAgICAgICBhZGRWZXJzaW9uQnV0dG9uOiAnI2FkZC12ZXJzaW9uLWJ1dHRvbicsXHJcbiAgICAgICAgYWRkVmVyc2lvbk1vZGFsOiAnI2FkZC12ZXJzaW9uLW1vZGFsJyxcclxuICAgICAgICBhZGRWZXJzaW9uSW5wdXQ6ICcjdmVyc2lvbi1uYW1lLWlucHV0JyxcclxuICAgICAgICBhZGRWZXJzaW9uQ2FuY2VsOiAnI2FkZC12ZXJzaW9uLWNhbmNlbCcsXHJcbiAgICAgICAgYWRkVmVyc2lvbkNvbmZpcm06ICcjYWRkLXZlcnNpb24tY29uZmlybScsXHJcbiAgICAgICAgYWRkVmFyaWFibGVCdXR0b246ICcjYWRkLXZhcmlhYmxlLWJ1dHRvbicsXHJcbiAgICAgICAgYWRkVmFyaWFibGVNb2RhbDogJyNhZGQtdmFyaWFibGUtbW9kYWwnLFxyXG4gICAgICAgIGFkZFZhcmlhYmxlTmFtZUlucHV0OiAnI3ZhcmlhYmxlLW5hbWUtaW5wdXQnLFxyXG4gICAgICAgIGFkZFZhcmlhYmxlVmFsdWVJbnB1dDogJyN2YXJpYWJsZS12YWx1ZS1pbnB1dCcsXHJcbiAgICAgICAgYWRkVmFyaWFibGVDYW5jZWw6ICcjYWRkLXZhcmlhYmxlLWNhbmNlbCcsXHJcbiAgICAgICAgYWRkVmFyaWFibGVDb25maXJtOiAnI2FkZC12YXJpYWJsZS1jb25maXJtJyxcclxuICAgICAgICB3YXJuaW5nTW9kYWw6ICcjd2FybmluZy1tb2RhbCcsXHJcbiAgICAgICAgd2FybmluZ0NhbmNlbDogJyN3YXJuaW5nLWNhbmNlbCcsXHJcbiAgICAgICAgd2FybmluZ0NvbnRpbnVlOiAnI3dhcm5pbmctY29udGludWUnLFxyXG4gICAgICAgIHNmdHBXYXJuaW5nTW9kYWw6ICcjc2Z0cC13YXJuaW5nLW1vZGFsJyxcclxuICAgICAgICBzZnRwV2FybmluZ0NhbmNlbDogJyNzZnRwLXdhcm5pbmctY2FuY2VsJyxcclxuICAgICAgICBzZnRwV2FybmluZ0NvbnRpbnVlOiAnI3NmdHAtd2FybmluZy1jb250aW51ZScsXHJcbiAgICAgICAgc2Z0cENsZWFuSW5mbzogJyNzZnRwLWNsZWFuLWluZm8nLFxyXG4gICAgICAgIHVuc2F2ZWRDaGFuZ2VzTW9kYWw6ICcjdW5zYXZlZC1jaGFuZ2VzLW1vZGFsJyxcclxuICAgICAgICB1bnNhdmVkQ2hhbmdlc0NhbmNlbDogJyN1bnNhdmVkLWNoYW5nZXMtY2FuY2VsJyxcclxuICAgICAgICB1bnNhdmVkQ2hhbmdlc0Rpc2NhcmQ6ICcjdW5zYXZlZC1jaGFuZ2VzLWRpc2NhcmQnLFxyXG4gICAgICAgIHVuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbDogJyN1bnNhdmVkLXNjZW5lLWNoYW5nZXMtbW9kYWwnLFxyXG4gICAgICAgIHVuc2F2ZWRTY2VuZUNhbmNlbDogJyN1bnNhdmVkLXNjZW5lLWNhbmNlbCcsXHJcbiAgICAgICAgdW5zYXZlZFNjZW5lU2F2ZTogJyN1bnNhdmVkLXNjZW5lLXNhdmUnLFxyXG4gICAgICAgIHVuc2F2ZWRTY2VuZUNvbnRpbnVlOiAnI3Vuc2F2ZWQtc2NlbmUtY29udGludWUnLFxyXG4gICAgICAgIHVwZGF0ZUNvbXBsZXRlZE1vZGFsOiAnI3VwZGF0ZS1jb21wbGV0ZWQtbW9kYWwnLFxyXG4gICAgICAgIHVwZGF0ZUNvbXBsZXRlZE9rOiAnI3VwZGF0ZS1jb21wbGV0ZWQtb2snLFxyXG4gICAgICAgIGJ1aWx0RmlsZXM6ICcjYnVpbHQtZmlsZXMnLFxyXG4gICAgICAgIGJ1aWxkZXJWZXJzaW9uOiAnI2J1aWxkZXItdmVyc2lvbidcclxuICAgIH0sXHJcblxyXG4gICAgbWV0aG9kczoge1xyXG4gICAgICAgIC8vINCk0YPQvdC60YbQuNGPINC00LvRjyDRgdGA0LDQstC90LXQvdC40Y8g0LLQtdGA0YHQuNC5INC4INGF0YDQsNC90LjQu9C40YnQsCDQv9C10YDQtdC80LXQvdC90YvRhVxyXG4gICAgICAgIGhhc1ZlcnNpb25zQ2hhbmdlZCgpOiBib29sZWFuIHtcclxuICAgICAgICAgICAgaWYgKHZlcnNpb25zLmxlbmd0aCAhPT0gb3JpZ2luYWxWZXJzaW9ucy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25zU3RyID0gSlNPTi5zdHJpbmdpZnkodmVyc2lvbnMpO1xyXG4gICAgICAgICAgICBjb25zdCBvcmlnaW5hbFZlcnNpb25zU3RyID0gSlNPTi5zdHJpbmdpZnkob3JpZ2luYWxWZXJzaW9ucyk7XHJcbiAgICAgICAgICAgIGNvbnN0IHZhcmlhYmxlc1N0ciA9IEpTT04uc3RyaW5naWZ5KHZhcmlhYmxlc1N0b3JhZ2UpO1xyXG4gICAgICAgICAgICBjb25zdCBvcmlnaW5hbFZhcmlhYmxlc1N0ciA9IEpTT04uc3RyaW5naWZ5KG9yaWdpbmFsVmFyaWFibGVzU3RvcmFnZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdGVkVmVyc2lvbkNoYW5nZWQgPSBzZWxlY3RlZFZlcnNpb25OYW1lICE9PSBvcmlnaW5hbFNlbGVjdGVkVmVyc2lvbk5hbWU7XHJcbiAgICAgICAgICAgIHJldHVybiB2ZXJzaW9uc1N0ciAhPT0gb3JpZ2luYWxWZXJzaW9uc1N0ciB8fCB2YXJpYWJsZXNTdHIgIT09IG9yaWdpbmFsVmFyaWFibGVzU3RyIHx8IHNlbGVjdGVkVmVyc2lvbkNoYW5nZWQ7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0KTRg9C90LrRhtC40Y8g0LTQu9GPINC+0YLQvNC10YLQutC4INC90LDQu9C40YfQuNGPINC40LfQvNC10L3QtdC90LjQuVxyXG4gICAgICAgIG1hcmtWZXJzaW9uc0FzQ2hhbmdlZCgpIHtcclxuICAgICAgICAgICAgaGFzVW5zYXZlZENoYW5nZXMgPSB0cnVlO1xyXG5cclxuICAgICAgICAgICAgLy8g0JXRgdC70Lgg0LDQstGC0L7RgdC10LnQsiDQstC60LvRjtGH0LXQvSDQuCDQvdC1INC40LTQtdGCINC/0YDQvtGG0LXRgdGBINGB0L7RhdGA0LDQvdC10L3QuNGPLCDRgdC+0YXRgNCw0L3Rj9C10Lwg0LjQt9C80LXQvdC10L3QuNGPXHJcbiAgICAgICAgICAgIGNvbnN0IGF1dG9zYXZlQ2hlY2tib3ggPSB0aGlzLiQuYXV0b3NhdmVDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoYXV0b3NhdmVDaGVja2JveCAmJiBhdXRvc2F2ZUNoZWNrYm94LmNoZWNrZWQgJiYgIWlzU2F2aW5nKSB7XHJcbiAgICAgICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQvdC10LHQvtC70YzRiNGD0Y4g0LfQsNC00LXRgNC20LrRgyDQtNC70Y8gZGVib3VuY2Ug0L/RgNC4INCx0YvRgdGC0YDRi9GFINC40LfQvNC10L3QtdC90LjRj9GFXHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaGFzVW5zYXZlZENoYW5nZXMgJiYgIWlzU2F2aW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2F2ZVZlcnNpb25zKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgMzAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGFwcGVuZExvZyhtc2c6IHN0cmluZywgdHlwZT86ICdlcnJvcicgfCAnd2FybicgfCAnc3VjY2VzcycpIHtcclxuICAgICAgICAgICAgLy8gQWRkIG1lc3NhZ2UgdG8gYnVmZmVyXHJcbiAgICAgICAgICAgIG1lc3NhZ2VCdWZmZXIgKz0gbXNnO1xyXG5cclxuICAgICAgICAgICAgLy8gQ2hlY2sgaWYgdGhlcmUgYXJlIGNvbXBsZXRlIG1lc3NhZ2VzIGluIGJ1ZmZlclxyXG4gICAgICAgICAgICBjb25zdCBsaW5lcyA9IG1lc3NhZ2VCdWZmZXIuc3BsaXQoJ1xcbicpO1xyXG5cclxuICAgICAgICAgICAgLy8gUHJvY2VzcyBhbGwgY29tcGxldGUgbGluZXMgKGV4Y2VwdCB0aGUgbGFzdCBvbmUsIHdoaWNoIG1heSBiZSBpbmNvbXBsZXRlKVxyXG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aCAtIDE7IGkrKykge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbGluZSA9IGxpbmVzW2ldLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgIGlmIChsaW5lLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2Nlc3NDb21wbGV0ZU1lc3NhZ2UobGluZSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIEtlZXAgdGhlIGxhc3QgbGluZSBpbiBidWZmZXIgKGl0IG1heSBiZSBpbmNvbXBsZXRlKVxyXG4gICAgICAgICAgICBtZXNzYWdlQnVmZmVyID0gbGluZXNbbGluZXMubGVuZ3RoIC0gMV07XHJcblxyXG4gICAgICAgICAgICAvLyBVc2UgTG9nTWFuYWdlciB0byBkaXNwbGF5IGxvZ3NcclxuICAgICAgICAgICAgbG9nTWFuYWdlci5hcHBlbmRMb2cobXNnLCB0eXBlKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBwcm9jZXNzQ29tcGxldGVNZXNzYWdlKG1zZzogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIC8vIENoZWNrIGlmIHRoZXJlIGFyZSBtZXNzYWdlcyB3aXRoIGZpbGUgc2l6ZVxyXG5cclxuICAgICAgICAgICAgLy8gUGFyc2UgVVJMcyBmcm9tIGxvZ3NcclxuICAgICAgICAgICAgY29uc3QgdXJscyA9IHRoaXMucGFyc2VVcmxzRnJvbUxvZyhtc2cpO1xyXG4gICAgICAgICAgICBpZiAodXJscy5pbmZvVXJsKSByZW1vdGVVcmxzLmluZm9VcmwgPSB1cmxzLmluZm9Vcmw7XHJcbiAgICAgICAgICAgIGlmICh1cmxzLmluZm9RYVVybCkgcmVtb3RlVXJscy5pbmZvUWFVcmwgPSB1cmxzLmluZm9RYVVybDtcclxuXHJcbiAgICAgICAgICAgIC8vIFBhcnNlIHN0cnVjdHVyZWQgU0ZUUCBsb2dzXHJcbiAgICAgICAgICAgIGNvbnN0IHNmdHBVcGRhdGVkID0gcHJvZ3Jlc3NNYW5hZ2VyLnBhcnNlU2Z0cExvZ3MobXNnKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFBhcnNlIG1haW4gYnVpbGQgcHJvZ3Jlc3NcclxuICAgICAgICAgICAgY29uc3QgbWFpbkJ1aWxkVXBkYXRlZCA9IHByb2dyZXNzTWFuYWdlci5wYXJzZU1haW5CdWlsZFByb2dyZXNzKG1zZyk7XHJcblxyXG4gICAgICAgICAgICAvLyBQYXJzZSBTdXBlckhUTUwgYnVpbGQgcHJvZ3Jlc3NcclxuICAgICAgICAgICAgY29uc3Qgc3VwZXJIdG1sVXBkYXRlZCA9IHByb2dyZXNzTWFuYWdlci5wYXJzZVN1cGVySHRtbFByb2dyZXNzKG1zZyk7XHJcblxyXG4gICAgICAgICAgICAvLyBJZiBTdXBlckhUTUwgcHJvZ3Jlc3MgdXBkYXRlZCwgbG9nIGl0XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgY2xlYXJMb2dzKCkge1xyXG4gICAgICAgICAgICBsb2dNYW5hZ2VyLmNsZWFyTG9ncygpO1xyXG4gICAgICAgIH0sXHJcblxyXG5cclxuICAgICAgICAvLyBNZXRob2QgZm9yIHBhcnNpbmcgVVJMcyBmcm9tIGxvZ3NcclxuICAgICAgICBwYXJzZVVybHNGcm9tTG9nKG1zZzogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBsb2dNYW5hZ2VyLnBhcnNlVXJsc0Zyb21Mb2cobXNnKTtcclxuICAgICAgICB9LFxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG5cclxuXHJcblxyXG4gICAgICAgIC8vIFNldHVwIHJlZnJlc2ggYnV0dG9uXHJcbiAgICAgICAgc2V0dXBSZWZyZXNoQnV0dG9uKCkge1xyXG4gICAgICAgICAgICBjb25zdCByZWZyZXNoQnV0dG9uID0gdGhpcy4kLnJlZnJlc2hCdXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChyZWZyZXNoQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICByZWZyZXNoQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5yZWZyZXNoRGF0YSgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG5cclxuICAgICAgICAvLyBDb250aW51ZSBidWlsZCBhZnRlciB3YXJuaW5nXHJcbiAgICAgICAgY29udGludWVCdWlsZCgpIHtcclxuICAgICAgICAgICAgbW9kYWxNYW5hZ2VyLmhpZGVXYXJuaW5nTW9kYWwoKTtcclxuICAgICAgICAgICAgLy8gU3RhcnQgYnVpbGQgZGlyZWN0bHlcclxuICAgICAgICAgICAgdGhpcy5wcm9jZWVkV2l0aEJ1aWxkKCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gQ29udGludWUgYnVpbGQgYWZ0ZXIgU0ZUUCB3YXJuaW5nXHJcbiAgICAgICAgY29udGludWVTZnRwQnVpbGQoKSB7XHJcbiAgICAgICAgICAgIG1vZGFsTWFuYWdlci5oaWRlU2Z0cFdhcm5pbmdNb2RhbCgpO1xyXG4gICAgICAgICAgICAvLyBDb250aW51ZSB3aXRoIGN1cnJlbnQgc2V0dGluZ3MgKHdpdGggU0ZUUCBjbGVhbnVwKVxyXG4gICAgICAgICAgICB0aGlzLnByb2NlZWRXaXRoQnVpbGQoKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBNZXRob2QgZm9yIHVwZGF0aW5nIGRhdGFcclxuICAgICAgICByZWZyZXNoRGF0YSgpIHtcclxuICAgICAgICAgICAgY29uc3QgcmVmcmVzaEJ1dHRvbiA9IHRoaXMuJC5yZWZyZXNoQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoIXJlZnJlc2hCdXR0b24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIC8vIEJsb2NrIGJ1dHRvbiBhbmQgc2hvdyBsb2FkaW5nIGFuaW1hdGlvblxyXG4gICAgICAgICAgICByZWZyZXNoQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgcmVmcmVzaEJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdsb2FkaW5nJyk7XHJcbiAgICAgICAgICAgIHJlZnJlc2hCdXR0b24udGV4dENvbnRlbnQgPSAn4o+zJztcclxuXHJcbiAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCdVcGRhdGluZyBkYXRhLi4uJywgJ3dhcm4nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIENsZWFyIGN1cnJlbnQgZGF0YVxyXG4gICAgICAgICAgICB0aGlzLmNsZWFyQ3VycmVudERhdGEoKTtcclxuXHJcbiAgICAgICAgICAgIC8vIFBlcmZvcm0gZnVsbCByZWluaXRpYWxpemF0aW9uIGFzIGluIHJlYWR5XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gUmVpbml0aWFsaXplIExvZ01hbmFnZXJcclxuICAgICAgICAgICAgICAgIGxvZ01hbmFnZXIgPSBuZXcgTG9nTWFuYWdlcihcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLiQubG9nQ29udGVudCBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLiQubG9nU3VtbWFyeVRleHQgYXMgSFRNTEVsZW1lbnRcclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gUmVpbml0aWFsaXplIFByb2dyZXNzTWFuYWdlclxyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyID0gbmV3IFByb2dyZXNzTWFuYWdlcih7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2tib3ggc2VjdGlvbnMgZm9yIHByb2dyZXNzIGRpc3BsYXlcclxuICAgICAgICAgICAgICAgICAgICBtYWluQnVpbGRTZWN0aW9uOiB0aGlzLiQubWFpbkJ1aWxkU2VjdGlvbiBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICBzdXBlcmh0bWxTZWN0aW9uOiB0aGlzLiQuc3VwZXJodG1sU2VjdGlvbiBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICBzZnRwU2VjdGlvbjogdGhpcy4kLnNmdHBTZWN0aW9uIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIC8vIFByb2dyZXNzIGluZGljYXRvcnMgaW5zaWRlIHNlY3Rpb25zXHJcbiAgICAgICAgICAgICAgICAgICAgbWFpbkJ1aWxkUHJvZ3Jlc3M6IHRoaXMuJC5tYWluQnVpbGRQcm9ncmVzcyBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICBzdXBlcmh0bWxQcm9ncmVzczogdGhpcy4kLnN1cGVyaHRtbFByb2dyZXNzIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIHNmdHBQcm9ncmVzczogdGhpcy4kLnNmdHBQcm9ncmVzcyBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAvLyBUaW1lIGVsZW1lbnRzXHJcbiAgICAgICAgICAgICAgICAgICAgbWFpbkJ1aWxkVGltZTogdGhpcy4kLm1haW5CdWlsZFRpbWUgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgc3VwZXJodG1sVGltZTogdGhpcy4kLnN1cGVyaHRtbFRpbWUgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgc2Z0cFRpbWU6IHRoaXMuJC5zZnRwVGltZSBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAvLyBQcm9ncmVzcyBzdGF0dXNlc1xyXG4gICAgICAgICAgICAgICAgICAgIG1haW5CdWlsZFN0YXR1czogdGhpcy4kLm1haW5CdWlsZFN0YXR1cyBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICBzdXBlcmh0bWxTdGF0dXM6IHRoaXMuJC5zdXBlcmh0bWxTdGF0dXMgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgc2Z0cFN0YXR1czogdGhpcy4kLnNmdHBTdGF0dXMgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgc2Z0cENsZWFuSW5mbzogdGhpcy4kLnNmdHBDbGVhbkluZm8gYXMgSFRNTEVsZW1lbnRcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFNldCBhZGRpdGlvbmFsIHByb2dyZXNzIGJhciBlbGVtZW50c1xyXG4gICAgICAgICAgICAgICAgKHByb2dyZXNzTWFuYWdlciBhcyBhbnkpLnVpRWxlbWVudHMubWFpbkJ1aWxkUHJvZ3Jlc3NGaWxsID0gdGhpcy4kLm1haW5CdWlsZFByb2dyZXNzRmlsbCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgICAgIChwcm9ncmVzc01hbmFnZXIgYXMgYW55KS51aUVsZW1lbnRzLnN1cGVyaHRtbFByb2dyZXNzRmlsbCA9IHRoaXMuJC5zdXBlcmh0bWxQcm9ncmVzc0ZpbGwgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5zZnRwUHJvZ3Jlc3NGaWxsID0gdGhpcy4kLnNmdHBQcm9ncmVzc0ZpbGwgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5tYWluQnVpbGRQZXJjZW50YWdlID0gdGhpcy4kLm1haW5CdWlsZFBlcmNlbnRhZ2UgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5zdXBlcmh0bWxQZXJjZW50YWdlID0gdGhpcy4kLnN1cGVyaHRtbFBlcmNlbnRhZ2UgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5zZnRwUGVyY2VudGFnZSA9IHRoaXMuJC5zZnRwUGVyY2VudGFnZSBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBSZWluaXRpYWxpemUgTW9kYWxNYW5hZ2VyXHJcbiAgICAgICAgICAgICAgICBtb2RhbE1hbmFnZXIgPSBuZXcgTW9kYWxNYW5hZ2VyKFxyXG4gICAgICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ01vZGFsOiB0aGlzLiQud2FybmluZ01vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB3YXJuaW5nQ2FuY2VsOiB0aGlzLiQud2FybmluZ0NhbmNlbCBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgd2FybmluZ0NvbnRpbnVlOiB0aGlzLiQud2FybmluZ0NvbnRpbnVlIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBzZnRwV2FybmluZ01vZGFsOiB0aGlzLiQuc2Z0cFdhcm5pbmdNb2RhbCBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2Z0cFdhcm5pbmdDYW5jZWw6IHRoaXMuJC5zZnRwV2FybmluZ0NhbmNlbCBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgc2Z0cFdhcm5pbmdDb250aW51ZTogdGhpcy4kLnNmdHBXYXJuaW5nQ29udGludWUgYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNmdHBDbGVhbkluZm86IHRoaXMuJC5zZnRwQ2xlYW5JbmZvIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc01vZGFsOiB0aGlzLiQudW5zYXZlZENoYW5nZXNNb2RhbCBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdW5zYXZlZENoYW5nZXNDYW5jZWw6IHRoaXMuJC51bnNhdmVkQ2hhbmdlc0NhbmNlbCBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdW5zYXZlZENoYW5nZXNEaXNjYXJkOiB0aGlzLiQudW5zYXZlZENoYW5nZXNEaXNjYXJkIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDb21wbGV0ZWRNb2RhbDogdGhpcy4kLnVwZGF0ZUNvbXBsZXRlZE1vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1cGRhdGVDb21wbGV0ZWRPazogdGhpcy4kLnVwZGF0ZUNvbXBsZXRlZE9rIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpbmZvU2VjdGlvbjogdGhpcy4kLmluZm9TZWN0aW9uIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0b2dnbGVJbmZvQnV0dG9uOiB0aGlzLiQudG9nZ2xlSW5mb0J1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY2xvc2VJbmZvQnV0dG9uOiB0aGlzLiQuY2xvc2VJbmZvQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoc1NlY3Rpb246IHRoaXMuJC5wYXRoc1NlY3Rpb24gYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZVBhdGhzQnV0dG9uOiB0aGlzLiQudG9nZ2xlUGF0aHNCdXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsb3NlUGF0aHNCdXR0b246IHRoaXMuJC5jbG9zZVBhdGhzQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdmFsaWRhdG9yU2VjdGlvbjogdGhpcy4kLnZhbGlkYXRvclNlY3Rpb24gYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB0b2dnbGVWYWxpZGF0b3JCdXR0b246IHRoaXMuJC50b2dnbGVWYWxpZGF0b3JCdXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICBjbG9zZVZhbGlkYXRvckJ1dHRvbjogdGhpcy4kLmNsb3NlVmFsaWRhdG9yQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsOiB0aGlzLiQudW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdW5zYXZlZFNjZW5lQ2FuY2VsOiB0aGlzLiQudW5zYXZlZFNjZW5lQ2FuY2VsIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdW5zYXZlZFNjZW5lU2F2ZTogdGhpcy4kLnVuc2F2ZWRTY2VuZVNhdmUgYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB1bnNhdmVkU2NlbmVDb250aW51ZTogdGhpcy4kLnVuc2F2ZWRTY2VuZUNvbnRpbnVlIGFzIEhUTUxCdXR0b25FbGVtZW50XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbldhcm5pbmdDb250aW51ZTogKCkgPT4gdGhpcy5jb250aW51ZUJ1aWxkKCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uU2Z0cFdhcm5pbmdDb250aW51ZTogKCkgPT4gdGhpcy5jb250aW51ZVNmdHBCdWlsZCgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblVuc2F2ZWRDaGFuZ2VzRGlzY2FyZDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC+0YHRgtC+INGB0LrRgNGL0LLQsNC10Lwg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+LCDQt9Cw0LrRgNGL0YLQuNC1IGluZm8tc2VjdGlvbiDQv9GA0L7QuNC30L7QudC00LXRgiDQsNCy0YLQvtC80LDRgtC40YfQtdGB0LrQuFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblVuc2F2ZWRTY2VuZUNhbmNlbDogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J7RgtC80LXQvdGP0LXQvCDQt9Cw0L/Rg9GB0Log0LHQuNC70LTQsFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblVuc2F2ZWRTY2VuZVNhdmU6IGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDRgdGG0LXQvdGDINC4INC/0YDQvtC00L7Qu9C20LDQtdC8INCx0LjQu9C0XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBzYXZlZCA9IGF3YWl0IHRoaXMuc2F2ZVNjZW5lKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnByb2NlZWRXaXRoQnVpbGRDaGVjaygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNoZWNrVW5zYXZlZENoYW5nZXM6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCDQvdCw0LvQuNGH0LjQtSDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40LlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGF1dG9zYXZlQ2hlY2tib3ggPSB0aGlzLiQuYXV0b3NhdmVDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNBdXRvc2F2ZUVuYWJsZWQgPSBhdXRvc2F2ZUNoZWNrYm94ICYmIGF1dG9zYXZlQ2hlY2tib3guY2hlY2tlZDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQldGB0LvQuCDQsNCy0YLQvtGB0LXQudCyINCy0LrQu9GO0YfQtdC9LCDQvdC1INC/0L7QutCw0LfRi9Cy0LDQtdC8INC80L7QtNCw0LvRjNC90L7QtSDQvtC60L3QvlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGlzQXV0b3NhdmVFbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCDQvdCw0LvQuNGH0LjQtSDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvRhSDQuNC30LzQtdC90LXQvdC40LlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBoYXNVbnNhdmVkQ2hhbmdlcyAmJiB0aGlzLmhhc1ZlcnNpb25zQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblZhbGlkYXRvck9wZW46ICgpID0+IHRoaXMucnVuVmFsaWRhdGlvbigpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvblBhdGhzT3BlbjogKCkgPT4gdGhpcy5yZWZyZXNoRGF0YSgpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkluZm9PcGVuOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQl9Cw0LPRgNGD0LbQsNC10Lwg0YHQstC10LbRg9GOINC40L3RhNC+0YDQvNCw0YbQuNGOINC/0L4g0YLRgNC10LHQvtCy0LDQvdC40Y4g0L/QtdGA0LXQvNC10L3QvdGL0YUg0LjQtyDRgtCw0LnRgtC7INC60L7QvdGE0LjQs9CwINC/0YDQuCDQvtGC0LrRgNGL0YLQuNC4INGA0LXQtNCw0LrRgtC+0YDQsCDQstC10YDRgdC40LlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3RQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZ2V0U3VmZml4QW5kSGFzaChwcm9qZWN0UGF0aCwgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCf0L7RgdC70LUg0LfQsNCz0YDRg9C30LrQuCB0aXRsZUNvbmZpZyDQvtCx0L3QvtCy0LvRj9C10Lwg0YDQtdC00LDQutGC0L7RgCDQstC10YDRgdC40LlcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uRWRpdG9yKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gUmVpbml0aWFsaXplIHZhbGlkYXRvclxyXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvamVjdFJvb3QgPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpO1xyXG4gICAgICAgICAgICAgICAgdmFsaWRhdG9yID0gbmV3IFZhbGlkYXRvcihwcm9qZWN0Um9vdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gTG9hZCB2ZXJzaW9uc1xyXG4gICAgICAgICAgICAgICAgdGhpcy5nZXRWZXJzaW9ucyhwcm9qZWN0Um9vdCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU3RhcnQgdmFsaWRhdGlvblxyXG4gICAgICAgICAgICAgICAgdGhpcy5ydW5WYWxpZGF0aW9uKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSW5pdGlhbGl6ZSBjbGVhbnVwIGNoZWNrYm94ZXMgdmlzaWJpbGl0eVxyXG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVDbGVhckRpc3RWaXNpYmlsaXR5KCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyU2Z0cFZpc2liaWxpdHkoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBmb3IgYnVpbGRlciB1cGRhdGVzXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNoZWNrRm9yQnVpbGRlclVwZGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFJlc3RvcmUgYnV0dG9uIGFmdGVyIHNvbWUgdGltZVxyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVmcmVzaEJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlZnJlc2hCdXR0b24uY2xhc3NMaXN0LnJlbW92ZSgnbG9hZGluZycpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlZnJlc2hCdXR0b24udGV4dENvbnRlbnQgPSAn4oa7JztcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnRGF0YSB1cGRhdGVkJywgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICAgICAgICAgIH0sIDIwMDApO1xyXG4gICAgICAgICAgICB9LCA1MDApO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIENsZWFyIGN1cnJlbnQgZGF0YVxyXG4gICAgICAgIGNsZWFyQ3VycmVudERhdGEoKSB7XHJcbiAgICAgICAgICAgIC8vIENsZWFyIHZlcnNpb25zXHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25zTGlzdCA9IHRoaXMuJC52ZXJzaW9uc0xpc3QgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmICh2ZXJzaW9uc0xpc3QpIHtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25zTGlzdC5pbm5lckhUTUwgPSAnJztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8gQ2xlYXIgcGxheWFibGUgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgY29uc3Qgc3VmZml4RWxlbWVudCA9IHRoaXMuJC5zdWZmaXhFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBoYXNoRWxlbWVudCA9IHRoaXMuJC5oYXNoZWRGb2xkZXJFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBjbGllbnRFbGVtZW50ID0gdGhpcy4kLmNsaWVudEVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpdGxlS2V5RWxlbWVudCA9IHRoaXMuJC50aXRsZUtleUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhbmd1YWdlc0VsZW1lbnQgPSB0aGlzLiQubGFuZ3VhZ2VzRWxlbWVudCBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgIGlmIChzdWZmaXhFbGVtZW50KSBzdWZmaXhFbGVtZW50LmlubmVySFRNTCA9ICctJztcclxuICAgICAgICAgICAgaWYgKGhhc2hFbGVtZW50KSBoYXNoRWxlbWVudC5pbm5lckhUTUwgPSAnLSc7XHJcbiAgICAgICAgICAgIGlmIChjbGllbnRFbGVtZW50KSBjbGllbnRFbGVtZW50LmlubmVySFRNTCA9ICctJztcclxuICAgICAgICAgICAgaWYgKHRpdGxlS2V5RWxlbWVudCkgdGl0bGVLZXlFbGVtZW50LmlubmVySFRNTCA9ICctJztcclxuICAgICAgICAgICAgaWYgKGxhbmd1YWdlc0VsZW1lbnQpIGxhbmd1YWdlc0VsZW1lbnQuaW5uZXJIVE1MID0gJy0nO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vINCf0YDQvtCy0LXRgNC60LAg0L3QsNC70LjRh9C40Y8g0L7QsdC90L7QstC70LXQvdC40Y8g0LHQuNC70LTQtdGA0LBcclxuICAgICAgICBjaGVja0ZvckJ1aWxkZXJVcGRhdGUoKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVNYW5hZ2VyID0gbmV3IFVwZGF0ZU1hbmFnZXIocHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlSW5mbyA9IHVwZGF0ZU1hbmFnZXIuY2hlY2tGb3JVcGRhdGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygn0J/RgNC+0LLQtdGA0LrQsCDQvtCx0L3QvtCy0LvQtdC90LjQuSDQsdC40LvQtNC10YDQsDonLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZlcnNpb246IHVwZGF0ZUluZm8uY3VycmVudFZlcnNpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgbGF0ZXN0VmVyc2lvbjogdXBkYXRlSW5mby5sYXRlc3RWZXJzaW9uLFxyXG4gICAgICAgICAgICAgICAgICAgIGhhc1VwZGF0ZTogdXBkYXRlSW5mby5oYXNVcGRhdGVcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh1cGRhdGVJbmZvLmhhc1VwZGF0ZSAmJiB1cGRhdGVJbmZvLmxhdGVzdFZlcnNpb24pIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9C+0LrQsNC30YvQstCw0LXQvCDQutC90L7Qv9C60YMg0L7QsdC90L7QstC70LXQvdC40Y9cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB1cGRhdGVCdXR0b24gPSB0aGlzLiQudXBkYXRlQnVpbGRlckJ1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodXBkYXRlQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLnRpdGxlID0gYFVwZGF0ZSBidWlsZGVyIGZyb20gJHt1cGRhdGVJbmZvLmN1cnJlbnRWZXJzaW9ufSB0byAke3VwZGF0ZUluZm8ubGF0ZXN0VmVyc2lvbn1gO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhg8J+UhCDQlNC+0YHRgtGD0L/QvdC+INC+0LHQvdC+0LLQu9C10L3QuNC1INCx0LjQu9C00LXRgNCwOiAke3VwZGF0ZUluZm8uY3VycmVudFZlcnNpb259IOKGkiAke3VwZGF0ZUluZm8ubGF0ZXN0VmVyc2lvbn1gLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign0JrQvdC+0L/QutCwINC+0LHQvdC+0LLQu9C10L3QuNGPINC90LUg0L3QsNC50LTQtdC90LAg0LIgRE9NJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC60YDRi9Cy0LDQtdC8INC60L3QvtC/0LrRgyDQvtCx0L3QvtCy0LvQtdC90LjRj1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHVwZGF0ZUJ1dHRvbiA9IHRoaXMuJC51cGRhdGVCdWlsZGVyQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh1cGRhdGVCdXR0b24pIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyDQm9C+0LPQuNGA0YPQtdC8LCDQtdGB0LvQuCDQstC10YDRgdC40Lgg0L3QsNC50LTQtdC90YssINC90L4g0L7QsdC90L7QstC70LXQvdC40Y8g0L3QtdGCXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHVwZGF0ZUluZm8uY3VycmVudFZlcnNpb24gJiYgdXBkYXRlSW5mby5sYXRlc3RWZXJzaW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGDQkdC40LvQtNC10YAg0LDQutGC0YPQsNC70LXQvTogJHt1cGRhdGVJbmZvLmN1cnJlbnRWZXJzaW9ufSAo0L/QvtGB0LvQtdC00L3Rj9GPINCy0LXRgNGB0LjRjzogJHt1cGRhdGVJbmZvLmxhdGVzdFZlcnNpb259KWApO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2Fybign0J3QtSDRg9C00LDQu9C+0YHRjCDQvtC/0YDQtdC00LXQu9C40YLRjCDQstC10YDRgdC40Lg6Jywge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudFZlcnNpb246IHVwZGF0ZUluZm8uY3VycmVudFZlcnNpb24sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYXRlc3RWZXJzaW9uOiB1cGRhdGVJbmZvLmxhdGVzdFZlcnNpb25cclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcign0J7RiNC40LHQutCwINC/0YDQuCDQv9GA0L7QstC10YDQutC1INC+0LHQvdC+0LLQu9C10L3QuNC5INCx0LjQu9C00LXRgNCwOicsIGVycm9yKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGDinYwg0J7RiNC40LHQutCwINC/0YDQuCDQv9GA0L7QstC10YDQutC1INC+0LHQvdC+0LLQu9C10L3QuNC5OiAke2Vycm9yfWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0J7QsdC90L7QstC70LXQvdC40LUg0LHQuNC70LTQtdGA0LBcclxuICAgICAgICBhc3luYyB1cGRhdGVCdWlsZGVyKCkge1xyXG4gICAgICAgICAgICBjb25zdCB1cGRhdGVCdXR0b24gPSB0aGlzLiQudXBkYXRlQnVpbGRlckJ1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKCF1cGRhdGVCdXR0b24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIC8vINCR0LvQvtC60LjRgNGD0LXQvCDQutC90L7Qv9C60YMg0Lgg0L/QvtC60LDQt9GL0LLQsNC10Lwg0LjQvdC00LjQutCw0YLQvtGAINC30LDQs9GA0YPQt9C60LhcclxuICAgICAgICAgICAgdXBkYXRlQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgdXBkYXRlQnV0dG9uLnRleHRDb250ZW50ID0gJ+KPsyDQntCx0L3QvtCy0LvQtdC90LjQtS4uLic7XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdXBkYXRlTWFuYWdlciA9IG5ldyBVcGRhdGVNYW5hZ2VyKHByb2plY3RQYXRoKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygn8J+UhCDQndCw0YfQuNC90LDRjiDQvtCx0L3QvtCy0LvQtdC90LjQtSDQsdC40LvQtNC10YDQsC4uLicsICd3YXJuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdXBkYXRlTWFuYWdlci51cGRhdGVCdWlsZGVyKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdWNjZXNzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ+KchSDQkdC40LvQtNC10YAg0YPRgdC/0LXRiNC90L4g0L7QsdC90L7QstC70LXQvSEg0J/QtdGA0LXQt9Cw0L/Rg9GB0YLQuNGC0LUg0L/QsNC90LXQu9GMINC00LvRjyDQv9GA0LjQvNC10L3QtdC90LjRjyDQuNC30LzQtdC90LXQvdC40LkuJywgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICAgICAgICAgICAgICB1cGRhdGVCdXR0b24udGV4dENvbnRlbnQgPSAn4pyFINCe0LHQvdC+0LLQu9C10L3Qvic7XHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLmRpc2FibGVkID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0L/QvtC/LdCw0L8g0L4g0L3QtdC+0LHRhdC+0LTQuNC80L7RgdGC0Lgg0L/QtdGA0LXQvtGC0LrRgNGL0YLRjCDQv9Cw0L3QtdC70YxcclxuICAgICAgICAgICAgICAgICAgICBpZiAobW9kYWxNYW5hZ2VyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1vZGFsTWFuYWdlci5zaG93VXBkYXRlQ29tcGxldGVkTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCh0LrRgNGL0LLQsNC10Lwg0LrQvdC+0L/QutGDINGH0LXRgNC10Lcg0L3QtdC60L7RgtC+0YDQvtC1INCy0YDQtdC80Y9cclxuICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0sIDMwMDApO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhg4p2MINCe0YjQuNCx0LrQsCDQv9GA0Lgg0L7QsdC90L7QstC70LXQvdC40Lgg0LHQuNC70LTQtdGA0LA6ICR7cmVzdWx0LmVycm9yfWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbi50ZXh0Q29udGVudCA9ICfwn5SEIFVwZGF0ZSc7XHJcbiAgICAgICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLmRpc2FibGVkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGDinYwg0J7RiNC40LHQutCwINC/0YDQuCDQvtCx0L3QvtCy0LvQtdC90LjQuCDQsdC40LvQtNC10YDQsDogJHtlcnJvci5tZXNzYWdlIHx8IGVycm9yfWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICAgICAgdXBkYXRlQnV0dG9uLnRleHRDb250ZW50ID0gJ/CflIQgVXBkYXRlJztcclxuICAgICAgICAgICAgICAgIHVwZGF0ZUJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gTWFuYWdlIHZpc2liaWxpdHkgb2YgZGlzdCBmb2xkZXIgY2xlYW51cCBjaGVja2JveFxyXG4gICAgICAgIHRvZ2dsZUNsZWFyRGlzdFZpc2liaWxpdHkoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1cGVyaHRtbENoZWNrYm94ID0gdGhpcy4kLnN1cGVyaHRtbENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGNsZWFyRGlzdExhYmVsID0gdGhpcy4kLmNsZWFyRGlzdExhYmVsIGFzIEhUTUxFbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgaWYgKCFzdXBlcmh0bWxDaGVja2JveCB8fCAhY2xlYXJEaXN0TGFiZWwpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGlmIChzdXBlcmh0bWxDaGVja2JveC5jaGVja2VkKSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhckRpc3RMYWJlbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIGNsZWFyRGlzdExhYmVsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gTWFuYWdlIHZpc2liaWxpdHkgb2YgU0ZUUCBmb2xkZXIgY2xlYW51cCBjaGVja2JveFxyXG4gICAgICAgIHRvZ2dsZUNsZWFyU2Z0cFZpc2liaWxpdHkoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHNmdHBDaGVja2JveCA9IHRoaXMuJC5zZnRwQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgY2xlYXJTZnRwTGFiZWwgPSB0aGlzLiQuY2xlYXJTZnRwTGFiZWwgYXMgSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXNmdHBDaGVja2JveCB8fCAhY2xlYXJTZnRwTGFiZWwpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGlmIChzZnRwQ2hlY2tib3guY2hlY2tlZCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJTZnRwTGFiZWwuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICBjbGVhclNmdHBMYWJlbC5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1hbmFnZSBTRlRQIGNoZWNrYm94IGF2YWlsYWJpbGl0eVxyXG4gICAgICAgIHNldFNmdHBDaGVja2JveEVuYWJsZWQoZW5hYmxlZDogYm9vbGVhbikge1xyXG4gICAgICAgICAgICAvLyBJZiBidWlsZCBpcyBpbiBwcm9ncmVzcywgZG9uJ3QgdW5sb2NrIGNoZWNrYm94ZXNcclxuICAgICAgICAgICAgaWYgKGlzQnVpbGRpbmcpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgY29uc3Qgc2Z0cENoZWNrYm94ID0gdGhpcy4kLnNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBjbGVhclNmdHBDaGVja2JveCA9IHRoaXMuJC5jbGVhclNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBzdXBlcmh0bWxDaGVja2JveCA9IHRoaXMuJC5zdXBlcmh0bWxDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgLy8gQWxsb3cgU0ZUUCBpZiBlaXRoZXIgZm9sZGVyIGV4aXN0cyBvciBTdXBlckhUTUwgYnVpbGQgaXMgZW5hYmxlZFxyXG4gICAgICAgICAgICBjb25zdCBzZnRwQWxsb3dlZCA9IGVuYWJsZWQgfHwgKHN1cGVyaHRtbENoZWNrYm94ICYmIHN1cGVyaHRtbENoZWNrYm94LmNoZWNrZWQpO1xyXG5cclxuICAgICAgICAgICAgaWYgKHNmdHBDaGVja2JveCkge1xyXG4gICAgICAgICAgICAgICAgc2Z0cENoZWNrYm94LmRpc2FibGVkID0gIXNmdHBBbGxvd2VkO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFzZnRwQWxsb3dlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNmdHBDaGVja2JveC5jaGVja2VkID0gZmFsc2U7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIGlmIChjbGVhclNmdHBDaGVja2JveCkge1xyXG4gICAgICAgICAgICAgICAgY2xlYXJTZnRwQ2hlY2tib3guZGlzYWJsZWQgPSAhc2Z0cEFsbG93ZWQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoIXNmdHBBbGxvd2VkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJTZnRwQ2hlY2tib3guY2hlY2tlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyBBbHNvIG1hbmFnZSB2aXNpYmlsaXR5IG9mIFNGVFAgY2xlYW51cCBsYWJlbFxyXG4gICAgICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyU2Z0cFZpc2liaWxpdHkoKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBNYW5hZ2Ugc3RhdGUgb2YgYWxsIGNoZWNrYm94ZXMgKGVuYWJsZS9kaXNhYmxlKVxyXG4gICAgICAgIHNldENoZWNrYm94ZXNFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcclxuICAgICAgICAgICAgY29uc3QgY2hlY2tib3hlcyA9IFtcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5tYWluQnVpbGRDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5zdXBlcmh0bWxDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5jbGVhckRpc3RDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5zZnRwQ2hlY2tib3gsXHJcbiAgICAgICAgICAgICAgICB0aGlzLiQuY2xlYXJTZnRwQ2hlY2tib3hcclxuICAgICAgICAgICAgXSBhcyBIVE1MSW5wdXRFbGVtZW50W107XHJcblxyXG4gICAgICAgICAgICBjaGVja2JveGVzLmZvckVhY2goY2hlY2tib3ggPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrYm94KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgbWFpbiBidWlsZCBjaGVja2JveCBpcyBmb3JjaWJseSBsb2NrZWQsIGRvbid0IHRvdWNoIGl0IHdoZW4gbG9ja2luZ1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjaGVja2JveCA9PT0gdGhpcy4kLm1haW5CdWlsZENoZWNrYm94ICYmIGNoZWNrYm94LmRpc2FibGVkICYmICFlbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjsgLy8gU2tpcCBpZiBpdCdzIGFscmVhZHkgbG9ja2VkIGFuZCB3ZSB3YW50IHRvIGxvY2tcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gSWYgU0ZUUCBjaGVja2JveCBpcyBsb2NrZWQgZHVlIHRvIG1pc3NpbmcgZm9sZGVyLCBkb24ndCB0b3VjaCBpdFxyXG4gICAgICAgICAgICAgICAgICAgIGlmICgoY2hlY2tib3ggPT09IHRoaXMuJC5zZnRwQ2hlY2tib3ggfHwgY2hlY2tib3ggPT09IHRoaXMuJC5jbGVhclNmdHBDaGVja2JveCkgJiYgY2hlY2tib3guZGlzYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyDQn9GA0L7Qv9GD0YHQutCw0LXQvCwg0LXRgdC70LggU0ZUUCDQs9Cw0LvQvtGH0LrQuCDRg9C20LUg0LfQsNCx0LvQvtC60LjRgNC+0LLQsNC90YtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgY2hlY2tib3guZGlzYWJsZWQgPSAhZW5hYmxlZDtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQotCw0LrQttC1INGD0L/RgNCw0LLQu9GP0LXQvCDQstC40LTQuNC80L7RgdGC0YzRjiDQu9C10LnQsdC70L7QsiDQvtGH0LjRgdGC0LrQuFxyXG4gICAgICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyRGlzdFZpc2liaWxpdHkoKTtcclxuICAgICAgICAgICAgdGhpcy50b2dnbGVDbGVhclNmdHBWaXNpYmlsaXR5KCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0YDQsNC30LHQu9C+0LrQuNGA0L7QstCw0YLRjCDQstGB0LUg0LPQsNC70L7Rh9C60LggKNC00LvRjyDQt9Cw0LLQtdGA0YjQtdC90LjRjy/QvtGC0LzQtdC90Ysg0YHQsdC+0YDQutC4KVxyXG4gICAgICAgIGZvcmNlRW5hYmxlQWxsQ2hlY2tib3hlcygpIHtcclxuICAgICAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpO1xyXG4gICAgICAgICAgICBjb25zdCBzZnRwRm9sZGVyRXhpc3RzID0gdGhpcy5jaGVja1NmdHBGb2xkZXJFeGlzdHMocHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCBzdXBlcmh0bWxDaGVja2JveCA9IHRoaXMuJC5zdXBlcmh0bWxDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY2hlY2tib3hlcyA9IFtcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5tYWluQnVpbGRDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5zdXBlcmh0bWxDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5jbGVhckRpc3RDaGVja2JveCxcclxuICAgICAgICAgICAgICAgIHRoaXMuJC5zZnRwQ2hlY2tib3gsXHJcbiAgICAgICAgICAgICAgICB0aGlzLiQuY2xlYXJTZnRwQ2hlY2tib3hcclxuICAgICAgICAgICAgXSBhcyBIVE1MSW5wdXRFbGVtZW50W107XHJcblxyXG4gICAgICAgICAgICBjaGVja2JveGVzLmZvckVhY2goY2hlY2tib3ggPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGNoZWNrYm94KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JXRgdC70Lgg0Y3RgtC+IFNGVFAg0LPQsNC70L7Rh9C60LgsINC/0YDQvtCy0LXRgNGP0LXQvCDQtNC+0YHRgtGD0L/QvdC+0YHRgtGMXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNoZWNrYm94ID09PSB0aGlzLiQuc2Z0cENoZWNrYm94IHx8IGNoZWNrYm94ID09PSB0aGlzLiQuY2xlYXJTZnRwQ2hlY2tib3gpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Z0cEFsbG93ZWQgPSBzZnRwRm9sZGVyRXhpc3RzIHx8IChzdXBlcmh0bWxDaGVja2JveCAmJiBzdXBlcmh0bWxDaGVja2JveC5jaGVja2VkKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzZnRwQWxsb3dlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuOyAvLyDQn9GA0L7Qv9GD0YHQutCw0LXQvCBTRlRQINCz0LDQu9C+0YfQutC4LCDQtdGB0LvQuCDQvtC90Lgg0L3QtdC00L7RgdGC0YPQv9C90YtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICBjaGVja2JveC5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vINCi0LDQutC20LUg0YPQv9GA0LDQstC70Y/QtdC8INCy0LjQtNC40LzQvtGB0YLRjNGOINC70LXQudCx0LvQvtCyINC+0YfQuNGB0YLQutC4XHJcbiAgICAgICAgICAgIHRoaXMudG9nZ2xlQ2xlYXJEaXN0VmlzaWJpbGl0eSgpO1xyXG4gICAgICAgICAgICB0aGlzLnRvZ2dsZUNsZWFyU2Z0cFZpc2liaWxpdHkoKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQntGH0LjRgdGC0LrQsCDQv9Cw0L/QutC4IGRpc3RcclxuICAgICAgICBjbGVhckRpc3RGb2xkZXIocHJvamVjdFBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGRpc3RQYXRoID0gam9pbihwcm9qZWN0UGF0aCwgJ2Rpc3QnKTtcclxuXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgQ2xlYXJpbmcgZGlzdCBmb2xkZXI6ICR7ZGlzdFBhdGh9YCwgJ3dhcm4nKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQmNGB0L/QvtC70YzQt9GD0LXQvCDQutGA0L7RgdGB0L/Qu9Cw0YLRhNC+0YDQvNC10L3QvdGD0Y4g0LrQvtC80LDQvdC00YMg0LTQu9GPINGD0LTQsNC70LXQvdC40Y8g0L/QsNC/0LrQuFxyXG4gICAgICAgICAgICAgICAgY29uc3QgY29tbWFuZCA9IFBsYXRmb3JtVXRpbHMuc3Bhd25Db21tYW5kKFBsYXRmb3JtVXRpbHMuZ2V0UmVtb3ZlRGlyZWN0b3J5Q29tbWFuZChkaXN0UGF0aCksIFtdLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgY3dkOiBwcm9qZWN0UGF0aFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29tbWFuZC5zdGRvdXQub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coZGF0YS50b1N0cmluZygpKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbW1hbmQuc3RkZXJyLm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGRhdGEudG9TdHJpbmcoKSwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLm9uKCdjbG9zZScsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGNvZGUgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ0Rpc3QgZm9sZGVyIHN1Y2Nlc3NmdWxseSBjbGVhcmVkJywgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgRXJyb3IgY2xlYXJpbmcgZGlzdCBmb2xkZXIgKGNvZGUgJHtjb2RlfSlgLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIEdldHRpbmcgY2xlYW4taW5mbyBpbmZvcm1hdGlvbiBmb3IgU0ZUUFxyXG4gICAgICAgIGdldFNmdHBDbGVhbkluZm8ocHJvamVjdFBhdGg6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gUGxhdGZvcm1VdGlscy5ydW5OcG1Db21tYW5kKCdydW4gc2Z0cCAtLSBjbGVhbi1pbmZvJywgcHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3Nlcy5wdXNoKGNvbW1hbmQpO1xyXG5cclxuICAgICAgICAgICAgICAgIGxldCBjbGVhbkluZm8gPSAnJztcclxuICAgICAgICAgICAgICAgIGxldCBlcnJvckluZm8gPSAnJztcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2cgPSBkYXRhLnRvU3RyaW5nKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYW5JbmZvICs9IGxvZztcclxuICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBzdHJ1Y3R1cmVkIGxvZ3MgaW4gcmVhbCB0aW1lXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnBhcnNlU2Z0cExvZ3MobG9nKTtcclxuXHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBlcnJvckxvZyA9IGRhdGEudG9TdHJpbmcoKTtcclxuICAgICAgICAgICAgICAgICAgICBlcnJvckluZm8gKz0gZXJyb3JMb2c7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLm9uKCdjbG9zZScsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3NlcyA9IHJ1bm5pbmdQcm9jZXNzZXMuZmlsdGVyKHAgPT4gcCAhPT0gY29tbWFuZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChjb2RlID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGhhdmUgc3RydWN0dXJlZCBkYXRhLCB1c2UgaXRcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc2Z0cENsZWFuSW5mbyA9IHByb2dyZXNzTWFuYWdlci5nZXRTZnRwQ2xlYW5JbmZvKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc2Z0cENsZWFuSW5mby5pdGVtcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCdTdHJ1Y3R1cmVkIGluZm9ybWF0aW9uIGxvYWRlZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmFsbGJhY2sgdG8gb2xkIHBhcnNpbmdcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxpbmVzID0gY2xlYW5JbmZvLnNwbGl0KCdcXG4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxldCBpbmZvVGV4dCA9ICcnO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgbGluZSBvZiBsaW5lcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRyaW1tZWRMaW5lID0gbGluZS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFNraXAgc2VydmljZSBtZXNzYWdlc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0cmltbWVkTGluZS5pbmNsdWRlcygnQ29uZmlndXJhdGlvbjonKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmltbWVkTGluZS5pbmNsdWRlcygnV2FpdGluZyBmb3IgY29ubmVjdGlvbicpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyaW1tZWRMaW5lLmluY2x1ZGVzKCdTZnRwIGNsaWVudCBjb25uZWN0ZWQnKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmltbWVkTGluZS5pbmNsdWRlcygnVG90YWwgZmlsZXMgdG8gdXBsb2FkJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJpbW1lZExpbmUuaW5jbHVkZXMoJ0dFVCBDTEVBTiBJTkZPJykgfHxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHJpbW1lZExpbmUuaW5jbHVkZXMoJ0luZm9ybWF0aW9uIGNvbGxlY3Rpb24gY29tcGxldGVkJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCBjb2xsZWN0aW5nIGluZm9ybWF0aW9uIGZyb20gdGhlIG1vbWVudCBlbGVtZW50cyBhcmUgZm91bmRcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJpbW1lZExpbmUuaW5jbHVkZXMoJ0ZvdW5kJykgJiYgdHJpbW1lZExpbmUuaW5jbHVkZXMoJ2VsZW1lbnRzJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1RleHQgKz0gdHJpbW1lZExpbmUgKyAnXFxuJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDb2xsZWN0IGluZm9ybWF0aW9uIGFib3V0IGZpbGVzIGFuZCBmb2xkZXJzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRyaW1tZWRMaW5lLmluY2x1ZGVzKCdGT0xERVI6JykgfHwgdHJpbW1lZExpbmUuaW5jbHVkZXMoJ0ZJTEU6JykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1RleHQgKz0gdHJpbW1lZExpbmUgKyAnXFxuJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBDb2xsZWN0IHN0YXRpc3RpY3NcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAodHJpbW1lZExpbmUuaW5jbHVkZXMoJ1NUQVRJU1RJQ1M6JykgfHwgdHJpbW1lZExpbmUuaW5jbHVkZXMoJ1RvdGFsIGVsZW1lbnRzOicpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRyaW1tZWRMaW5lLmluY2x1ZGVzKCdGaWxlczonKSB8fCB0cmltbWVkTGluZS5pbmNsdWRlcygnRm9sZGVyczonKSB8fFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0cmltbWVkTGluZS5pbmNsdWRlcygnVG90YWwgZmlsZSBzaXplOicpIHx8IHRyaW1tZWRMaW5lLmluY2x1ZGVzKCdBTEwgVEhFU0UgRUxFTUVOVFMgV0lMTCBCRSBERUxFVEVEJykpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5mb1RleHQgKz0gdHJpbW1lZExpbmUgKyAnXFxuJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBJZiBmb2xkZXIgZG9lc24ndCBleGlzdCBvciBpcyBlbXB0eVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0cmltbWVkTGluZS5pbmNsdWRlcygnZG9lcyBub3QgZXhpc3QnKSB8fCB0cmltbWVkTGluZS5pbmNsdWRlcygnYWxyZWFkeSBlbXB0eScpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluZm9UZXh0ID0gdHJpbW1lZExpbmU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGluZm9UZXh0IHx8ICdGb2xkZXIgaW5mb3JtYXRpb24gbm90IGZvdW5kJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKGVycm9ySW5mbyB8fCAnRXJyb3IgZ2V0dGluZyBTRlRQIGZvbGRlciBpbmZvcm1hdGlvbicpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuXHJcblxyXG4gICAgICAgIC8vIEF1dG9tYXRpYyBkYXRhIHVwZGF0ZSBhZnRlciBidWlsZCAod2l0aG91dCBibG9ja2luZyBidXR0b24pXHJcbiAgICAgICAgcmVmcmVzaERhdGFBZnRlckJ1aWxkKCkge1xyXG4gICAgICAgICAgICAvLyBDbGVhciBjdXJyZW50IGRhdGFcclxuICAgICAgICAgICAgdGhpcy5jbGVhckN1cnJlbnREYXRhKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBVcGRhdGUgZGF0YVxyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3RQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuZ2V0VmVyc2lvbnMocHJvamVjdFBhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGlmIFNGVFAgZm9sZGVyIGFwcGVhcmVkIGFmdGVyIGJ1aWxkXHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZnRwRm9sZGVyRXhpc3RzID0gdGhpcy5jaGVja1NmdHBGb2xkZXJFeGlzdHMocHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChzZnRwRm9sZGVyRXhpc3RzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuc2V0U2Z0cENoZWNrYm94RW5hYmxlZCh0cnVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ+KchSBEaXN0L3NmdHAgZm9sZGVyIGZvdW5kLiBTRlRQIHVwbG9hZCBpcyBub3cgYXZhaWxhYmxlLicsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSwgMTAwMCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gTG9nIHN1Y2Nlc3NmdWwgdXBkYXRlXHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnRGF0YSBhdXRvbWF0aWNhbGx5IHVwZGF0ZWQgYWZ0ZXIgYnVpbGQnLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICAgICAgfSwgMTUwMCk7XHJcbiAgICAgICAgICAgIH0sIDUwMCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICAvLyB1cGRhdGVTdGF0dXMoc3RhdHVzOiBzdHJpbmcpIHtcclxuICAgICAgICAvLyAgICAgY29uc3QgYnVpbGRTdGF0dXMgPSB0aGlzLiQuYnVpbGRTdGF0dXMgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgLy8gICAgIGlmIChidWlsZFN0YXR1cykgYnVpbGRTdGF0dXMudGV4dENvbnRlbnQgPSBzdGF0dXM7XHJcbiAgICAgICAgLy8gfSxcclxuXHJcbiAgICAgICAgdG9nZ2xlQnVpbGRCdXR0b24oYnVpbGRpbmc6IGJvb2xlYW4pIHtcclxuICAgICAgICAgICAgY29uc3QgYnRuID0gdGhpcy4kLmJ1aWxkQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoIWJ0bikgcmV0dXJuO1xyXG4gICAgICAgICAgICBpc0J1aWxkaW5nID0gYnVpbGRpbmc7XHJcbiAgICAgICAgICAgIGJ0bi50ZXh0Q29udGVudCA9IGJ1aWxkaW5nID8gJ0NhbmNlbCcgOiAnQnVpbGQnO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIEZ1bmN0aW9ucyBmb3IgbWFuYWdpbmcgcHJvZ3Jlc3MgY2hlY2tsaXN0XHJcbiAgICAgICAgc2hvd0J1aWxkUHJvZ3Jlc3MoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhc3RCdWlsZEluZm8gPSB0aGlzLiQubGFzdEJ1aWxkSW5mbyBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgIC8vIFJlc2V0IGFsbCBzZWN0aW9uIHN0YXRlcyB0byBpbml0aWFsIHN0YXRlXHJcbiAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5yZXNldEFsbFNlY3Rpb25zKCk7XHJcblxyXG4gICAgICAgICAgICAvLyBIaWRlIGxhc3QgYnVpbGQgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgaWYgKGxhc3RCdWlsZEluZm8pIHtcclxuICAgICAgICAgICAgICAgIGxhc3RCdWlsZEluZm8uY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBoaWRlQnVpbGRQcm9ncmVzcygpIHtcclxuICAgICAgICAgICAgLy8gUmVzZXQgYWxsIHNlY3Rpb24gc3RhdGVzIHRvIGluaXRpYWwgc3RhdGVcclxuICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnJlc2V0QWxsU2VjdGlvbnMoKTtcclxuICAgICAgICB9LFxyXG5cclxuXHJcblxyXG4gICAgICAgIHNob3dMYXN0QnVpbGRJbmZvKCkge1xyXG4gICAgICAgICAgICBjb25zdCBsYXN0QnVpbGRJbmZvID0gdGhpcy4kLmxhc3RCdWlsZEluZm8gYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxhc3RCdWlsZFN1bW1hcnkgPSB0aGlzLiQubGFzdEJ1aWxkU3VtbWFyeSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRUaW1lRWxlbWVudCA9IHRoaXMuJC5idWlsZFRpbWUgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbXBsZXRlZFRhc2tzRWxlbWVudCA9IHRoaXMuJC5jb21wbGV0ZWRUYXNrcyBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRMaW5rc0VsZW1lbnQgPSB0aGlzLiQuYnVpbGRMaW5rcyBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgYnVpbHRGaWxlc0VsZW1lbnQgPSB0aGlzLiQuYnVpbHRGaWxlcyBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgIGlmICghbGFzdEJ1aWxkSW5mbyB8fCAhbGFzdEJ1aWxkU3VtbWFyeSB8fCAhYnVpbGRUaW1lRWxlbWVudCB8fCAhY29tcGxldGVkVGFza3NFbGVtZW50IHx8ICFidWlsZExpbmtzRWxlbWVudCB8fCAhYnVpbHRGaWxlc0VsZW1lbnQpIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIC8vIENhbGN1bGF0ZSB0b3RhbCBidWlsZCB0aW1lXHJcbiAgICAgICAgICAgIGNvbnN0IGVuZFRpbWUgPSBuZXcgRGF0ZSgpO1xyXG4gICAgICAgICAgICBjb25zdCBidWlsZER1cmF0aW9uID0gTWF0aC5yb3VuZCgoZW5kVGltZS5nZXRUaW1lKCkgLSBidWlsZFN0YXJ0VGltZS5nZXRUaW1lKCkpIC8gMTAwMCk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1pbnV0ZXMgPSBNYXRoLmZsb29yKGJ1aWxkRHVyYXRpb24gLyA2MCk7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlY29uZHMgPSBidWlsZER1cmF0aW9uICUgNjA7XHJcbiAgICAgICAgICAgIGNvbnN0IHRpbWVTdHJpbmcgPSBgJHttaW51dGVzfW0gJHtzZWNvbmRzfXMgKCR7YnVpbGRTdGFydFRpbWUudG9Mb2NhbGVUaW1lU3RyaW5nKCl9IC0gJHtlbmRUaW1lLnRvTG9jYWxlVGltZVN0cmluZygpfSlgO1xyXG5cclxuICAgICAgICAgICAgYnVpbGRUaW1lRWxlbWVudC50ZXh0Q29udGVudCA9IHRpbWVTdHJpbmc7XHJcblxyXG4gICAgICAgICAgICAvLyBDbGVhciBwcmV2aW91cyB0YXNrc1xyXG4gICAgICAgICAgICBjb21wbGV0ZWRUYXNrc0VsZW1lbnQuaW5uZXJIVE1MID0gJyc7XHJcblxyXG4gICAgICAgICAgICAvLyBDcmVhdGUgYSBjb3B5IG9mIGN1cnJlbnQgdGFza3MgdG8gYXZvaWQgZHVwbGljYXRpb24gb24gbXVsdGlwbGUgY2FsbHNcclxuICAgICAgICAgICAgLy8gVXNlIFNldCB0byBlbnN1cmUgdW5pcXVlIHRhc2tzIG9ubHlcclxuICAgICAgICAgICAgY29uc3QgdW5pcXVlVGFza3MgPSBbLi4ubmV3IFNldChjdXJyZW50QnVpbGRUYXNrcyldO1xyXG5cclxuICAgICAgICAgICAgLy8gQWRkIGNvbXBsZXRlZCB0YXNrcyB3aXRoIGV4ZWN1dGlvbiB0aW1lXHJcbiAgICAgICAgICAgIHVuaXF1ZVRhc2tzLmZvckVhY2godGFzayA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0YXNrRWxlbWVudCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgdGFza0VsZW1lbnQuY2xhc3NOYW1lID0gJ2NvbXBsZXRlZC10YXNrJztcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBEZXRlcm1pbmUgZXhlY3V0aW9uIHRpbWUgZm9yIGVhY2ggdGFza1xyXG4gICAgICAgICAgICAgICAgbGV0IHRhc2tUaW1lID0gJyc7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzdGFnZVRpbWluZ3MgPSBwcm9ncmVzc01hbmFnZXIuZ2V0U3RhZ2VUaW1pbmdzKCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodGFzayA9PT0gJ01haW4gQnVpbGQnICYmIHN0YWdlVGltaW5ncy5tYWluQnVpbGQ/LmR1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0YXNrVGltZSA9IGAgLSAke3Byb2dyZXNzTWFuYWdlci5mb3JtYXRTdGFnZVRpbWUoc3RhZ2VUaW1pbmdzLm1haW5CdWlsZC5kdXJhdGlvbil9YDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGFzayA9PT0gJ1N1cGVySFRNTCBCdWlsZCcgJiYgc3RhZ2VUaW1pbmdzLnN1cGVySHRtbEJ1aWxkPy5kdXJhdGlvbiAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGFza1RpbWUgPSBgIC0gJHtwcm9ncmVzc01hbmFnZXIuZm9ybWF0U3RhZ2VUaW1lKHN0YWdlVGltaW5ncy5zdXBlckh0bWxCdWlsZC5kdXJhdGlvbil9YDtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodGFzayA9PT0gJ1NGVFAgVXBsb2FkJyAmJiBzdGFnZVRpbWluZ3Muc2Z0cExvYWQ/LmR1cmF0aW9uICE9PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0YXNrVGltZSA9IGAgLSAke3Byb2dyZXNzTWFuYWdlci5mb3JtYXRTdGFnZVRpbWUoc3RhZ2VUaW1pbmdzLnNmdHBMb2FkLmR1cmF0aW9uKX1gO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHRhc2tFbGVtZW50LnRleHRDb250ZW50ID0gdGFzayArIHRhc2tUaW1lO1xyXG4gICAgICAgICAgICAgICAgY29tcGxldGVkVGFza3NFbGVtZW50LmFwcGVuZENoaWxkKHRhc2tFbGVtZW50KTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyBEaXNwbGF5IG1heGltdW0gcGxheWFibGUgc2l6ZSB3aXRoIHJldHJ5IG1lY2hhbmlzbVxyXG4gICAgICAgICAgICB0aGlzLmRpc3BsYXlGaWxlU2l6ZVdpdGhSZXRyeShidWlsdEZpbGVzRWxlbWVudCwgbGFzdEJ1aWxkU3VtbWFyeSk7XHJcblxyXG4gICAgICAgICAgICAvLyBDbGVhciBwcmV2aW91cyBsaW5rc1xyXG4gICAgICAgICAgICBidWlsZExpbmtzRWxlbWVudC5pbm5lckhUTUwgPSAnJztcclxuXHJcbiAgICAgICAgICAgIC8vIEFkZCBidWlsZCByZXN1bHQgbGlua3NcclxuICAgICAgICAgICAgdGhpcy5hZGRCdWlsZFJlc3VsdExpbmtzKGJ1aWxkTGlua3NFbGVtZW50KTtcclxuXHJcbiAgICAgICAgICAgIC8vIFNob3cgaW5mb3JtYXRpb24gYmxvY2tcclxuICAgICAgICAgICAgbGFzdEJ1aWxkSW5mby5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgbGFzdEJ1aWxkSW5mby5jbGFzc0xpc3QuYWRkKCdmYWRlLWluJyk7XHJcblxyXG4gICAgICAgICAgICAvLyBDbGVhciBmaWxlIGRhdGEgYWZ0ZXIgZGlzcGxheSAoZm9yIG5leHQgYnVpbGQpXHJcbiAgICAgICAgICAgIC8vIERvIHRoaXMgd2l0aCBkZWxheSBzbyB1c2VyIGNhbiBzZWUgdGhlIGluZm9ybWF0aW9uXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmNsZWFyQnVpbHRGaWxlcygpO1xyXG4gICAgICAgICAgICB9LCAxMDAwMCk7IC8vIENsZWFyIGFmdGVyIDEwIHNlY29uZHMgb2YgZGlzcGxheVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE5ldyBtZXRob2QgZm9yIGRpc3BsYXlpbmcgZmlsZSBzaXplIHdpdGggcmV0cmllc1xyXG4gICAgICAgIGRpc3BsYXlGaWxlU2l6ZVdpdGhSZXRyeShidWlsdEZpbGVzRWxlbWVudDogSFRNTEVsZW1lbnQsIGxhc3RCdWlsZFN1bW1hcnk6IEhUTUxFbGVtZW50LCByZXRyeUNvdW50OiBudW1iZXIgPSAwKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1heFJldHJpZXMgPSA1OyAvLyBNYXhpbXVtIDUgYXR0ZW1wdHNcclxuICAgICAgICAgICAgY29uc3QgcmV0cnlEZWxheSA9IDEwMDA7IC8vIDEgc2Vjb25kIGRlbGF5IGJldHdlZW4gYXR0ZW1wdHNcclxuXHJcbiAgICAgICAgICAgIGJ1aWx0RmlsZXNFbGVtZW50LmlubmVySFRNTCA9ICcnO1xyXG4gICAgICAgICAgICBjb25zdCBtYXhGaWxlU2l6ZSA9IHByb2dyZXNzTWFuYWdlci5nZXRNYXhGaWxlU2l6ZSgpO1xyXG5cclxuXHJcbiAgICAgICAgICAgIGlmIChtYXhGaWxlU2l6ZSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2l6ZUVsZW1lbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgIHNpemVFbGVtZW50LmNsYXNzTmFtZSA9ICdidWlsdC1maWxlJztcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiBzaXplIGV4Y2VlZHMgNC41IE1CICg0NTAwIEtCKVxyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNPdmVyc2l6ZWQgPSBtYXhGaWxlU2l6ZS5zaXplS0IgPiA0NTAwO1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2l6ZUNsYXNzID0gaXNPdmVyc2l6ZWQgPyAnYnVpbHQtZmlsZS1vdmVyc2l6ZWQnIDogJyc7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gVXBkYXRlIHNwb2lsZXIgaGVhZGVyIHdpdGggaWNvbiBpZiBzaXplIGV4Y2VlZGVkXHJcbiAgICAgICAgICAgICAgICBpZiAoaXNPdmVyc2l6ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBsYXN0QnVpbGRTdW1tYXJ5LmlubmVySFRNTCA9ICfimqDvuI8gTGFzdCBCdWlsZCc7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFzdEJ1aWxkU3VtbWFyeS5jbGFzc0xpc3QuYWRkKCdvdmVyc2l6ZWQtd2FybmluZycpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBsYXN0QnVpbGRTdW1tYXJ5LnRleHRDb250ZW50ID0gJ0xhc3QgQnVpbGQnO1xyXG4gICAgICAgICAgICAgICAgICAgIGxhc3RCdWlsZFN1bW1hcnkuY2xhc3NMaXN0LnJlbW92ZSgnb3ZlcnNpemVkLXdhcm5pbmcnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBzaXplRWxlbWVudC5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImJ1aWx0LWZpbGUtaW5mb1wiPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnVpbHQtZmlsZS1uYW1lXCI+TWF4aW11bSBwbGF5YWJsZSBzaXplOjwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiYnVpbHQtZmlsZS1kZXRhaWxzICR7c2l6ZUNsYXNzfVwiPiR7bWF4RmlsZVNpemUuc2l6ZUtCfUtCICgke21heEZpbGVTaXplLmZpbGVOYW1lfSk8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgICAgICBidWlsdEZpbGVzRWxlbWVudC5hcHBlbmRDaGlsZChzaXplRWxlbWVudCk7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmV0cnlDb3VudCA8IG1heFJldHJpZXMpIHtcclxuICAgICAgICAgICAgICAgIC8vIElmIHNpemUgbm90IGZvdW5kIGFuZCB0aGVyZSBhcmUgYXR0ZW1wdHMsIHdhaXQgYW5kIHRyeSBhZ2FpblxyXG4gICAgICAgICAgICAgICAgY29uc3QgcmV0cnlFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICByZXRyeUVsZW1lbnQuY2xhc3NOYW1lID0gJ2J1aWx0LWZpbGUnO1xyXG4gICAgICAgICAgICAgICAgcmV0cnlFbGVtZW50LnN0eWxlLmNvbG9yID0gJyM4ODgnO1xyXG4gICAgICAgICAgICAgICAgcmV0cnlFbGVtZW50LnRleHRDb250ZW50ID0gYFdhaXRpbmcgZm9yIHNpemUgZGF0YS4uLiAoYXR0ZW1wdCAke3JldHJ5Q291bnQgKyAxfS8ke21heFJldHJpZXN9KWA7XHJcbiAgICAgICAgICAgICAgICBidWlsdEZpbGVzRWxlbWVudC5hcHBlbmRDaGlsZChyZXRyeUVsZW1lbnQpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFJlc2V0IHNwb2lsZXIgaGVhZGVyXHJcbiAgICAgICAgICAgICAgICBsYXN0QnVpbGRTdW1tYXJ5LnRleHRDb250ZW50ID0gJ0xhc3QgQnVpbGQnO1xyXG4gICAgICAgICAgICAgICAgbGFzdEJ1aWxkU3VtbWFyeS5jbGFzc0xpc3QucmVtb3ZlKCdvdmVyc2l6ZWQtd2FybmluZycpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIFJldHJ5IGFmdGVyIGRlbGF5XHJcbiAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlGaWxlU2l6ZVdpdGhSZXRyeShidWlsdEZpbGVzRWxlbWVudCwgbGFzdEJ1aWxkU3VtbWFyeSwgcmV0cnlDb3VudCArIDEpO1xyXG4gICAgICAgICAgICAgICAgfSwgcmV0cnlEZWxheSk7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBJZiBhbGwgYXR0ZW1wdHMgZXhoYXVzdGVkLCBzaG93IGVycm9yIG1lc3NhZ2VcclxuICAgICAgICAgICAgICAgIGNvbnN0IG5vRmlsZXNFbGVtZW50ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICBub0ZpbGVzRWxlbWVudC5jbGFzc05hbWUgPSAnYnVpbHQtZmlsZSc7XHJcbiAgICAgICAgICAgICAgICBub0ZpbGVzRWxlbWVudC5zdHlsZS5jb2xvciA9ICcjODg4JztcclxuICAgICAgICAgICAgICAgIG5vRmlsZXNFbGVtZW50LnRleHRDb250ZW50ID0gJ0ZhaWxlZCB0byBkZXRlcm1pbmUgZmlsZSBzaXplJztcclxuICAgICAgICAgICAgICAgIGJ1aWx0RmlsZXNFbGVtZW50LmFwcGVuZENoaWxkKG5vRmlsZXNFbGVtZW50KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBSZXNldCBzcG9pbGVyIGhlYWRlclxyXG4gICAgICAgICAgICAgICAgbGFzdEJ1aWxkU3VtbWFyeS50ZXh0Q29udGVudCA9ICdMYXN0IEJ1aWxkJztcclxuICAgICAgICAgICAgICAgIGxhc3RCdWlsZFN1bW1hcnkuY2xhc3NMaXN0LnJlbW92ZSgnb3ZlcnNpemVkLXdhcm5pbmcnKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1ldGhvZCBmb3IgYWRkaW5nIGJ1aWxkIHJlc3VsdCBsaW5rc1xyXG4gICAgICAgIGFkZEJ1aWxkUmVzdWx0TGlua3MoY29udGFpbmVyOiBIVE1MRWxlbWVudCkge1xyXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IG1haW5CdWlsZEVuYWJsZWQgPSAodGhpcy4kLm1haW5CdWlsZENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpLmNoZWNrZWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1cGVySHRtbEVuYWJsZWQgPSAodGhpcy4kLnN1cGVyaHRtbENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpLmNoZWNrZWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxvYWRUb1NmdHAgPSAodGhpcy4kLnNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkO1xyXG5cclxuICAgICAgICAgICAgLy8gTGluayB0byBidWlsZCBmb2xkZXIgKGZvciBtYWluIGJ1aWxkKVxyXG4gICAgICAgICAgICBpZiAobWFpbkJ1aWxkRW5hYmxlZCAmJiBjdXJyZW50QnVpbGRUYXNrcy5pbmNsdWRlcygnTWFpbiBCdWlsZCcpKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBidWlsZEZvbGRlckxpbmsgPSB0aGlzLmNyZWF0ZUJ1aWxkTGluayhcclxuICAgICAgICAgICAgICAgICAgICAn8J+TgSBPcGVuIGJ1aWxkIGZvbGRlcicsXHJcbiAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5vcGVuRm9sZGVyKGpvaW4ocHJvamVjdFBhdGgsICdidWlsZCcpKSxcclxuICAgICAgICAgICAgICAgICAgICAnZm9sZGVyLWxpbmsnXHJcbiAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGJ1aWxkRm9sZGVyTGluayk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIExpbmsgdG8gZGlzdCBmb2xkZXIgKGZvciBTdXBlckhUTUwgYnVpbGQpXHJcbiAgICAgICAgICAgIGlmIChzdXBlckh0bWxFbmFibGVkICYmIGN1cnJlbnRCdWlsZFRhc2tzLmluY2x1ZGVzKCdTdXBlckhUTUwgQnVpbGQnKSkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZGlzdEZvbGRlckxpbmsgPSB0aGlzLmNyZWF0ZUJ1aWxkTGluayhcclxuICAgICAgICAgICAgICAgICAgICAn8J+TgSBPcGVuIGRpc3QgZm9sZGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAoKSA9PiB0aGlzLm9wZW5Gb2xkZXIoam9pbihwcm9qZWN0UGF0aCwgJ2Rpc3QnKSksXHJcbiAgICAgICAgICAgICAgICAgICAgJ2ZvbGRlci1saW5rJ1xyXG4gICAgICAgICAgICAgICAgKTtcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChkaXN0Rm9sZGVyTGluayk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIExpbmtzIHRvIEhUTUwgZmlsZXMgKGFmdGVyIFNGVFAgdXBsb2FkKVxyXG4gICAgICAgICAgICBpZiAobG9hZFRvU2Z0cCAmJiBjdXJyZW50QnVpbGRUYXNrcy5pbmNsdWRlcygnU0ZUUCBVcGxvYWQnKSkge1xyXG4gICAgICAgICAgICAgICAgLy8gTGluayB0byBpbmZvLmh0bWwgKHJlbW90ZSBVUkwpXHJcbiAgICAgICAgICAgICAgICBpZiAocmVtb3RlVXJscy5pbmZvVXJsKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaW5mb0h0bWxMaW5rID0gdGhpcy5jcmVhdGVCdWlsZExpbmsoXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICfwn4yQIE9wZW4gaW5mby5odG1sJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgKCkgPT4gdGhpcy5vcGVuUmVtb3RlVXJsKHJlbW90ZVVybHMuaW5mb1VybCEpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnaHRtbC1saW5rJ1xyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGluZm9IdG1sTGluayk7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gTGluayB0byBpbmZvLXFhLmh0bWwgKHJlbW90ZSBVUkwpXHJcbiAgICAgICAgICAgICAgICBpZiAocmVtb3RlVXJscy5pbmZvUWFVcmwpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBpbmZvUWFIdG1sTGluayA9IHRoaXMuY3JlYXRlQnVpbGRMaW5rKFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAn8J+MkCBPcGVuIGluZm8tcWEuaHRtbCcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICgpID0+IHRoaXMub3BlblJlbW90ZVVybChyZW1vdGVVcmxzLmluZm9RYVVybCEpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnaHRtbC1saW5rJ1xyXG4gICAgICAgICAgICAgICAgICAgICk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGluZm9RYUh0bWxMaW5rKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1ldGhvZCBmb3IgY3JlYXRpbmcgYnVpbGQgcmVzdWx0IGxpbmtcclxuICAgICAgICBjcmVhdGVCdWlsZExpbmsodGV4dDogc3RyaW5nLCBvbkNsaWNrOiAoKSA9PiB2b2lkLCBjbGFzc05hbWU6IHN0cmluZyk6IEhUTUxFbGVtZW50IHtcclxuICAgICAgICAgICAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgICAgICAgICBsaW5rLmNsYXNzTmFtZSA9IGBidWlsZC1saW5rICR7Y2xhc3NOYW1lfWA7XHJcbiAgICAgICAgICAgIGxpbmsudGV4dENvbnRlbnQgPSB0ZXh0O1xyXG4gICAgICAgICAgICBsaW5rLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgb25DbGljayk7XHJcbiAgICAgICAgICAgIHJldHVybiBsaW5rO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1ldGhvZCBmb3Igb3BlbmluZyBmb2xkZXIgaW4gZmlsZSBtYW5hZ2VyXHJcbiAgICAgICAgb3BlbkZvbGRlcihmb2xkZXJQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHsgc3Bhd24gfSA9IHJlcXVpcmUoJ2NoaWxkX3Byb2Nlc3MnKTtcclxuICAgICAgICAgICAgICAgIC8vIE9wZW4gZm9sZGVyIGluIFdpbmRvd3MgRXhwbG9yZXJcclxuICAgICAgICAgICAgICAgIHNwYXduKCdleHBsb3JlcicsIFtmb2xkZXJQYXRoXSwgeyBzaGVsbDogdHJ1ZSB9KTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBGb2xkZXIgb3BlbmVkOiAke2ZvbGRlclBhdGh9YCwgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBFcnJvciBvcGVuaW5nIGZvbGRlcjogJHtlcnJvcn1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1ldGhvZCBmb3Igb3BlbmluZyBIVE1MIGZpbGUgaW4gYnJvd3NlclxyXG4gICAgICAgIG9wZW5IdG1sRmlsZShmaWxlUGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBQbGF0Zm9ybVV0aWxzLm9wZW5GaWxlKGZpbGVQYXRoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBGaWxlIG9wZW5lZDogJHtmaWxlUGF0aH1gLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIG9wZW5pbmcgZmlsZTogJHtlcnJvcn1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIE1ldGhvZCBmb3Igb3BlbmluZyByZW1vdGUgVVJMIGluIGJyb3dzZXJcclxuICAgICAgICBvcGVuUmVtb3RlVXJsKHVybDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBQbGF0Zm9ybVV0aWxzLm9wZW5VcmwodXJsKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBVUkwgb3BlbmVkOiAke3VybH1gLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIG9wZW5pbmcgVVJMOiAke2Vycm9yfWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gTWV0aG9kIGZvciBvcGVuaW5nIHZlcnNpb25zLmNqcyBmaWxlXHJcbiAgICAgICAgb3BlblZlcnNpb25GaWxlKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkZpbGVQYXRoID0gam9pbihwcm9qZWN0UGF0aCwgJ3ZlcnNpb25zLmNqcycpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENoZWNrIGZpbGUgZXhpc3RlbmNlXHJcbiAgICAgICAgICAgICAgICBpZiAoIWV4aXN0c1N5bmModmVyc2lvbkZpbGVQYXRoKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGB2ZXJzaW9ucy5janMgZmlsZSBub3QgZm91bmQ6ICR7dmVyc2lvbkZpbGVQYXRofWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICBQbGF0Zm9ybVV0aWxzLm9wZW5GaWxlKHZlcnNpb25GaWxlUGF0aCk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgdmVyc2lvbnMuY2pzIGZpbGUgb3BlbmVkOiAke3ZlcnNpb25GaWxlUGF0aH1gLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIG9wZW5pbmcgdmVyc2lvbnMuY2pzIGZpbGU6ICR7ZXJyb3J9YCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBNZXRob2QgZm9yIHVwZGF0aW5nIGRhdGEgZnJvbSB2ZXJzaW9ucy5janMgZmlsZVxyXG4gICAgICAgIHJlZnJlc2hWZXJzaW9uRmlsZSgpIHtcclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3RQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb25GaWxlUGF0aCA9IGpvaW4ocHJvamVjdFBhdGgsICd2ZXJzaW9ucy5janMnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBmaWxlIGV4aXN0ZW5jZVxyXG4gICAgICAgICAgICAgICAgaWYgKCFleGlzdHNTeW5jKHZlcnNpb25GaWxlUGF0aCkpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgdmVyc2lvbnMuY2pzIGZpbGUgbm90IGZvdW5kOiAke3ZlcnNpb25GaWxlUGF0aH1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1VwZGF0aW5nIGRhdGEgZnJvbSB2ZXJzaW9ucy5janMgZmlsZS4uLicsICd3YXJuJyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgRmlsZSBwYXRoOiAke3ZlcnNpb25GaWxlUGF0aH1gLCAnd2FybicpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vIENsZWFyIHJlcXVpcmUgY2FjaGUgZm9yIHRoaXMgZmlsZVxyXG4gICAgICAgICAgICAgICAgZGVsZXRlIHJlcXVpcmUuY2FjaGVbcmVxdWlyZS5yZXNvbHZlKHZlcnNpb25GaWxlUGF0aCldO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1JlcXVpcmUgY2FjaGUgY2xlYXJlZCcsICd3YXJuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ2xlYXIgY3VycmVudCBkYXRhXHJcbiAgICAgICAgICAgICAgICB0aGlzLmNsZWFyQ3VycmVudERhdGEoKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCdDdXJyZW50IGRhdGEgY2xlYXJlZCcsICd3YXJuJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gUmVsb2FkIHZlcnNpb25zXHJcbiAgICAgICAgICAgICAgICB0aGlzLmdldFZlcnNpb25zKHByb2plY3RQYXRoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C1INCy0LXRgNGB0LjQuCDQuCDRhdGA0LDQvdC40LvQuNGJ0LUg0L/QtdGA0LXQvNC10L3QvdGL0YUsINGB0LHRgNCw0YHRi9Cy0LDQtdC8INGE0LvQsNCzINC40LfQvNC10L3QtdC90LjQuVxyXG4gICAgICAgICAgICAgICAgLy8gKGdldFZlcnNpb25zINGD0LbQtSDQt9Cw0LPRgNGD0LbQsNC10YIg0Lgg0L7QsdC90L7QstC70Y/QtdGCIG9yaWdpbmFsVmVyc2lvbnMg0Lggb3JpZ2luYWxWYXJpYWJsZXNTdG9yYWdlKVxyXG4gICAgICAgICAgICAgICAgaGFzVW5zYXZlZENoYW5nZXMgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBSZWZyZXNoIHZlcnNpb24gZWRpdG9yXHJcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uRWRpdG9yKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ0RhdGEgZnJvbSB2ZXJzaW9ucy5janMgZmlsZSBzdWNjZXNzZnVsbHkgdXBkYXRlZCcsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgRXJyb3IgdXBkYXRpbmcgdmVyc2lvbnMuY2pzIGZpbGU6ICR7ZXJyb3J9YCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBJbml0aWFsaXplIHRvb2x0aXAgc3lzdGVtXHJcbiAgICAgICAgaW5pdGlhbGl6ZVRvb2x0aXBzKCkge1xyXG4gICAgICAgICAgICAvLyBBZGQgaGFuZGxlcnMgZm9yIGFsbCBlbGVtZW50cyB3aXRoIHRvb2x0aXBzXHJcbiAgICAgICAgICAgIGNvbnN0IGVsZW1lbnRzV2l0aFRvb2x0aXBzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnW3RpdGxlXScpO1xyXG5cclxuICAgICAgICAgICAgZWxlbWVudHNXaXRoVG9vbHRpcHMuZm9yRWFjaChlbGVtZW50ID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIFJlbW92ZSBzdGFuZGFyZCB0aXRsZSB0byBhdm9pZCBkdXBsaWNhdGlvblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3JpZ2luYWxUaXRsZSA9IGVsZW1lbnQuZ2V0QXR0cmlidXRlKCd0aXRsZScpO1xyXG4gICAgICAgICAgICAgICAgaWYgKG9yaWdpbmFsVGl0bGUpIHtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnJlbW92ZUF0dHJpYnV0ZSgndGl0bGUnKTtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZSgnZGF0YS10b29sdGlwJywgb3JpZ2luYWxUaXRsZSk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEFkZCBldmVudCBoYW5kbGVyc1xyXG4gICAgICAgICAgICAgICAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignbW91c2VlbnRlcicsIHRoaXMuc2hvd1Rvb2x0aXAuYmluZCh0aGlzKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdtb3VzZWxlYXZlJywgdGhpcy5oaWRlVG9vbHRpcC5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2ZvY3VzJywgdGhpcy5zaG93VG9vbHRpcC5iaW5kKHRoaXMpKTtcclxuICAgICAgICAgICAgICAgICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCB0aGlzLmhpZGVUb29sdGlwLmJpbmQodGhpcykpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyBTaG93IHRvb2x0aXBcclxuICAgICAgICBzaG93VG9vbHRpcChldmVudDogRXZlbnQpIHtcclxuICAgICAgICAgICAgY29uc3QgZWxlbWVudCA9IGV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgdG9vbHRpcFRleHQgPSBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS10b29sdGlwJyk7XHJcblxyXG4gICAgICAgICAgICBpZiAoIXRvb2x0aXBUZXh0KSByZXR1cm47XHJcblxyXG4gICAgICAgICAgICAvLyBDcmVhdGUgdG9vbHRpcCBlbGVtZW50IGlmIGl0IGRvZXNuJ3QgZXhpc3RcclxuICAgICAgICAgICAgbGV0IHRvb2x0aXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3VzdG9tLXRvb2x0aXAnKTtcclxuICAgICAgICAgICAgaWYgKCF0b29sdGlwKSB7XHJcbiAgICAgICAgICAgICAgICB0b29sdGlwID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICB0b29sdGlwLmlkID0gJ2N1c3RvbS10b29sdGlwJztcclxuICAgICAgICAgICAgICAgIHRvb2x0aXAuY2xhc3NOYW1lID0gJ2N1c3RvbS10b29sdGlwJztcclxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vIFNldCB0ZXh0IGFuZCBwb3NpdGlvblxyXG4gICAgICAgICAgICB0b29sdGlwLnRleHRDb250ZW50ID0gdG9vbHRpcFRleHQ7XHJcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUuZGlzcGxheSA9ICdibG9jayc7XHJcblxyXG4gICAgICAgICAgICAvLyBQb3NpdGlvbiB0b29sdGlwXHJcbiAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBlbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgICAgICBjb25zdCB0b29sdGlwUmVjdCA9IHRvb2x0aXAuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblxyXG4gICAgICAgICAgICBsZXQgbGVmdCA9IHJlY3QubGVmdCArIChyZWN0LndpZHRoIC8gMikgLSAodG9vbHRpcFJlY3Qud2lkdGggLyAyKTtcclxuICAgICAgICAgICAgbGV0IHRvcCA9IHJlY3QudG9wIC0gdG9vbHRpcFJlY3QuaGVpZ2h0IC0gODtcclxuXHJcbiAgICAgICAgICAgIC8vIENoZWNrIHNjcmVlbiBib3VuZGFyaWVzXHJcbiAgICAgICAgICAgIGlmIChsZWZ0IDwgOCkgbGVmdCA9IDg7XHJcbiAgICAgICAgICAgIGlmIChsZWZ0ICsgdG9vbHRpcFJlY3Qud2lkdGggPiB3aW5kb3cuaW5uZXJXaWR0aCAtIDgpIHtcclxuICAgICAgICAgICAgICAgIGxlZnQgPSB3aW5kb3cuaW5uZXJXaWR0aCAtIHRvb2x0aXBSZWN0LndpZHRoIC0gODtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodG9wIDwgOCkge1xyXG4gICAgICAgICAgICAgICAgdG9wID0gcmVjdC5ib3R0b20gKyA4OyAvLyBTaG93IGJlbG93IGlmIGRvZXNuJ3QgZml0IGFib3ZlXHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHRvb2x0aXAuc3R5bGUubGVmdCA9IGxlZnQgKyAncHgnO1xyXG4gICAgICAgICAgICB0b29sdGlwLnN0eWxlLnRvcCA9IHRvcCArICdweCc7XHJcblxyXG4gICAgICAgICAgICAvLyBBZGQgY2xhc3MgZm9yIGFuaW1hdGlvblxyXG4gICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRvb2x0aXAuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xyXG4gICAgICAgICAgICB9LCAxMCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gSGlkZSB0b29sdGlwXHJcbiAgICAgICAgaGlkZVRvb2x0aXAoZXZlbnQ6IEV2ZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHRvb2x0aXAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY3VzdG9tLXRvb2x0aXAnKTtcclxuICAgICAgICAgICAgaWYgKHRvb2x0aXApIHtcclxuICAgICAgICAgICAgICAgIHRvb2x0aXAuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xyXG4gICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdG9vbHRpcC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xyXG4gICAgICAgICAgICAgICAgfSwgMjAwKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGNhbmNlbEJ1aWxkKCkge1xyXG4gICAgICAgICAgICBpc0J1aWxkaW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvYyBvZiBydW5uaW5nUHJvY2Vzc2VzKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocHJvYy5waWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQmtGA0L7RgdGB0L/Qu9Cw0YLRhNC+0YDQvNC10L3QvdC+0LUg0LfQsNCy0LXRgNGI0LXQvdC40LUg0L/RgNC+0YbQtdGB0YHQsFxyXG4gICAgICAgICAgICAgICAgICAgIGlmIChQbGF0Zm9ybVV0aWxzLmlzV2luZG93cygpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHNwYXduKCd0YXNra2lsbCcsIFsnL1BJRCcsIHByb2MucGlkLnRvU3RyaW5nKCksICcvRicsICcvVCddKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBtYWNPUyDQuCBMaW51eFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9jZXNzLmtpbGwocHJvYy5waWQsICdTSUdURVJNJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMgPSBbXTtcclxuICAgICAgICAgICAgdGhpcy50b2dnbGVCdWlsZEJ1dHRvbihmYWxzZSk7XHJcbiAgICAgICAgICAgIC8vIHRoaXMudXBkYXRlU3RhdHVzKCdDYW5jZWxsZWQnKTtcclxuICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ0FsbCBwcm9jZXNzZXMgY2FuY2VsbGVkJywgJ3dhcm4nKTtcclxuXHJcbiAgICAgICAgICAgIC8vIEZpcnN0IHJlc2V0IGFsbCBwcm9ncmVzcyBzdGF0ZXMgYW5kIGFuaW1hdGlvbnNcclxuICAgICAgICAgICAgdGhpcy5oaWRlQnVpbGRQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgLy8gVGhlbiB3aXRoIGRlbGF5IHVubG9jayBjaGVja2JveGVzXHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8gRm9yY2UgZW5hYmxlIGFsbCBjaGVja2JveGVzIGJhY2tcclxuICAgICAgICAgICAgICAgIHRoaXMuZm9yY2VFbmFibGVBbGxDaGVja2JveGVzKCk7XHJcbiAgICAgICAgICAgIH0sIDUwMCk7XHJcblxyXG4gICAgICAgICAgICAvLyBDbGVhciBhbGwgdGltZSBpbnRlcnZhbHNcclxuICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmNsZWFyQWxsUHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzKCk7XHJcbiAgICAgICAgfSxcclxuICAgICAgICBydW5TdXBlckh0bWxCdWlsZChwcm9qZWN0UGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc0J1aWxkaW5nKSB7IHJlc29sdmUoKTsgcmV0dXJuOyB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gQ2hlY2sgaWYgd2UgbmVlZCB0byBjbGVhciBkaXN0IGZvbGRlclxyXG4gICAgICAgICAgICAgICAgY29uc3QgY2xlYXJEaXN0RW5hYmxlZCA9ICh0aGlzLiQuY2xlYXJEaXN0Q2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZDtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBydW5CdWlsZCA9ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBTaG93IHByb2dyZXNzIGJhciBmb3IgU3VwZXJIVE1MIGJ1aWxkXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnNob3dTZWN0aW9uUHJvZ3Jlc3MoJ3N1cGVySHRtbCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBJbml0aWFsaXplIFN1cGVySFRNTCBwcm9ncmVzc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHN1cGVySHRtbFByb2dyZXNzID0gcHJvZ3Jlc3NNYW5hZ2VyLmdldFN1cGVySHRtbFByb2dyZXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwZXJIdG1sUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgc3VwZXJIdG1sUHJvZ3Jlc3MuY3VycmVudFRhc2sgPSAnU3RhcnRpbmcuLi4nO1xyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci51cGRhdGVTdXBlckh0bWxQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgcHJvZ3Jlc3MgdGhyb3VnaCBQcm9ncmVzc01hbmFnZXJcclxuICAgICAgICAgICAgICAgICAgICAvLyB0aGlzLnVwZGF0ZVN0YXR1cygnQnVpbGRpbmcgU3VwZXJIVE1MLi4uJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1N0YXJ0aW5nIFN1cGVySFRNTCBidWlsZC4uLicpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBTdGFydCB0aW1lIHRyYWNraW5nXHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnN0YXJ0U3RhZ2VUaW1pbmcoJ3N1cGVySHRtbEJ1aWxkJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBQbGF0Zm9ybVV0aWxzLnJ1bk5wbUNvbW1hbmQoJ3J1biBidWlsZCcsIHByb2plY3RQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICBydW5uaW5nUHJvY2Vzc2VzLnB1c2goY29tbWFuZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGNvbW1hbmQuc3Rkb3V0Lm9uKCdkYXRhJywgKGRhdGE6IEJ1ZmZlcikgPT4gdGhpcy5hcHBlbmRMb2coZGF0YS50b1N0cmluZygpKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZC5zdGRlcnIub24oJ2RhdGEnLCAoZGF0YTogQnVmZmVyKSA9PiB0aGlzLmFwcGVuZExvZyhkYXRhLnRvU3RyaW5nKCksICdlcnJvcicpKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29tbWFuZC5vbignY2xvc2UnLCAoY29kZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBydW5uaW5nUHJvY2Vzc2VzID0gcnVubmluZ1Byb2Nlc3Nlcy5maWx0ZXIocCA9PiBwICE9PSBjb21tYW5kKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICghaXNCdWlsZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1N1cGVySFRNTCBidWlsZCB3YXMgY2FuY2VsbGVkJywgJ3dhcm4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvZGUgPT09IDApIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIEZvcmNlIGNvbXBsZXRlIFN1cGVySFRNTCBidWlsZCBwcm9ncmVzc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmZvcmNlQ29tcGxldGVTdXBlckh0bWxCdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudEJ1aWxkVGFza3MucHVzaCgnU3VwZXJIVE1MIEJ1aWxkJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgU3VwZXJIVE1MIGJ1aWxkIGNvbXBsZXRlZCBzdWNjZXNzZnVsbHlgLCAnc3VjY2VzcycpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBkYXRhIGFmdGVyIHN1Y2Nlc3NmdWwgU3VwZXJIVE1MIGJ1aWxkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnVXBkYXRpbmcgZGF0YSBhZnRlciBTdXBlckhUTUwgYnVpbGQuLi4nLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5yZWZyZXNoRGF0YUFmdGVyQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBTdXBlckhUTUwgYnVpbGQgY29tcGxldGVkIHdpdGggZXJyb3IgKGNvZGUgJHtjb2RlfSlgLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRW5kIHRpbWUgdHJhY2tpbmdcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmVuZFN0YWdlVGltaW5nKCdzdXBlckh0bWxCdWlsZCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyBJZiB3ZSBuZWVkIHRvIGNsZWFyIGRpc3QgZm9sZGVyLCBkbyBpdCBiZWZvcmUgYnVpbGRcclxuICAgICAgICAgICAgICAgIGlmIChjbGVhckRpc3RFbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5jbGVhckRpc3RGb2xkZXIocHJvamVjdFBhdGgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoaXNCdWlsZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcnVuQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBydW5CdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG4gICAgICAgIHJ1blNGVFBMb2FkKHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWlzQnVpbGRpbmcpIHsgcmVzb2x2ZSgpOyByZXR1cm47IH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIGNsZWFyIFNGVFAgZm9sZGVyXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjbGVhclNmdHBFbmFibGVkID0gKHRoaXMuJC5jbGVhclNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHJ1blNmdHBMb2FkID0gKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFNob3cgcHJvZ3Jlc3MgYmFyIGZvciBTRlRQXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1Nob3dpbmcgU0ZUUCBwcm9ncmVzcyBiYXIuLi4nLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5zaG93U2VjdGlvblByb2dyZXNzKCdzZnRwJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIEluaXRpYWxpemUgU0ZUUCBwcm9ncmVzc1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNmdHBQcm9ncmVzcyA9IHByb2dyZXNzTWFuYWdlci5nZXRTZnRwUHJvZ3Jlc3MoKTtcclxuICAgICAgICAgICAgICAgICAgICBzZnRwUHJvZ3Jlc3MucGVyY2VudGFnZSA9IDA7XHJcbiAgICAgICAgICAgICAgICAgICAgc2Z0cFByb2dyZXNzLmN1cnJlbnQgPSAwO1xyXG4gICAgICAgICAgICAgICAgICAgIHNmdHBQcm9ncmVzcy50b3RhbCA9IDE7IC8vIFNldCAxIHRvIHNob3cgdGFzayBoYXMgc3RhcnRlZFxyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci51cGRhdGVTZnRwUHJvZ3Jlc3MoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gVXBkYXRlIHByb2dyZXNzIHRocm91Z2ggUHJvZ3Jlc3NNYW5hZ2VyXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gdGhpcy51cGRhdGVTdGF0dXMoJ1VwbG9hZGluZyB0byBzZXJ2ZXIuLi4nKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnU3RhcnRpbmcgU0ZUUCB1cGxvYWQuLi4nKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gU3RhcnQgdGltZSB0cmFja2luZ1xyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5zdGFydFN0YWdlVGltaW5nKCdzZnRwTG9hZCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBGb3JtIGNvbW1hbmQgZGVwZW5kaW5nIG9uIG5lZWQgZm9yIGNsZWFudXBcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBzZnRwQ29tbWFuZCA9IGNsZWFyU2Z0cEVuYWJsZWQgPyAncnVuIHNmdHAgY2xlYW4nIDogJ3J1biBzZnRwJztcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gUGxhdGZvcm1VdGlscy5ydW5OcG1Db21tYW5kKHNmdHBDb21tYW5kLCBwcm9qZWN0UGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3Nlcy5wdXNoKGNvbW1hbmQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbG9nID0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhsb2cpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBQYXJzZSBzdHJ1Y3R1cmVkIFNGVFAgbG9ncyBpbiByZWFsIHRpbWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnBhcnNlU2Z0cExvZ3MobG9nKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHRoaXMuYXBwZW5kTG9nKGRhdGEudG9TdHJpbmcoKSwgJ2Vycm9yJykpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb21tYW5kLm9uKCdjbG9zZScsIChjb2RlOiBudW1iZXIgfCBudWxsKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMgPSBydW5uaW5nUHJvY2Vzc2VzLmZpbHRlcihwID0+IHAgIT09IGNvbW1hbmQpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0J1aWxkaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnU0ZUUCB1cGxvYWQgd2FzIGNhbmNlbGxlZCcsICd3YXJuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChjb2RlID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBGb3JjZSBjb21wbGV0ZSBTRlRQIHByb2dyZXNzXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIuZm9yY2VDb21wbGV0ZVNmdHBQcm9ncmVzcygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudEJ1aWxkVGFza3MucHVzaCgnU0ZUUCBVcGxvYWQnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBTRlRQIHVwbG9hZCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5YCwgJ3N1Y2Nlc3MnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBVcGRhdGUgZGF0YSBhZnRlciBzdWNjZXNzZnVsIFNGVFAgdXBsb2FkXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnVXBkYXRpbmcgZGF0YSBhZnRlciBTRlRQIHVwbG9hZC4uLicsICd3YXJuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hEYXRhQWZ0ZXJCdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYFNGVFAgdXBsb2FkIGNvbXBsZXRlZCB3aXRoIGVycm9yIChjb2RlICR7Y29kZX0pYCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVuZCB0aW1lIHRyYWNraW5nXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5lbmRTdGFnZVRpbWluZygnc2Z0cExvYWQnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH07XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgbmVlZCB0byBjbGVhciBTRlRQIGZvbGRlciwgc2hvdyB3YXJuaW5nXHJcbiAgICAgICAgICAgICAgICBpZiAoY2xlYXJTZnRwRW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCfimqDvuI8gU0ZUUCBmb2xkZXIgY2xlYW51cCBlbmFibGVkIGJlZm9yZSB1cGxvYWQnLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHJ1blNmdHBMb2FkKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgLy8gQ2hlY2sgYnVpbGQvd2ViLW1vYmlsZSBmb2xkZXIgZXhpc3RlbmNlXHJcbiAgICAgICAgY2hlY2tCdWlsZEZvbGRlckV4aXN0cyhwcm9qZWN0UGF0aDogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIGNvbnN0IGJ1aWxkUGF0aCA9IGpvaW4ocHJvamVjdFBhdGgsICdidWlsZCcsICd3ZWItbW9iaWxlJyk7XHJcbiAgICAgICAgICAgIHJldHVybiBleGlzdHNTeW5jKGJ1aWxkUGF0aCk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgZGlzdC9zZnRwIGZvbGRlciBleGlzdGVuY2VcclxuICAgICAgICBjaGVja1NmdHBGb2xkZXJFeGlzdHMocHJvamVjdFBhdGg6IHN0cmluZyk6IGJvb2xlYW4ge1xyXG4gICAgICAgICAgICBjb25zdCBzZnRwUGF0aCA9IGpvaW4ocHJvamVjdFBhdGgsICdkaXN0JywgJ3NmdHAnKTtcclxuICAgICAgICAgICAgcmV0dXJuIGV4aXN0c1N5bmMoc2Z0cFBhdGgpO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vIENoZWNrIGNvbmZpZyB0aHJvdWdoIGJ1aWxkSGFuZGxlclxyXG4gICAgICAgIGFzeW5jIGNoZWNrQnVpbGRIYW5kbGVyQ29uZmlnKHByb2plY3RQYXRoOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcclxuICAgICAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlPGJvb2xlYW4+KChyZXNvbHZlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tYW5kID0gUGxhdGZvcm1VdGlscy5ydW5OcG1Db21tYW5kKCdydW4gYnVpbGQgaW5mbycsIHByb2plY3RQYXRoKTtcclxuICAgICAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMucHVzaChjb21tYW5kKTtcclxuXHJcbiAgICAgICAgICAgICAgICBsZXQgaGFzVmFsaWRDb25maWcgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBsb2cgPSBkYXRhLnRvU3RyaW5nKCkudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIElmIHdlIGdvdCBKU09OIHdpdGggY29uZmlnLCBidWlsZCBleGlzdHNcclxuICAgICAgICAgICAgICAgICAgICBpZiAobG9nLmluY2x1ZGVzKCdcIm5hbWVcIicpIHx8IGxvZy5pbmNsdWRlcygnXCJzdWZmaXhcIicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGhhc1ZhbGlkQ29uZmlnID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb21tYW5kLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBlcnJvciwgYnVpbGQgZG9lcyBub3QgZXhpc3RcclxuICAgICAgICAgICAgICAgICAgICBoYXNWYWxpZENvbmZpZyA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29tbWFuZC5vbignY2xvc2UnLCAoY29kZTogbnVtYmVyIHwgbnVsbCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMgPSBydW5uaW5nUHJvY2Vzc2VzLmZpbHRlcihwID0+IHAgIT09IGNvbW1hbmQpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoaGFzVmFsaWRDb25maWcgJiYgY29kZSA9PT0gMCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8gQ2hlY2sgbmVjZXNzaXR5IG9mIGZvcmNlZCBtYWluIGJ1aWxkIGFjdGl2YXRpb25cclxuICAgICAgICBhc3luYyBjaGVja0FuZEZvcmNlTWFpbkJ1aWxkKHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3QgYnVpbGRGb2xkZXJFeGlzdHMgPSB0aGlzLmNoZWNrQnVpbGRGb2xkZXJFeGlzdHMocHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICBjb25zdCBoYXNWYWxpZENvbmZpZyA9IGF3YWl0IHRoaXMuY2hlY2tCdWlsZEhhbmRsZXJDb25maWcocHJvamVjdFBhdGgpO1xyXG5cclxuICAgICAgICAgICAgY29uc3Qgc2hvdWxkRm9yY2VNYWluQnVpbGQgPSAhYnVpbGRGb2xkZXJFeGlzdHMgfHwgIWhhc1ZhbGlkQ29uZmlnO1xyXG5cclxuICAgICAgICAgICAgaWYgKHNob3VsZEZvcmNlTWFpbkJ1aWxkKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtYWluQnVpbGRDaGVja2JveCA9IHRoaXMuJC5tYWluQnVpbGRDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgaWYgKG1haW5CdWlsZENoZWNrYm94KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgbWFpbkJ1aWxkQ2hlY2tib3guY2hlY2tlZCA9IHRydWU7XHJcbiAgICAgICAgICAgICAgICAgICAgbWFpbkJ1aWxkQ2hlY2tib3guZGlzYWJsZWQgPSB0cnVlOyAvLyBCbG9jayBhYmlsaXR5IHRvIHVuY2hlY2tcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygn4pqg77iPIE1haW4gYnVpbGQgZm9yY2libHkgYWN0aXZhdGVkIChidWlsZC93ZWItbW9iaWxlIGZvbGRlciBvciBjb25maWcgbWlzc2luZyknLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbWFpbkJ1aWxkQ2hlY2tib3ggPSB0aGlzLiQubWFpbkJ1aWxkQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgICAgIGlmIChtYWluQnVpbGRDaGVja2JveCkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIFVubG9jayBvbmx5IGlmIGJ1aWxkIGlzIG5vdCBydW5uaW5nXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKCFpc0J1aWxkaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1haW5CdWlsZENoZWNrYm94LmRpc2FibGVkID0gZmFsc2U7IC8vIFVubG9jayBtYW5hZ2VtZW50IGFiaWxpdHlcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIHJldHVybiBzaG91bGRGb3JjZU1haW5CdWlsZDtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBnZXRWZXJzaW9ucyhwcm9qZWN0UGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBDbGVhciByZXF1aXJlIGNhY2hlIGZvciB2ZXJzaW9ucy5janMgZmlsZVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb25GaWxlUGF0aCA9IGpvaW4ocHJvamVjdFBhdGgsICd2ZXJzaW9ucy5janMnKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RzU3luYyh2ZXJzaW9uRmlsZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSByZXF1aXJlLmNhY2hlW3JlcXVpcmUucmVzb2x2ZSh2ZXJzaW9uRmlsZVBhdGgpXTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vIExvYWQgdmVyc2lvbnMgZGlyZWN0bHkgZnJvbSBmaWxlXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbnNNYW5hZ2VyID0gbmV3IFZlcnNpb25zTWFuYWdlcihwcm9qZWN0UGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMgPSB2ZXJzaW9uc01hbmFnZXIubG9hZFZlcnNpb25zKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JfQsNCz0YDRg9C20LDQtdC8INGF0YDQsNC90LjQu9C40YnQtSDQv9C10YDQtdC80LXQvdC90YvRhVxyXG4gICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1N0b3JhZ2UgPSB2ZXJzaW9uc01hbmFnZXIubG9hZFZhcmlhYmxlc1N0b3JhZ2UoKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQl9Cw0LPRgNGD0LbQsNC10Lwg0LLRi9Cx0YDQsNC90L3Rg9GOINCy0LXRgNGB0LjRjlxyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkVmVyc2lvbk5hbWUgPSB2ZXJzaW9uc01hbmFnZXIubG9hZFNlbGVjdGVkVmVyc2lvbigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQo9C00LDQu9GP0LXQvCDQv9C+0LvQtSBzZWxlY3RlZCDQuNC3INCy0LXRgNGB0LjQuSAo0LXRgdC70Lgg0L7QvdC+INC10YHRgtGMKSAtINGC0LXQv9C10YDRjCDQuNGB0L/QvtC70YzQt9GD0LXQvCBzZWxlY3RlZFZlcnNpb25OYW1lXHJcbiAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCh2ZXJzaW9uID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCdzZWxlY3RlZCcgaW4gdmVyc2lvbikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHZlcnNpb24uc2VsZWN0ZWQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JjQt9Cy0LvQtdC60LDQtdC8INC/0LXRgNC10LzQtdC90L3Ri9C1INC40Lcg0LLQtdGA0YHQuNC5INC4INC00L7QsdCw0LLQu9GP0LXQvCDQsiDRhdGA0LDQvdC40LvQuNGJ0LUsINC10YHQu9C4INC40YUg0YLQsNC8INC90LXRglxyXG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb25zLmZvckVhY2godmVyc2lvbiA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZlcnNpb24pLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIChrZXkgIT09ICduYW1lJyAmJiBrZXkgIT09ICd2ZXJzaW9uJyAmJiBrZXkgIT09ICdzZWxlY3RlZCcgJiYgIShrZXkgaW4gdmFyaWFibGVzU3RvcmFnZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L/QtdGA0LXQvNC10L3QvdGD0Y4g0LIg0YXRgNCw0L3QuNC70LjRidC1INGBINC00LXRhNC+0LvRgtC90YvQvCDQt9C90LDRh9C10L3QuNC10Lwg0LjQtyDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNTdG9yYWdlW2tleV0gPSB2ZXJzaW9uW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0LjQvNC10L3Rj9C10Lwg0L7QsdGP0LfQsNGC0LXQu9GM0L3Ri9C1INC/0LXRgNC10LzQtdC90L3Ri9C1INC40Lcg0LrQvtC90YTQuNCz0LAgKNC10YHQu9C4IHRpdGxlQ29uZmlnINGD0LbQtSDQt9Cw0LPRgNGD0LbQtdC9KVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICh0aXRsZUNvbmZpZyAmJiB0aXRsZUNvbmZpZy5yZXF1aXJlZFZhcmlhYmxlcykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXF1aXJlZFZhcmlhYmxlcyA9IHsgLi4udGl0bGVDb25maWcucmVxdWlyZWRWYXJpYWJsZXMgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBseVJlcXVpcmVkVmFyaWFibGVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0L7RgNC40LPQuNC90LDQu9GM0L3Ri9C1INCy0LXRgNGB0LjQuCDQuCDRhdGA0LDQvdC40LvQuNGJ0LUg0LTQu9GPINGB0YDQsNCy0L3QtdC90LjRj1xyXG4gICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsVmVyc2lvbnMgPSBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KHZlcnNpb25zKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxWYXJpYWJsZXNTdG9yYWdlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh2YXJpYWJsZXNTdG9yYWdlKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWxTZWxlY3RlZFZlcnNpb25OYW1lID0gc2VsZWN0ZWRWZXJzaW9uTmFtZTtcclxuICAgICAgICAgICAgICAgICAgICBoYXNVbnNhdmVkQ2hhbmdlcyA9IGZhbHNlO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBEaXNwbGF5IHZlcnNpb24gZWRpdG9yXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyBDaGVjayBTRlRQIGZvbGRlciBwcmVzZW5jZSBhbmQgbWFuYWdlIGNoZWNrYm94IGF2YWlsYWJpbGl0eVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNmdHBGb2xkZXJFeGlzdHMgPSB0aGlzLmNoZWNrU2Z0cEZvbGRlckV4aXN0cyhwcm9qZWN0UGF0aCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zZXRTZnRwQ2hlY2tib3hFbmFibGVkKHNmdHBGb2xkZXJFeGlzdHMpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXNmdHBGb2xkZXJFeGlzdHMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VwZXJodG1sQ2hlY2tib3ggPSB0aGlzLiQuc3VwZXJodG1sQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHN1cGVyaHRtbENoZWNrYm94ICYmIHN1cGVyaHRtbENoZWNrYm94LmNoZWNrZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCfimqDvuI8gZGlzdC9zZnRwIGZvbGRlciBub3QgZm91bmQsIGJ1dCBTRlRQIHVwbG9hZCBpcyBhdmFpbGFibGUgdGhhbmtzIHRvIGVuYWJsZWQgU3VwZXJIVE1MIGJ1aWxkLicsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygn4pqg77iPIGRpc3Qvc2Z0cCBmb2xkZXIgbm90IGZvdW5kLiBTRlRQIHVwbG9hZCB1bmF2YWlsYWJsZSB1bnRpbCBidWlsZCBpcyBjb21wbGV0ZWQuJywgJ3dhcm4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8gQ2hlY2sgbmVjZXNzaXR5IG9mIGZvcmNlZCBtYWluIGJ1aWxkIGFjdGl2YXRpb25cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmNoZWNrQW5kRm9yY2VNYWluQnVpbGQocHJvamVjdFBhdGgpLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBHZXQgYWxsIGluZm9ybWF0aW9uIHRocm91Z2ggZXh0ZXJuYWwgcHJvY2VzcyAodmVyc2lvbnMsIGhhc2gsIHN1ZmZpeCwgdGl0bGUgY29uZmlnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFN1ZmZpeEFuZEhhc2gocHJvamVjdFBhdGgsIHJlc29sdmUpO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgRXJyb3IgbG9hZGluZyB2ZXJzaW9uczogJHtlcnJvcn1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGdldFN1ZmZpeEFuZEhhc2gocHJvamVjdFBhdGg6IHN0cmluZywgcmVzb2x2ZTogKCkgPT4gdm9pZCkge1xyXG4gICAgICAgICAgICBjb25zdCBjb21tYW5kID0gUGxhdGZvcm1VdGlscy5ydW5OcG1Db21tYW5kKCdydW4gYnVpbGQgaW5mbycsIHByb2plY3RQYXRoKTtcclxuICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3Nlcy5wdXNoKGNvbW1hbmQpO1xyXG5cclxuICAgICAgICAgICAgbGV0IHZlcnNpb25zRGF0YSA9ICcnO1xyXG4gICAgICAgICAgICBsZXQgYWRkaXRpb25hbEluZm9EYXRhID0gJyc7XHJcblxyXG4gICAgICAgICAgICBjb21tYW5kLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxvZyA9IGRhdGEudG9TdHJpbmcoKS50cmltKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU3BsaXQgZGF0YSBpbnRvIHR3byBwYXJ0czogdmVyc2lvbnMgYW5kIGFkZGl0aW9uYWwgaW5mb3JtYXRpb25cclxuICAgICAgICAgICAgICAgIGlmIChsb2cuaW5jbHVkZXMoJ1wibmFtZVwiJykgJiYgIWxvZy5pbmNsdWRlcygnXCJzdWZmaXhcIicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyB2ZXJzaW9uIGRhdGFcclxuICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uc0RhdGEgPSBsb2c7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGxvZy5pbmNsdWRlcygnXCJzdWZmaXhcIicpIHx8IGxvZy5pbmNsdWRlcygnXCJoYXNoZWRGb2xkZXJcIicpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8gVGhpcyBpcyBhZGRpdGlvbmFsIGluZm9ybWF0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgYWRkaXRpb25hbEluZm9EYXRhID0gbG9nO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vIFByb2Nlc3MgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxyXG4gICAgICAgICAgICAgICAgaWYgKGFkZGl0aW9uYWxJbmZvRGF0YSkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGFkZGl0aW9uYWxJbmZvID0gSlNPTi5wYXJzZShhZGRpdGlvbmFsSW5mb0RhdGEpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgc3VmZml4RWxlbWVudCA9IHRoaXMuJC5zdWZmaXhFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBoYXNoRWxlbWVudCA9IHRoaXMuJC5oYXNoZWRGb2xkZXJFbGVtZW50IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBjbGllbnRFbGVtZW50ID0gdGhpcy4kLmNsaWVudEVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHRpdGxlS2V5RWxlbWVudCA9IHRoaXMuJC50aXRsZUtleUVsZW1lbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhbmd1YWdlc0VsZW1lbnQgPSB0aGlzLiQubGFuZ3VhZ2VzRWxlbWVudCBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIFVwZGF0ZSBtYWluIGZpZWxkc1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3VmZml4RWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc3VmZml4RWxlbWVudC5pbm5lckhUTUwgPSBhZGRpdGlvbmFsSW5mby5zdWZmaXggfHwgJy0nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChoYXNoRWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFzaEVsZW1lbnQuaW5uZXJIVE1MID0gYWRkaXRpb25hbEluZm8uaGFzaGVkRm9sZGVyIHx8ICctJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoY2xpZW50RWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xpZW50RWxlbWVudC5pbm5lckhUTUwgPSBhZGRpdGlvbmFsSW5mby5jbGllbnQgfHwgJy0nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aXRsZUtleUVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRpdGxlS2V5RWxlbWVudC5pbm5lckhUTUwgPSBhZGRpdGlvbmFsSW5mby50aXRsZUtleSB8fCAnLSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGxhbmd1YWdlc0VsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhbmd1YWdlcyA9IGFkZGl0aW9uYWxJbmZvLmxhbmd1YWdlcyB8fCBbJ2VuJ107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmb3JtYXR0ZWRMYW5ndWFnZXMgPSBBcnJheS5pc0FycmF5KGxhbmd1YWdlcylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IGxhbmd1YWdlcy5tYXAobGFuZyA9PiBsYW5nLnJlcGxhY2UoL15sYW5nXy8sICcnKSkuam9pbignLCAnKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDogbGFuZ3VhZ2VzLnJlcGxhY2UoL15sYW5nXy8sICcnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmd1YWdlc0VsZW1lbnQuaW5uZXJIVE1MID0gZm9ybWF0dGVkTGFuZ3VhZ2VzO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBTYXZlIHRpdGxlIGNvbmZpZyAoYnV0IGRvbid0IGRpc3BsYXkgaXQpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsSW5mby50aXRsZUNvbmZpZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGVDb25maWcgPSBhZGRpdGlvbmFsSW5mby50aXRsZUNvbmZpZztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCX0LDQs9GA0YPQttCw0LXQvCDQvtCx0Y/Qt9Cw0YLQtdC70YzQvdGL0LUg0L/QtdGA0LXQvNC10L3QvdGL0LUg0LjQtyDQutC+0L3RhNC40LPQsCDRgtCw0LnRgtC70LBcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh0aXRsZUNvbmZpZy5yZXF1aXJlZFZhcmlhYmxlcyAmJiB0eXBlb2YgdGl0bGVDb25maWcucmVxdWlyZWRWYXJpYWJsZXMgPT09ICdvYmplY3QnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRWYXJpYWJsZXMgPSB7IC4uLnRpdGxlQ29uZmlnLnJlcXVpcmVkVmFyaWFibGVzIH07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LTQvtCx0LDQstC70Y/QtdC8INC+0LHRj9C30LDRgtC10LvRjNC90YvQtSDQv9C10YDQtdC80LXQvdC90YvQtSDQsiDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGx5UmVxdWlyZWRWYXJpYWJsZXMoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVxdWlyZWRWYXJpYWJsZXMgPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRGlzcGxheSBwYXRocyBhbmQgbmFtaW5nIGluZm9ybWF0aW9uXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhZGRpdGlvbmFsSW5mby52ZXJzaW9uUGF0aHMgJiYgQXJyYXkuaXNBcnJheShhZGRpdGlvbmFsSW5mby52ZXJzaW9uUGF0aHMpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uUGF0aHMoYWRkaXRpb25hbEluZm8udmVyc2lvblBhdGhzKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIEVycm9yIHBhcnNpbmcgYWRkaXRpb25hbCBpbmZvcm1hdGlvblxyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb21tYW5kLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yTG9nID0gZGF0YS50b1N0cmluZygpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coZXJyb3JMb2csICdlcnJvcicpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbW1hbmQub24oJ2Nsb3NlJywgKGNvZGU6IG51bWJlciB8IG51bGwpID0+IHtcclxuICAgICAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMgPSBydW5uaW5nUHJvY2Vzc2VzLmZpbHRlcihwID0+IHAgIT09IGNvbW1hbmQpO1xyXG4gICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINCy0LXRgNGB0LjQuSDQsiDQstC40LTQtSDRgdC/0L7QudC70LXRgNC+0LJcclxuICAgICAgICBkaXNwbGF5VmVyc2lvbnMoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25zTGlzdCA9IHRoaXMuJC52ZXJzaW9uc0xpc3QgYXMgSFRNTEVsZW1lbnQ7ICAvLyDQn9C+0LvRg9GH0LDQtdC8INC60L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0LLQtdGA0YHQuNC5XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINGH0YLQviDQutC+0L3RgtC10LnQvdC10YAg0YHRg9GJ0LXRgdGC0LLRg9C10YJcclxuICAgICAgICAgICAgaWYgKCF2ZXJzaW9uc0xpc3QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGAINC+0YIg0YHRgtCw0YDRi9GFINC00LDQvdC90YvRhVxyXG4gICAgICAgICAgICB2ZXJzaW9uc0xpc3QuaW5uZXJIVE1MID0gJyc7XHJcblxyXG5cclxuICAgICAgICAgICAgLy8g0KHQvtC30LTQsNC10Lwg0YHQv9C+0LnQu9C10YAg0LTQu9GPINC60LDQttC00L7QuSDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCgodmVyc2lvbk9iaiwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vINCh0L7Qt9C00LDQtdC8INC+0YHQvdC+0LLQvdC+0Lkg0YHQv9C+0LnQu9C10YAg0LTQu9GPINCy0LXRgNGB0LjQuFxyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvblNwb2lsZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uU3BvaWxlci5jbGFzc05hbWUgPSAndmVyc2lvbi1zcG9pbGVyJztcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0LfQtNCw0LXQvCBzdW1tYXJ5INGBINC90LDQt9Cy0LDQvdC40LXQvCDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgIGNvbnN0IHN1bW1hcnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdW1tYXJ5Jyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25PYmoubmFtZSB8fCB2ZXJzaW9uT2JqLnZlcnNpb24gfHwgYFZlcnNpb24gJHtpbmRleCArIDF9YDtcclxuICAgICAgICAgICAgICAgIHN1bW1hcnkudGV4dENvbnRlbnQgPSB2ZXJzaW9uTmFtZTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25TcG9pbGVyLmFwcGVuZENoaWxkKHN1bW1hcnkpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCh0L7Qt9C00LDQtdC8INC60L7QvdGC0LXQudC90LXRgCDQtNC70Y8g0LTQtdGC0LDQu9C10Lkg0LLQtdGA0YHQuNC4XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uRGV0YWlscyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgdmVyc2lvbkRldGFpbHMuY2xhc3NOYW1lID0gJ3ZlcnNpb24tZGV0YWlscyc7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INCy0YHQtSDQv9C+0LvRjyDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZlcnNpb25PYmopLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWVsZERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgICAgIGZpZWxkRGl2LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWZpZWxkJztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbGFiZWxTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsU3Bhbi5jbGFzc05hbWUgPSAndmVyc2lvbi1maWVsZC1sYWJlbCc7XHJcbiAgICAgICAgICAgICAgICAgICAgbGFiZWxTcGFuLnRleHRDb250ZW50ID0ga2V5LmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsga2V5LnNsaWNlKDEpICsgJzonO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFsdWVTcGFuLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWZpZWxkLXZhbHVlJztcclxuICAgICAgICAgICAgICAgICAgICB2YWx1ZVNwYW4udGV4dENvbnRlbnQgPSB2ZXJzaW9uT2JqW2tleV0gIT09IHVuZGVmaW5lZCA/IHZlcnNpb25PYmpba2V5XSA6ICctJztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgZmllbGREaXYuYXBwZW5kQ2hpbGQobGFiZWxTcGFuKTtcclxuICAgICAgICAgICAgICAgICAgICBmaWVsZERpdi5hcHBlbmRDaGlsZCh2YWx1ZVNwYW4pO1xyXG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb25EZXRhaWxzLmFwcGVuZENoaWxkKGZpZWxkRGl2KTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIHZlcnNpb25TcG9pbGVyLmFwcGVuZENoaWxkKHZlcnNpb25EZXRhaWxzKTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25zTGlzdC5hcHBlbmRDaGlsZCh2ZXJzaW9uU3BvaWxlcik7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vINCc0LXRgtC+0LQg0LTQu9GPINC/0YDQuNC80LXQvdC10L3QuNGPINC+0LHRj9C30LDRgtC10LvRjNC90YvRhSDQv9C10YDQtdC80LXQvdC90YvRhSDQuNC3INC60L7QvdGE0LjQs9CwINGC0LDQudGC0LvQsFxyXG4gICAgICAgIGFwcGx5UmVxdWlyZWRWYXJpYWJsZXMoKSB7XHJcbiAgICAgICAgICAgIGlmICghcmVxdWlyZWRWYXJpYWJsZXMgfHwgT2JqZWN0LmtleXMocmVxdWlyZWRWYXJpYWJsZXMpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L7QsdGP0LfQsNGC0LXQu9GM0L3Ri9C1INC/0LXRgNC10LzQtdC90L3Ri9C1INCyINGF0YDQsNC90LjQu9C40YnQtVxyXG4gICAgICAgICAgICBPYmplY3Qua2V5cyhyZXF1aXJlZFZhcmlhYmxlcykuZm9yRWFjaCh2YXJOYW1lID0+IHtcclxuICAgICAgICAgICAgICAgIGlmICghKHZhck5hbWUgaW4gdmFyaWFibGVzU3RvcmFnZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNTdG9yYWdlW3Zhck5hbWVdID0gcmVxdWlyZWRWYXJpYWJsZXNbdmFyTmFtZV07XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8g0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LTQvtCx0LDQstC70Y/QtdC8INC+0LHRj9C30LDRgtC10LvRjNC90YvQtSDQv9C10YDQtdC80LXQvdC90YvQtSDQstC+INCy0YHQtSDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCh2ZXJzaW9uID0+IHtcclxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHJlcXVpcmVkVmFyaWFibGVzKS5mb3JFYWNoKHZhck5hbWUgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHZhck5hbWUgaW4gdmVyc2lvbikpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvblt2YXJOYW1lXSA9IHJlcXVpcmVkVmFyaWFibGVzW3Zhck5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQvtGC0L7QsdGA0LDQttC10L3QuNC1LCDQtdGB0LvQuCDRgNC10LTQsNC60YLQvtGAINGD0LbQtSDQvtGC0LrRgNGL0YJcclxuICAgICAgICAgICAgaWYgKHRoaXMuJC52ZXJzaW9uRWRpdG9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uRWRpdG9yKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQv9GA0L7QstC10YDQutC4LCDRj9Cy0LvRj9C10YLRgdGPINC70Lgg0L/QtdGA0LXQvNC10L3QvdCw0Y8g0L7QsdGP0LfQsNGC0LXQu9GM0L3QvtC5XHJcbiAgICAgICAgaXNSZXF1aXJlZFZhcmlhYmxlKHZhcmlhYmxlTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XHJcbiAgICAgICAgICAgIHJldHVybiB2YXJpYWJsZU5hbWUgaW4gcmVxdWlyZWRWYXJpYWJsZXM7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L/QvtC70YPRh9C10L3QuNGPINCy0YHQtdGFINC/0LXRgNC10LzQtdC90L3Ri9GFICjQuNC3INGF0YDQsNC90LjQu9C40YnQsCDQuCDQuNC3INCy0LXRgNGB0LjQuSlcclxuICAgICAgICBnZXRBbGxWYXJpYWJsZXMoKTogU2V0PHN0cmluZz4ge1xyXG4gICAgICAgICAgICBjb25zdCBhbGxWYXJpYWJsZXMgPSBuZXcgU2V0PHN0cmluZz4oT2JqZWN0LmtleXModmFyaWFibGVzU3RvcmFnZSkpO1xyXG5cclxuICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC+0LHRj9C30LDRgtC10LvRjNC90YvQtSDQv9C10YDQtdC80LXQvdC90YvQtSDQuNC3INC60L7QvdGE0LjQs9CwXHJcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKHJlcXVpcmVkVmFyaWFibGVzKS5mb3JFYWNoKHZhck5hbWUgPT4ge1xyXG4gICAgICAgICAgICAgICAgYWxsVmFyaWFibGVzLmFkZCh2YXJOYW1lKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L/QtdGA0LXQvNC10L3QvdGL0LUg0LjQtyDQstC10YDRgdC40LlcclxuICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCh2ZXJzaW9uID0+IHtcclxuICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKHZlcnNpb24pLmZvckVhY2goa2V5ID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoa2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAndmVyc2lvbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgYWxsVmFyaWFibGVzLmFkZChrZXkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBhbGxWYXJpYWJsZXM7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L7RgtC+0LHRgNCw0LbQtdC90LjRjyDRgNC10LTQsNC60YLQvtGA0LAg0LLQtdGA0YHQuNC5XHJcbiAgICAgICAgZGlzcGxheVZlcnNpb25FZGl0b3IoKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHZlcnNpb25FZGl0b3IgPSB0aGlzLiQudmVyc2lvbkVkaXRvciBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgdmFyaWFibGVzTGlzdCA9IHRoaXMuJC52YXJpYWJsZXNMaXN0IGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uc0J1aWxkTGlzdCA9IHRoaXMuJC52ZXJzaW9uc0J1aWxkTGlzdCBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICAgICAgICAgIGlmICghdmVyc2lvbkVkaXRvciB8fCAhdmFyaWFibGVzTGlzdCB8fCAhdmVyc2lvbnNCdWlsZExpc3QpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuXHJcbiAgICAgICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INC60L7QvdGC0LXQudC90LXRgNGLXHJcbiAgICAgICAgICAgIHZhcmlhYmxlc0xpc3QuaW5uZXJIVE1MID0gJyc7XHJcbiAgICAgICAgICAgIHZlcnNpb25zQnVpbGRMaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cclxuICAgICAgICAgICAgLy8g0J/QvtC70YPRh9Cw0LXQvCDQstGB0LUg0L/QtdGA0LXQvNC10L3QvdGL0LUgKNC40Lcg0YXRgNCw0L3QuNC70LjRidCwINC4INC40Lcg0LLQtdGA0YHQuNC5KVxyXG4gICAgICAgICAgICBjb25zdCBhbGxWYXJpYWJsZXMgPSB0aGlzLmdldEFsbFZhcmlhYmxlcygpO1xyXG5cclxuICAgICAgICAgICAgLy8g0J7RgtC+0LHRgNCw0LbQsNC10Lwg0LLRgdC1INC/0LXRgNC10LzQtdC90L3Ri9C1XHJcbiAgICAgICAgICAgIGFsbFZhcmlhYmxlcy5mb3JFYWNoKHZhcmlhYmxlTmFtZSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc1JlcXVpcmVkID0gdGhpcy5pc1JlcXVpcmVkVmFyaWFibGUodmFyaWFibGVOYW1lKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhYmxlSXRlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmNsYXNzTmFtZSA9IGlzUmVxdWlyZWQgPyAndmFyaWFibGUtaXRlbSByZXF1aXJlZC12YXJpYWJsZScgOiAndmFyaWFibGUtaXRlbSc7XHJcbiAgICAgICAgICAgICAgICB2YXJpYWJsZUl0ZW0uZHJhZ2dhYmxlID0gdHJ1ZTtcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlSXRlbS5kYXRhc2V0LnZhcmlhYmxlTmFtZSA9IHZhcmlhYmxlTmFtZTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBuYW1lU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgICAgICAgICAgICAgIG5hbWVTcGFuLmNsYXNzTmFtZSA9ICd2YXJpYWJsZS1uYW1lJztcclxuICAgICAgICAgICAgICAgIG5hbWVTcGFuLnRleHRDb250ZW50ID0gdmFyaWFibGVOYW1lO1xyXG4gICAgICAgICAgICAgICAgaWYgKGlzUmVxdWlyZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lU3Bhbi50aXRsZSA9ICfQntCx0Y/Qt9Cw0YLQtdC70YzQvdCw0Y8g0L/QtdGA0LXQvNC10L3QvdCw0Y8gKNC40Lcg0LrQvtC90YTQuNCz0LAg0YLQsNC50YLQu9CwKSc7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J/QvtC70YPRh9Cw0LXQvCDQt9C90LDRh9C10L3QuNC1INC40Lcg0YXRgNCw0L3QuNC70LjRidCwLCDQtdGB0LvQuCDQtdGB0YLRjCwg0LjQvdCw0YfQtSDQuNC3INC/0LXRgNCy0L7QuSDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgIGxldCBkZWZhdWx0VmFsdWUgPSB2YXJpYWJsZXNTdG9yYWdlW3ZhcmlhYmxlTmFtZV07XHJcbiAgICAgICAgICAgICAgICBpZiAoZGVmYXVsdFZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGFtcGxlVmVyc2lvbiA9IHZlcnNpb25zLmZpbmQodiA9PiB2YXJpYWJsZU5hbWUgaW4gdik7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlID0gZXhhbXBsZVZlcnNpb24gPyBleGFtcGxlVmVyc2lvblt2YXJpYWJsZU5hbWVdIDogJyc7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0KHQvtC30LTQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQt9C90LDRh9C10L3QuNGPINC4INC60L3QvtC/0LrQuCDRgNC10LTQsNC60YLQuNGA0L7QstCw0L3QuNGPXHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZUNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVDb250YWluZXIuY2xhc3NOYW1lID0gJ3ZhcmlhYmxlLXZhbHVlLWNvbnRhaW5lcic7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0KHQvtC30LTQsNC10Lwg0L7RgtC+0LHRgNCw0LbQsNC10LzQvtC1INC30L3QsNGH0LXQvdC40LUgKHJlYWRvbmx5KVxyXG4gICAgICAgICAgICAgICAgY29uc3QgdmFsdWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVEaXNwbGF5LmNsYXNzTmFtZSA9ICd2YXJpYWJsZS12YWx1ZS1kaXNwbGF5JztcclxuICAgICAgICAgICAgICAgIHZhbHVlRGlzcGxheS50ZXh0Q29udGVudCA9IGRlZmF1bHRWYWx1ZSAhPT0gdW5kZWZpbmVkID8gU3RyaW5nKGRlZmF1bHRWYWx1ZSkgOiAnJztcclxuICAgICAgICAgICAgICAgIHZhbHVlRGlzcGxheS50aXRsZSA9ICfQlNC10YTQvtC70YLQvdC+0LUg0LfQvdCw0YfQtdC90LjQtSDQv9C10YDQtdC80LXQvdC90L7QuSc7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JrQvdC+0L/QutCwINGA0LXQtNCw0LrRgtC40YDQvtCy0LDQvdC40Y9cclxuICAgICAgICAgICAgICAgIGNvbnN0IGVkaXRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICAgICAgICAgIGVkaXRCdXR0b24uY2xhc3NOYW1lID0gJ3ZhcmlhYmxlLWl0ZW0tZWRpdCc7XHJcbiAgICAgICAgICAgICAgICBlZGl0QnV0dG9uLnRleHRDb250ZW50ID0gJ+Kcjic7XHJcbiAgICAgICAgICAgICAgICBlZGl0QnV0dG9uLnRpdGxlID0gJ9Cg0LXQtNCw0LrRgtC40YDQvtCy0LDRgtGMINC/0LXRgNC10LzQtdC90L3Rg9GOJztcclxuICAgICAgICAgICAgICAgIGVkaXRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93RWRpdFZhcmlhYmxlTW9kYWwodmFyaWFibGVOYW1lKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCa0L3QvtC/0LrQsCDRg9C00LDQu9C10L3QuNGPINC/0LXRgNC10LzQtdC90L3QvtC5INC40Lcg0YXRgNCw0L3QuNC70LjRidCwICjQv9C+0LrQsNC30YvQstCw0LXQvCDRgtC+0LvRjNC60L4g0LXRgdC70Lgg0L/QtdGA0LXQvNC10L3QvdCw0Y8g0LIg0YXRgNCw0L3QuNC70LjRidC1INC4INC90LUg0L7QsdGP0LfQsNGC0LXQu9GM0L3QsNGPKVxyXG4gICAgICAgICAgICAgICAgbGV0IHJlbW92ZUJ1dHRvbjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICAgICAgICAgICAgICAgIGlmICh2YXJpYWJsZU5hbWUgaW4gdmFyaWFibGVzU3RvcmFnZSAmJiAhaXNSZXF1aXJlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVCdXR0b24uY2xhc3NOYW1lID0gJ3ZhcmlhYmxlLWl0ZW0tcmVtb3ZlJztcclxuICAgICAgICAgICAgICAgICAgICByZW1vdmVCdXR0b24udGV4dENvbnRlbnQgPSAnw5cnO1xyXG4gICAgICAgICAgICAgICAgICAgIHJlbW92ZUJ1dHRvbi50aXRsZSA9ICfQo9C00LDQu9C40YLRjCDQv9C10YDQtdC80LXQvdC90YPRjiDQuNC3INGF0YDQsNC90LjQu9C40YnQsCc7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVtb3ZlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGNvbmZpcm0oYNCj0LTQsNC70LjRgtGMINC/0LXRgNC10LzQtdC90L3Rg9GOIFwiJHt2YXJpYWJsZU5hbWV9XCIg0LjQtyDRhdGA0LDQvdC40LvQuNGJ0LA/INCt0YLQviDQvdC1INGD0LTQsNC70LjRgiDQtdGRINC40Lcg0LLQtdGA0YHQuNC5LCDQs9C00LUg0L7QvdCwINC40YHQv9C+0LvRjNC30YPQtdGC0YHRjy5gKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVsZXRlIHZhcmlhYmxlc1N0b3JhZ2VbdmFyaWFibGVOYW1lXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFya1ZlcnNpb25zQXNDaGFuZ2VkKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uRWRpdG9yKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICB2YWx1ZUNvbnRhaW5lci5hcHBlbmRDaGlsZCh2YWx1ZURpc3BsYXkpO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVDb250YWluZXIuYXBwZW5kQ2hpbGQoZWRpdEJ1dHRvbik7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmFwcGVuZENoaWxkKG5hbWVTcGFuKTtcclxuICAgICAgICAgICAgICAgIHZhcmlhYmxlSXRlbS5hcHBlbmRDaGlsZCh2YWx1ZUNvbnRhaW5lcik7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVtb3ZlQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmFwcGVuZENoaWxkKHJlbW92ZUJ1dHRvbik7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC+0LHRgNCw0LHQvtGC0YfQuNC60LggZHJhZyBhbmQgZHJvcFxyXG4gICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdzdGFydCcsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5kYXRhVHJhbnNmZXIhLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5kYXRhVHJhbnNmZXIhLnNldERhdGEoJ3RleHQvcGxhaW4nLCB2YXJpYWJsZU5hbWUpO1xyXG4gICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlSXRlbS5jbGFzc0xpc3QuYWRkKCdkcmFnZ2luZycpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVJdGVtLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWdnaW5nJyk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICB2YXJpYWJsZXNMaXN0LmFwcGVuZENoaWxkKHZhcmlhYmxlSXRlbSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8g0J7RgtC+0LHRgNCw0LbQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGA0Ysg0LTQu9GPINCy0LXRgNGB0LjQuVxyXG4gICAgICAgICAgICB2ZXJzaW9ucy5mb3JFYWNoKCh2ZXJzaW9uT2JqLCBpbmRleCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkNvbnRhaW5lciA9IHRoaXMuY3JlYXRlVmVyc2lvbkNvbnRhaW5lcih2ZXJzaW9uT2JqLCBpbmRleCk7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uc0J1aWxkTGlzdC5hcHBlbmRDaGlsZCh2ZXJzaW9uQ29udGFpbmVyKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICAvLyDQo9Cx0LXQttC00LDQtdC80YHRjywg0YfRgtC+INC+0LHRgNCw0LHQvtGC0YfQuNC6INC60L3QvtC/0LrQuCDQtNC+0LHQsNCy0LvQtdC90LjRjyDQstC10YDRgdC40Lgg0L/RgNC40LLRj9C30LDQvVxyXG4gICAgICAgICAgICBjb25zdCBhZGRWZXJzaW9uQnV0dG9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZC12ZXJzaW9uLWJ1dHRvbicpIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAoYWRkVmVyc2lvbkJ1dHRvbikge1xyXG4gICAgICAgICAgICAgICAgLy8g0KPQtNCw0LvRj9C10Lwg0YHRgtCw0YDRi9C5INC+0LHRgNCw0LHQvtGC0YfQuNC6LCDQtdGB0LvQuCDQtdGB0YLRjFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3QnV0dG9uID0gYWRkVmVyc2lvbkJ1dHRvbi5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBhZGRWZXJzaW9uQnV0dG9uLnBhcmVudE5vZGU/LnJlcGxhY2VDaGlsZChuZXdCdXR0b24sIGFkZFZlcnNpb25CdXR0b24pO1xyXG4gICAgICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC90L7QstGL0Lkg0L7QsdGA0LDQsdC+0YLRh9C40LpcclxuICAgICAgICAgICAgICAgIG5ld0J1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93QWRkVmVyc2lvbk1vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g0KPQsdC10LbQtNCw0LXQvNGB0Y8sINGH0YLQviDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQutC90L7Qv9C60Lgg0LTQvtCx0LDQstC70LXQvdC40Y8g0L/QtdGA0LXQvNC10L3QvdC+0Lkg0L/RgNC40LLRj9C30LDQvVxyXG4gICAgICAgICAgICBjb25zdCBhZGRWYXJpYWJsZUJ1dHRvbiA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhZGQtdmFyaWFibGUtYnV0dG9uJykgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChhZGRWYXJpYWJsZUJ1dHRvbikge1xyXG4gICAgICAgICAgICAgICAgLy8g0KPQtNCw0LvRj9C10Lwg0YHRgtCw0YDRi9C5INC+0LHRgNCw0LHQvtGC0YfQuNC6LCDQtdGB0LvQuCDQtdGB0YLRjFxyXG4gICAgICAgICAgICAgICAgY29uc3QgbmV3VmFyaWFibGVCdXR0b24gPSBhZGRWYXJpYWJsZUJ1dHRvbi5jbG9uZU5vZGUodHJ1ZSkgYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBhZGRWYXJpYWJsZUJ1dHRvbi5wYXJlbnROb2RlPy5yZXBsYWNlQ2hpbGQobmV3VmFyaWFibGVCdXR0b24sIGFkZFZhcmlhYmxlQnV0dG9uKTtcclxuICAgICAgICAgICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQvdC+0LLRi9C5INC+0LHRgNCw0LHQvtGC0YfQuNC6XHJcbiAgICAgICAgICAgICAgICBuZXdWYXJpYWJsZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93QWRkVmFyaWFibGVNb2RhbCgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQvtGC0L7QsdGA0LDQttC10L3QuNGPINC/0YPRgtC10Lkg0Lgg0L3QtdC50LzQuNC90LPQsCDQstC10YDRgdC40LlcclxuICAgICAgICBkaXNwbGF5VmVyc2lvblBhdGhzKHZlcnNpb25QYXRoczogYW55W10pIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvblBhdGhzTGlzdCA9IHRoaXMuJC52ZXJzaW9uUGF0aHNMaXN0IGFzIEhUTUxFbGVtZW50O1xyXG5cclxuICAgICAgICAgICAgaWYgKCF2ZXJzaW9uUGF0aHNMaXN0KSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INGB0L/QuNGB0L7QulxyXG4gICAgICAgICAgICB2ZXJzaW9uUGF0aHNMaXN0LmlubmVySFRNTCA9ICcnO1xyXG5cclxuICAgICAgICAgICAgaWYgKCF2ZXJzaW9uUGF0aHMgfHwgdmVyc2lvblBhdGhzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3Qgbm9EYXRhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICBub0RhdGEuY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1uby1kYXRhJztcclxuICAgICAgICAgICAgICAgIG5vRGF0YS50ZXh0Q29udGVudCA9ICdObyBwYXRocyBkYXRhIGF2YWlsYWJsZSc7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uUGF0aHNMaXN0LmFwcGVuZENoaWxkKG5vRGF0YSk7XHJcbiAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgIC8vINCh0L7Qt9C00LDQtdC8INC60L7QvdGC0LXQudC90LXRgNGLINC00LvRjyDQutCw0LbQtNC+0Lkg0LLQtdGA0YHQuNC4INGB0L4g0YHQv9C+0LnQu9C10YDQsNC80LhcclxuICAgICAgICAgICAgdmVyc2lvblBhdGhzLmZvckVhY2goKHZlcnNpb25JbmZvKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uU3BvaWxlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RldGFpbHMnKTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25TcG9pbGVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtc3BvaWxlcic7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvblN1bW1hcnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdW1tYXJ5Jyk7XHJcbiAgICAgICAgICAgICAgICB2ZXJzaW9uU3VtbWFyeS5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLXN1bW1hcnknO1xyXG4gICAgICAgICAgICAgICAgdmVyc2lvblN1bW1hcnkuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidmVyc2lvbi1wYXRoLW5hbWVcIj5WZXJzaW9uOiA8c3Ryb25nPiR7dmVyc2lvbkluZm8udmVyc2lvbk5hbWUgfHwgJ2Jhc2UnfTwvc3Ryb25nPjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZlcnNpb24tcGF0aC1jb3VudFwiPiR7dmVyc2lvbkluZm8uZmlsZXMgPyB2ZXJzaW9uSW5mby5maWxlcy5sZW5ndGggOiAwfSBmaWxlczwvc3Bhbj5cclxuICAgICAgICAgICAgICAgIGA7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkNvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25Db250ZW50LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtY29udGVudCc7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgb3V0cHV0RGlySW5mbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgb3V0cHV0RGlySW5mby5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLW91dHB1dC1pbmZvJztcclxuICAgICAgICAgICAgICAgIG91dHB1dERpckluZm8uaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidmVyc2lvbi1wYXRoLWxhYmVsXCI+T3V0cHV0IERpcmVjdG9yeTo8L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2ZXJzaW9uLXBhdGgtb3V0cHV0LWRpclwiIHRpdGxlPVwiJHt2ZXJzaW9uSW5mby5vdXRwdXREaXJ9XCI+JHt2ZXJzaW9uSW5mby5vdXRwdXREaXJ9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgYDtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25Db250ZW50LmFwcGVuZENoaWxkKG91dHB1dERpckluZm8pO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICh2ZXJzaW9uSW5mby5maWxlcyAmJiB2ZXJzaW9uSW5mby5maWxlcy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8LCDQtdGB0YLRjCDQu9C4INGDINGE0LDQudC70L7QsiB2YXJpYW50TmFtZSAo0YDQtdC20LjQvCDQvNC90L7QttC10YHRgtCy0LXQvdC90YvRhSDRiNCw0LHQu9C+0L3QvtCyKVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGhhc1ZhcmlhbnRzID0gdmVyc2lvbkluZm8uZmlsZXMuc29tZSgoZmlsZTogYW55KSA9PiBmaWxlLnZhcmlhbnROYW1lKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGhhc1ZhcmlhbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCT0YDRg9C/0L/QuNGA0YPQtdC8INGE0LDQudC70Ysg0YHQvdCw0YfQsNC70LAg0L/QviB2YXJpYW50TmFtZSwg0L/QvtGC0L7QvCDQv9C+INGP0LfRi9C60LDQvFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc0J5VmFyaWFudDogeyBba2V5OiBzdHJpbmddOiBhbnlbXSB9ID0ge307XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb25JbmZvLmZpbGVzLmZvckVhY2goKGZpbGU6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudCA9IGZpbGUudmFyaWFudE5hbWUgfHwgJ2RlZmF1bHQnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFmaWxlc0J5VmFyaWFudFt2YXJpYW50XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQnlWYXJpYW50W3ZhcmlhbnRdID0gW107XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0J5VmFyaWFudFt2YXJpYW50XS5wdXNoKGZpbGUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIE9iamVjdC5rZXlzKGZpbGVzQnlWYXJpYW50KS5mb3JFYWNoKCh2YXJpYW50TmFtZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudEZpbGVzID0gZmlsZXNCeVZhcmlhbnRbdmFyaWFudE5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudFNwb2lsZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkZXRhaWxzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50U3BvaWxlci5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLXZhcmlhbnQtc3BvaWxlcic7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudFN1bW1hcnkgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdW1tYXJ5Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50U3VtbWFyeS5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLXZhcmlhbnQtc3VtbWFyeSc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YXJpYW50U3VtbWFyeS5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2ZXJzaW9uLXBhdGgtdmFyaWFudC1pY29uXCI+8J+Tpjwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZlcnNpb24tcGF0aC12YXJpYW50LW5hbWVcIj4ke3ZhcmlhbnROYW1lfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZlcnNpb24tcGF0aC12YXJpYW50LWNvdW50XCI+JHt2YXJpYW50RmlsZXMubGVuZ3RofSBmaWxlczwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFudENvbnRlbnQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnRDb250ZW50LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtdmFyaWFudC1jb250ZW50JztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQktC90YPRgtGA0Lgg0LLQsNGA0LjQsNC90YLQsCDQs9GA0YPQv9C/0LjRgNGD0LXQvCDQv9C+INGP0LfRi9C60LDQvFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXNCeUxhbmd1YWdlOiB7IFtrZXk6IHN0cmluZ106IGFueVtdIH0gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnRGaWxlcy5mb3JFYWNoKChmaWxlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZpbGVzQnlMYW5ndWFnZVtmaWxlLmxhbmd1YWdlXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlc0J5TGFuZ3VhZ2VbZmlsZS5sYW5ndWFnZV0gPSBbXTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNCeUxhbmd1YWdlW2ZpbGUubGFuZ3VhZ2VdLnB1c2goZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBPYmplY3Qua2V5cyhmaWxlc0J5TGFuZ3VhZ2UpLmZvckVhY2goKGxhbmcpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYW5nU3BvaWxlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RldGFpbHMnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nU3BvaWxlci5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLWxhbmctc3BvaWxlcic7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGxhbmdTdW1tYXJ5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3VtbWFyeScpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTdW1tYXJ5LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtbGFuZy1zdW1tYXJ5JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nU3VtbWFyeS50ZXh0Q29udGVudCA9IGBMYW5ndWFnZTogJHtsYW5nfSAoJHtmaWxlc0J5TGFuZ3VhZ2VbbGFuZ10ubGVuZ3RofSBmaWxlcylgO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlc0NvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29udGFpbmVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtZmlsZXMtbGlzdCc7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQnlMYW5ndWFnZVtsYW5nXS5mb3JFYWNoKChmaWxlOiBhbnkpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZUl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUl0ZW0uY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1maWxlLWl0ZW0nO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZUluZm8gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUluZm8uY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1maWxlLWluZm8nO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlSW5mby5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZlcnNpb24tcGF0aC1wbGF0Zm9ybVwiPiR7ZmlsZS5wbGF0Zm9ybX08L3NwYW4+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInZlcnNpb24tcGF0aC1maWxlLW5hbWVcIiB0aXRsZT1cIiR7ZmlsZS5mdWxsUGF0aH1cIj4ke2ZpbGUuZmlsZU5hbWV9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2ZXJzaW9uLXBhdGgtZmlsZS10eXBlXCI+JHtmaWxlLmlzWmlwID8gJ1pJUCcgOiAnSFRNTCd9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBgO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZVBhdGggPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGguY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1maWxlLXBhdGgnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aC50ZXh0Q29udGVudCA9IGZpbGUuZGlyZWN0b3J5O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlUGF0aC50aXRsZSA9IGZpbGUuZnVsbFBhdGg7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlSXRlbS5hcHBlbmRDaGlsZChmaWxlSW5mbyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVJdGVtLmFwcGVuZENoaWxkKGZpbGVQYXRoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNDb250YWluZXIuYXBwZW5kQ2hpbGQoZmlsZUl0ZW0pO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBsYW5nU3BvaWxlci5hcHBlbmRDaGlsZChsYW5nU3VtbWFyeSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbGFuZ1Nwb2lsZXIuYXBwZW5kQ2hpbGQoZmlsZXNDb250YWluZXIpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnRDb250ZW50LmFwcGVuZENoaWxkKGxhbmdTcG9pbGVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnRTcG9pbGVyLmFwcGVuZENoaWxkKHZhcmlhbnRTdW1tYXJ5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhbnRTcG9pbGVyLmFwcGVuZENoaWxkKHZhcmlhbnRDb250ZW50KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb25Db250ZW50LmFwcGVuZENoaWxkKHZhcmlhbnRTcG9pbGVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J7QsdGL0YfQvdGL0Lkg0YDQtdC20LjQvCDigJQg0LPRgNGD0L/Qv9C40YDRg9C10Lwg0YTQsNC50LvRiyDRgtC+0LvRjNC60L4g0L/QviDRj9C30YvQutCw0LxcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXNCeUxhbmd1YWdlOiB7IFtrZXk6IHN0cmluZ106IGFueVtdIH0gPSB7fTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbkluZm8uZmlsZXMuZm9yRWFjaCgoZmlsZTogYW55KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWZpbGVzQnlMYW5ndWFnZVtmaWxlLmxhbmd1YWdlXSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQnlMYW5ndWFnZVtmaWxlLmxhbmd1YWdlXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNCeUxhbmd1YWdlW2ZpbGUubGFuZ3VhZ2VdLnB1c2goZmlsZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J7RgtC+0LHRgNCw0LbQsNC10Lwg0YTQsNC50LvRiyDQv9C+INGP0LfRi9C60LDQvCDQsiDRgdC/0L7QudC70LXRgNCw0YVcclxuICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMoZmlsZXNCeUxhbmd1YWdlKS5mb3JFYWNoKChsYW5nKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYW5nU3BvaWxlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RldGFpbHMnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTcG9pbGVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtbGFuZy1zcG9pbGVyJztcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBsYW5nU3VtbWFyeSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N1bW1hcnknKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTdW1tYXJ5LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtbGFuZy1zdW1tYXJ5JztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTdW1tYXJ5LnRleHRDb250ZW50ID0gYExhbmd1YWdlOiAke2xhbmd9ICgke2ZpbGVzQnlMYW5ndWFnZVtsYW5nXS5sZW5ndGh9IGZpbGVzKWA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZmlsZXNDb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29udGFpbmVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtZmlsZXMtbGlzdCc7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZXNCeUxhbmd1YWdlW2xhbmddLmZvckVhY2goKGZpbGU6IGFueSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVJdGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUl0ZW0uY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1maWxlLWl0ZW0nO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBmaWxlSW5mbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVJbmZvLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXBhdGgtZmlsZS1pbmZvJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlSW5mby5pbm5lckhUTUwgPSBgXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzPVwidmVyc2lvbi1wYXRoLXBsYXRmb3JtXCI+JHtmaWxlLnBsYXRmb3JtfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2ZXJzaW9uLXBhdGgtZmlsZS1uYW1lXCIgdGl0bGU9XCIke2ZpbGUuZnVsbFBhdGh9XCI+JHtmaWxlLmZpbGVOYW1lfTwvc3Bhbj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ2ZXJzaW9uLXBhdGgtZmlsZS10eXBlXCI+JHtmaWxlLmlzWmlwID8gJ1pJUCcgOiAnSFRNTCd9PC9zcGFuPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGZpbGVQYXRoID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGguY2xhc3NOYW1lID0gJ3ZlcnNpb24tcGF0aC1maWxlLXBhdGgnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVQYXRoLnRleHRDb250ZW50ID0gZmlsZS5kaXJlY3Rvcnk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZVBhdGgudGl0bGUgPSBmaWxlLmZ1bGxQYXRoO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlSXRlbS5hcHBlbmRDaGlsZChmaWxlSW5mbyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUl0ZW0uYXBwZW5kQ2hpbGQoZmlsZVBhdGgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVzQ29udGFpbmVyLmFwcGVuZENoaWxkKGZpbGVJdGVtKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTcG9pbGVyLmFwcGVuZENoaWxkKGxhbmdTdW1tYXJ5KTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxhbmdTcG9pbGVyLmFwcGVuZENoaWxkKGZpbGVzQ29udGFpbmVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb25Db250ZW50LmFwcGVuZENoaWxkKGxhbmdTcG9pbGVyKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBub0ZpbGVzID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgICAgICAgICAgbm9GaWxlcy5jbGFzc05hbWUgPSAndmVyc2lvbi1wYXRoLW5vLWZpbGVzJztcclxuICAgICAgICAgICAgICAgICAgICBub0ZpbGVzLnRleHRDb250ZW50ID0gJ05vIGZpbGVzIGZvciB0aGlzIHZlcnNpb24nO1xyXG4gICAgICAgICAgICAgICAgICAgIHZlcnNpb25Db250ZW50LmFwcGVuZENoaWxkKG5vRmlsZXMpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIHZlcnNpb25TcG9pbGVyLmFwcGVuZENoaWxkKHZlcnNpb25TdW1tYXJ5KTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25TcG9pbGVyLmFwcGVuZENoaWxkKHZlcnNpb25Db250ZW50KTtcclxuICAgICAgICAgICAgICAgIHZlcnNpb25QYXRoc0xpc3QuYXBwZW5kQ2hpbGQodmVyc2lvblNwb2lsZXIpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDRgdC+0LfQtNCw0L3QuNGPINC60L7QvdGC0LXQudC90LXRgNCwINCy0LXRgNGB0LjQuFxyXG4gICAgICAgIGNyZWF0ZVZlcnNpb25Db250YWluZXIodmVyc2lvbk9iajogYW55LCBpbmRleDogbnVtYmVyKTogSFRNTEVsZW1lbnQge1xyXG4gICAgICAgICAgICBjb25zdCBjb250YWluZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgY29udGFpbmVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWNvbnRhaW5lcic7XHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5kYXRhc2V0LnZlcnNpb25JbmRleCA9IFN0cmluZyhpbmRleCk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBoZWFkZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgaGVhZGVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWNvbnRhaW5lci1oZWFkZXInO1xyXG5cclxuICAgICAgICAgICAgLy8g0KfQtdC60LHQvtC60YEg0LTQu9GPINCy0YvQsdC+0YDQsCDQstC10YDRgdC40LggKNC00LvRjyDQvdC1INC/0YDQvtC0INGA0LXQttC40LzQsClcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbk5hbWUgPSB2ZXJzaW9uT2JqLm5hbWUgfHwgdmVyc2lvbk9iai52ZXJzaW9uIHx8IGBWZXJzaW9uICR7aW5kZXggKyAxfWA7XHJcbiAgICAgICAgICAgIGNvbnN0IHNlbGVjdENoZWNrYm94ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW5wdXQnKTtcclxuICAgICAgICAgICAgc2VsZWN0Q2hlY2tib3gudHlwZSA9ICdjaGVja2JveCc7XHJcbiAgICAgICAgICAgIHNlbGVjdENoZWNrYm94LmNsYXNzTmFtZSA9ICd2ZXJzaW9uLXNlbGVjdC1jaGVja2JveCc7XHJcbiAgICAgICAgICAgIHNlbGVjdENoZWNrYm94LmNoZWNrZWQgPSBzZWxlY3RlZFZlcnNpb25OYW1lID09PSB2ZXJzaW9uTmFtZTtcclxuICAgICAgICAgICAgc2VsZWN0Q2hlY2tib3gudGl0bGUgPSAn0JjRgdC/0L7Qu9GM0LfQvtCy0LDRgtGMINGN0YLRgyDQstC10YDRgdC40Y4g0LIg0L3QtSDQv9GA0L7QtCDRgNC10LbQuNC80LUnO1xyXG4gICAgICAgICAgICBzZWxlY3RDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0Q2hlY2tib3guY2hlY2tlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHNlbGVjdGVkVmVyc2lvbk5hbWUgPSB2ZXJzaW9uTmFtZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgc2VsZWN0ZWRWZXJzaW9uTmFtZSA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB0aGlzLm1hcmtWZXJzaW9uc0FzQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IG5hbWVTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICBuYW1lU3Bhbi5jbGFzc05hbWUgPSAndmVyc2lvbi1jb250YWluZXItbmFtZSc7XHJcbiAgICAgICAgICAgIG5hbWVTcGFuLnRleHRDb250ZW50ID0gdmVyc2lvbk9iai5uYW1lIHx8IHZlcnNpb25PYmoudmVyc2lvbiB8fCBgVmVyc2lvbiAke2luZGV4ICsgMX1gO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgY29weUJ1dHRvbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2J1dHRvbicpO1xyXG4gICAgICAgICAgICBjb3B5QnV0dG9uLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWNvbnRhaW5lci1jb3B5JztcclxuICAgICAgICAgICAgY29weUJ1dHRvbi50ZXh0Q29udGVudCA9ICdDb3B5JztcclxuICAgICAgICAgICAgY29weUJ1dHRvbi50aXRsZSA9ICfQodC+0LfQtNCw0YLRjCDQutC+0L/QuNGOINCy0LXRgNGB0LjQuCc7XHJcbiAgICAgICAgICAgIGNvcHlCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dDb3B5VmVyc2lvbk1vZGFsKGluZGV4KTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCByZW5hbWVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICAgICAgcmVuYW1lQnV0dG9uLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWNvbnRhaW5lci1yZW5hbWUnO1xyXG4gICAgICAgICAgICByZW5hbWVCdXR0b24udGV4dENvbnRlbnQgPSAnUmVuYW1lJztcclxuICAgICAgICAgICAgcmVuYW1lQnV0dG9uLnRpdGxlID0gJ9Cf0LXRgNC10LjQvNC10L3QvtCy0LDRgtGMINCy0LXRgNGB0LjRjic7XHJcbiAgICAgICAgICAgIHJlbmFtZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd1JlbmFtZVZlcnNpb25Nb2RhbChpbmRleCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgcmVtb3ZlQnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XHJcbiAgICAgICAgICAgIHJlbW92ZUJ1dHRvbi5jbGFzc05hbWUgPSAndmVyc2lvbi1jb250YWluZXItcmVtb3ZlJztcclxuICAgICAgICAgICAgcmVtb3ZlQnV0dG9uLnRleHRDb250ZW50ID0gJ1JlbW92ZSc7XHJcbiAgICAgICAgICAgIHJlbW92ZUJ1dHRvbi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChjb25maXJtKGDQo9C00LDQu9C40YLRjCDQstC10YDRgdC40Y4gXCIke25hbWVTcGFuLnRleHRDb250ZW50fVwiP2ApKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMuc3BsaWNlKGluZGV4LCAxKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hcmtWZXJzaW9uc0FzQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVZlcnNpb25FZGl0b3IoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb25zdCBidXR0b25zQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgIGJ1dHRvbnNDb250YWluZXIuY2xhc3NOYW1lID0gJ3ZlcnNpb24tY29udGFpbmVyLWJ1dHRvbnMnO1xyXG4gICAgICAgICAgICBidXR0b25zQ29udGFpbmVyLmFwcGVuZENoaWxkKGNvcHlCdXR0b24pO1xyXG4gICAgICAgICAgICBidXR0b25zQ29udGFpbmVyLmFwcGVuZENoaWxkKHJlbmFtZUJ1dHRvbik7XHJcbiAgICAgICAgICAgIGJ1dHRvbnNDb250YWluZXIuYXBwZW5kQ2hpbGQocmVtb3ZlQnV0dG9uKTtcclxuXHJcbiAgICAgICAgICAgIGhlYWRlci5hcHBlbmRDaGlsZChzZWxlY3RDaGVja2JveCk7XHJcbiAgICAgICAgICAgIGhlYWRlci5hcHBlbmRDaGlsZChuYW1lU3Bhbik7XHJcbiAgICAgICAgICAgIGhlYWRlci5hcHBlbmRDaGlsZChidXR0b25zQ29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IGl0ZW1zQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgIGl0ZW1zQ29udGFpbmVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWNvbnRhaW5lci1pdGVtcyc7XHJcblxyXG4gICAgICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L/QtdGA0LXQvNC10L3QvdGL0LUg0LjQtyDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgT2JqZWN0LmtleXModmVyc2lvbk9iaikuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGtleSAhPT0gJ25hbWUnICYmIGtleSAhPT0gJ3ZlcnNpb24nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXRlbSA9IHRoaXMuY3JlYXRlVmVyc2lvbkl0ZW0oa2V5LCB2ZXJzaW9uT2JqW2tleV0sIGluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICBpdGVtc0NvbnRhaW5lci5hcHBlbmRDaGlsZChpdGVtKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBpZiAoaXRlbXNDb250YWluZXIuY2hpbGRyZW4ubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBlbXB0eU1zZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xyXG4gICAgICAgICAgICAgICAgZW1wdHlNc2cuY2xhc3NOYW1lID0gJ3ZlcnNpb24tY29udGFpbmVyLWVtcHR5JztcclxuICAgICAgICAgICAgICAgIGVtcHR5TXNnLnRleHRDb250ZW50ID0gJ9Cf0LXRgNC10YLQsNGJ0LjRgtC1INC/0LXRgNC10LzQtdC90L3Ri9C1INGB0Y7QtNCwJztcclxuICAgICAgICAgICAgICAgIGl0ZW1zQ29udGFpbmVyLmFwcGVuZENoaWxkKGVtcHR5TXNnKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g0J7QsdGA0LDQsdC+0YLRh9C40LrQuCBkcmFnIGFuZCBkcm9wXHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIChlKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICBlLmRhdGFUcmFuc2ZlciEuZHJvcEVmZmVjdCA9ICdtb3ZlJztcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdkcmFnLW92ZXInKTtcclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb250YWluZXIuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWctb3ZlcicpO1xyXG4gICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgIGNvbnRhaW5lci5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcclxuICAgICAgICAgICAgICAgIGNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdkcmFnLW92ZXInKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IGUuZGF0YVRyYW5zZmVyIS5nZXREYXRhKCd0ZXh0L3BsYWluJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFyaWFibGVOYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JTQu9GPINC+0LHRj9C30LDRgtC10LvRjNC90YvRhSDQv9C10YDQtdC80LXQvdC90YvRhSDQuNGB0L/QvtC70YzQt9GD0LXQvCDQt9C90LDRh9C10L3QuNC1INC40Lcg0LrQvtC90YTQuNCz0LBcclxuICAgICAgICAgICAgICAgICAgICBsZXQgdmFsdWU6IGFueTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5pc1JlcXVpcmVkVmFyaWFibGUodmFyaWFibGVOYW1lKSAmJiB2YXJpYWJsZU5hbWUgaW4gcmVxdWlyZWRWYXJpYWJsZXMpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSByZXF1aXJlZFZhcmlhYmxlc1t2YXJpYWJsZU5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCf0L7Qu9GD0YfQsNC10Lwg0LfQvdCw0YfQtdC90LjQtSDQuNC3INGF0YDQsNC90LjQu9C40YnQsCwg0LXRgdC70Lgg0LXRgdGC0YwsINC40L3QsNGH0LUg0LjQtyDQv9C10YDQstC+0Lkg0LLQtdGA0YHQuNC4INCz0LTQtSDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y9cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YXJpYWJsZXNTdG9yYWdlW3ZhcmlhYmxlTmFtZV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGFtcGxlVmVyc2lvbiA9IHZlcnNpb25zLmZpbmQodiA9PiB2YXJpYWJsZU5hbWUgaW4gdik7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGV4YW1wbGVWZXJzaW9uID8gZXhhbXBsZVZlcnNpb25bdmFyaWFibGVOYW1lXSA6ICcnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQldGB0LvQuCDQv9C10YDQtdC80LXQvdC90L7QuSDQvdC10YIg0LIg0YXRgNCw0L3QuNC70LjRidC1LCDQvdC+INC+0L3QsCDQuNGB0L/QvtC70YzQt9GD0LXRgtGB0Y8g0LIg0LLQtdGA0YHQuNGP0YUsINC00L7QsdCw0LLQu9GP0LXQvCDQtdGRINCyINGF0YDQsNC90LjQu9C40YnQtVxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHZhcmlhYmxlTmFtZSBpbiB2YXJpYWJsZXNTdG9yYWdlKSAmJiB2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhcmlhYmxlc1N0b3JhZ2VbdmFyaWFibGVOYW1lXSA9IHZhbHVlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC/0LXRgNC10LzQtdC90L3Rg9GOINCyINCy0LXRgNGB0LjRjlxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghKHZhcmlhYmxlTmFtZSBpbiB2ZXJzaW9uT2JqKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB2ZXJzaW9uT2JqW3ZhcmlhYmxlTmFtZV0gPSB2YWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrVmVyc2lvbnNBc0NoYW5nZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcblxyXG4gICAgICAgICAgICBjb250YWluZXIuYXBwZW5kQ2hpbGQoaGVhZGVyKTtcclxuICAgICAgICAgICAgY29udGFpbmVyLmFwcGVuZENoaWxkKGl0ZW1zQ29udGFpbmVyKTtcclxuXHJcbiAgICAgICAgICAgIHJldHVybiBjb250YWluZXI7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0YHQvtC30LTQsNC90LjRjyDRjdC70LXQvNC10L3RgtCwINC/0LXRgNC10LzQtdC90L3QvtC5INCyINC60L7QvdGC0LXQudC90LXRgNC1INCy0LXRgNGB0LjQuFxyXG4gICAgICAgIGNyZWF0ZVZlcnNpb25JdGVtKHZhcmlhYmxlTmFtZTogc3RyaW5nLCB2YWx1ZTogYW55LCB2ZXJzaW9uSW5kZXg6IG51bWJlcik6IEhUTUxFbGVtZW50IHtcclxuICAgICAgICAgICAgY29uc3QgaXNSZXF1aXJlZCA9IHRoaXMuaXNSZXF1aXJlZFZhcmlhYmxlKHZhcmlhYmxlTmFtZSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGl0ZW0gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcclxuICAgICAgICAgICAgaXRlbS5jbGFzc05hbWUgPSBpc1JlcXVpcmVkID8gJ3ZlcnNpb24tY29udGFpbmVyLWl0ZW0gcmVxdWlyZWQtdmFyaWFibGUnIDogJ3ZlcnNpb24tY29udGFpbmVyLWl0ZW0nO1xyXG4gICAgICAgICAgICBpdGVtLmRhdGFzZXQudmFyaWFibGVOYW1lID0gdmFyaWFibGVOYW1lO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgbmFtZVNwYW4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgICAgIG5hbWVTcGFuLnRleHRDb250ZW50ID0gYCR7dmFyaWFibGVOYW1lfTogYDtcclxuICAgICAgICAgICAgaWYgKGlzUmVxdWlyZWQpIHtcclxuICAgICAgICAgICAgICAgIG5hbWVTcGFuLnRpdGxlID0gJ9Ce0LHRj9C30LDRgtC10LvRjNC90LDRjyDQv9C10YDQtdC80LXQvdC90LDRjyAo0LjQtyDQutC+0L3RhNC40LPQsCDRgtCw0LnRgtC70LApJztcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g0KHQvtC30LTQsNC10Lwg0LrQvtC90YLQtdC50L3QtdGAINC00LvRjyDQt9C90LDRh9C10L3QuNGPINC4INC60L3QvtC/0LrQuCDRgNC10LTQsNC60YLQuNGA0L7QstCw0L3QuNGPXHJcbiAgICAgICAgICAgIGNvbnN0IHZhbHVlQ29udGFpbmVyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XHJcbiAgICAgICAgICAgIHZhbHVlQ29udGFpbmVyLmNsYXNzTmFtZSA9ICd2ZXJzaW9uLWl0ZW0tdmFsdWUtY29udGFpbmVyJztcclxuXHJcbiAgICAgICAgICAgIC8vINCh0L7Qt9C00LDQtdC8INC+0YLQvtCx0YDQsNC20LDQtdC80L7QtSDQt9C90LDRh9C10L3QuNC1IChyZWFkb25seSlcclxuICAgICAgICAgICAgY29uc3QgdmFsdWVEaXNwbGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xyXG4gICAgICAgICAgICB2YWx1ZURpc3BsYXkuY2xhc3NOYW1lID0gJ3ZlcnNpb24taXRlbS12YWx1ZS1kaXNwbGF5JztcclxuICAgICAgICAgICAgdmFsdWVEaXNwbGF5LnRleHRDb250ZW50ID0gdmFsdWUgIT09IHVuZGVmaW5lZCA/IFN0cmluZyh2YWx1ZSkgOiAnJztcclxuICAgICAgICAgICAgdmFsdWVEaXNwbGF5LnRpdGxlID0gJ9CX0L3QsNGH0LXQvdC40LUg0L/QtdGA0LXQvNC10L3QvdC+0Lkg0LIg0LLQtdGA0YHQuNC4JztcclxuXHJcbiAgICAgICAgICAgIC8vINCa0L3QvtC/0LrQsCDRgNC10LTQsNC60YLQuNGA0L7QstCw0L3QuNGPXHJcbiAgICAgICAgICAgIGNvbnN0IGVkaXRCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdidXR0b24nKTtcclxuICAgICAgICAgICAgZWRpdEJ1dHRvbi5jbGFzc05hbWUgPSAndmVyc2lvbi1pdGVtLWVkaXQnO1xyXG4gICAgICAgICAgICBlZGl0QnV0dG9uLnRleHRDb250ZW50ID0gJ+Kcjic7XHJcbiAgICAgICAgICAgIGVkaXRCdXR0b24udGl0bGUgPSAn0KDQtdC00LDQutGC0LjRgNC+0LLQsNGC0Ywg0LfQvdCw0YfQtdC90LjQtSDQv9C10YDQtdC80LXQvdC90L7QuSc7XHJcbiAgICAgICAgICAgIGVkaXRCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0VkaXRWZXJzaW9uVmFyaWFibGVNb2RhbCh2YXJpYWJsZU5hbWUsIHZlcnNpb25JbmRleCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgLy8g0JrQvdC+0L/QutCwINGD0LTQsNC70LXQvdC40Y8gKNGB0LrRgNGL0LLQsNC10Lwg0LTQu9GPINC+0LHRj9C30LDRgtC10LvRjNC90YvRhSDQv9C10YDQtdC80LXQvdC90YvRhSlcclxuICAgICAgICAgICAgbGV0IHJlbW92ZUJ1dHRvbjogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcclxuICAgICAgICAgICAgaWYgKCFpc1JlcXVpcmVkKSB7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVCdXR0b24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVCdXR0b24uY2xhc3NOYW1lID0gJ3ZlcnNpb24tY29udGFpbmVyLWl0ZW0tcmVtb3ZlJztcclxuICAgICAgICAgICAgICAgIHJlbW92ZUJ1dHRvbi50ZXh0Q29udGVudCA9ICfDlyc7XHJcbiAgICAgICAgICAgICAgICByZW1vdmVCdXR0b24udGl0bGUgPSAn0KPQtNCw0LvQuNGC0Ywg0L/QtdGA0LXQvNC10L3QvdGD0Y4g0LjQtyDQstC10YDRgdC40LgnO1xyXG4gICAgICAgICAgICAgICAgcmVtb3ZlQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh2ZXJzaW9uc1t2ZXJzaW9uSW5kZXhdKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRlbGV0ZSB2ZXJzaW9uc1t2ZXJzaW9uSW5kZXhdW3ZhcmlhYmxlTmFtZV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMubWFya1ZlcnNpb25zQXNDaGFuZ2VkKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVZlcnNpb25FZGl0b3IoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdmFsdWVDb250YWluZXIuYXBwZW5kQ2hpbGQodmFsdWVEaXNwbGF5KTtcclxuICAgICAgICAgICAgdmFsdWVDb250YWluZXIuYXBwZW5kQ2hpbGQoZWRpdEJ1dHRvbik7XHJcblxyXG4gICAgICAgICAgICBpdGVtLmFwcGVuZENoaWxkKG5hbWVTcGFuKTtcclxuICAgICAgICAgICAgaXRlbS5hcHBlbmRDaGlsZCh2YWx1ZUNvbnRhaW5lcik7XHJcbiAgICAgICAgICAgIGlmIChyZW1vdmVCdXR0b24pIHtcclxuICAgICAgICAgICAgICAgIGl0ZW0uYXBwZW5kQ2hpbGQocmVtb3ZlQnV0dG9uKTtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgcmV0dXJuIGl0ZW07XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L/QvtC60LDQt9CwINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINC00L7QsdCw0LLQu9C10L3QuNGPINCy0LXRgNGB0LjQuFxyXG4gICAgICAgIHNob3dBZGRWZXJzaW9uTW9kYWwoKSB7XHJcbiAgICAgICAgICAgIGNvcHlWZXJzaW9uSW5kZXggPSBudWxsO1xyXG4gICAgICAgICAgICByZW5hbWVWZXJzaW9uSW5kZXggPSBudWxsO1xyXG4gICAgICAgICAgICBjb25zdCBtb2RhbCA9IHRoaXMuJC5hZGRWZXJzaW9uTW9kYWwgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IG1vZGFsVGl0bGUgPSBtb2RhbC5xdWVyeVNlbGVjdG9yKCcud2FybmluZy1oZWFkZXIgaDMnKSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLiQuYWRkVmVyc2lvbklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvbmZpcm1CdXR0b24gPSB0aGlzLiQuYWRkVmVyc2lvbkNvbmZpcm0gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChtb2RhbCAmJiBpbnB1dCAmJiBtb2RhbFRpdGxlICYmIGNvbmZpcm1CdXR0b24pIHtcclxuICAgICAgICAgICAgICAgIG1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAnQWRkIE5ldyBWZXJzaW9uJztcclxuICAgICAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSAnQWRkJztcclxuICAgICAgICAgICAgICAgIG1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICAgICAgaW5wdXQudmFsdWUgPSAnJztcclxuICAgICAgICAgICAgICAgIGlucHV0LmZvY3VzKCk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQv9C+0LrQsNC30LAg0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0LrQvtC/0LjRgNC+0LLQsNC90LjRjyDQstC10YDRgdC40LhcclxuICAgICAgICBzaG93Q29weVZlcnNpb25Nb2RhbChpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIGNvcHlWZXJzaW9uSW5kZXggPSBpbmRleDtcclxuICAgICAgICAgICAgcmVuYW1lVmVyc2lvbkluZGV4ID0gbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmVyc2lvbk1vZGFsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBtb2RhbFRpdGxlID0gbW9kYWwucXVlcnlTZWxlY3RvcignLndhcm5pbmctaGVhZGVyIGgzJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gdGhpcy4kLmFkZFZlcnNpb25JbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBjb25maXJtQnV0dG9uID0gdGhpcy4kLmFkZFZlcnNpb25Db25maXJtIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAobW9kYWwgJiYgaW5wdXQgJiYgbW9kYWxUaXRsZSAmJiBjb25maXJtQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25zW2luZGV4XT8ubmFtZSB8fCB2ZXJzaW9uc1tpbmRleF0/LnZlcnNpb24gfHwgYFZlcnNpb24gJHtpbmRleCArIDF9YDtcclxuICAgICAgICAgICAgICAgIG1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAnQ29weSBWZXJzaW9uJztcclxuICAgICAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSAnQ29weSc7XHJcbiAgICAgICAgICAgICAgICBtb2RhbC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcclxuICAgICAgICAgICAgICAgIGlucHV0LnZhbHVlID0gYCR7dmVyc2lvbk5hbWV9X2NvcHlgO1xyXG4gICAgICAgICAgICAgICAgaW5wdXQuZm9jdXMoKTtcclxuICAgICAgICAgICAgICAgIGlucHV0LnNlbGVjdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L/QvtC60LDQt9CwINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINC/0LXRgNC10LjQvNC10L3QvtCy0LDQvdC40Y8g0LLQtdGA0YHQuNC4XHJcbiAgICAgICAgc2hvd1JlbmFtZVZlcnNpb25Nb2RhbChpbmRleDogbnVtYmVyKSB7XHJcbiAgICAgICAgICAgIHJlbmFtZVZlcnNpb25JbmRleCA9IGluZGV4O1xyXG4gICAgICAgICAgICBjb3B5VmVyc2lvbkluZGV4ID0gbnVsbDtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmVyc2lvbk1vZGFsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBtb2RhbFRpdGxlID0gbW9kYWwucXVlcnlTZWxlY3RvcignLndhcm5pbmctaGVhZGVyIGgzJykgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGlucHV0ID0gdGhpcy4kLmFkZFZlcnNpb25JbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBjb25maXJtQnV0dG9uID0gdGhpcy4kLmFkZFZlcnNpb25Db25maXJtIGFzIEhUTUxCdXR0b25FbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAobW9kYWwgJiYgaW5wdXQgJiYgbW9kYWxUaXRsZSAmJiBjb25maXJtQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uTmFtZSA9IHZlcnNpb25zW2luZGV4XT8ubmFtZSB8fCB2ZXJzaW9uc1tpbmRleF0/LnZlcnNpb24gfHwgYFZlcnNpb24gJHtpbmRleCArIDF9YDtcclxuICAgICAgICAgICAgICAgIG1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAnUmVuYW1lIFZlcnNpb24nO1xyXG4gICAgICAgICAgICAgICAgY29uZmlybUJ1dHRvbi50ZXh0Q29udGVudCA9ICdSZW5hbWUnO1xyXG4gICAgICAgICAgICAgICAgbW9kYWwuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgICAgICBpbnB1dC52YWx1ZSA9IHZlcnNpb25OYW1lO1xyXG4gICAgICAgICAgICAgICAgaW5wdXQuZm9jdXMoKTtcclxuICAgICAgICAgICAgICAgIGlucHV0LnNlbGVjdCgpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0YHQutGA0YvRgtC40Y8g0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0LTQvtCx0LDQstC70LXQvdC40Y8g0LLQtdGA0YHQuNC4XHJcbiAgICAgICAgaGlkZUFkZFZlcnNpb25Nb2RhbCgpIHtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmVyc2lvbk1vZGFsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBpZiAobW9kYWwpIHtcclxuICAgICAgICAgICAgICAgIG1vZGFsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICAgICAgY29weVZlcnNpb25JbmRleCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICByZW5hbWVWZXJzaW9uSW5kZXggPSBudWxsO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0LTQvtCx0LDQstC70LXQvdC40Y8g0L3QvtCy0L7QuSDQstC10YDRgdC40LhcclxuICAgICAgICBhZGROZXdWZXJzaW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaW5wdXQgPSB0aGlzLiQuYWRkVmVyc2lvbklucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWlucHV0KSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmFtZVZlcnNpb25JbmRleCAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dSZW5hbWVWZXJzaW9uTW9kYWwocmVuYW1lVmVyc2lvbkluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKGNvcHlWZXJzaW9uSW5kZXggIT09IG51bGwpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93Q29weVZlcnNpb25Nb2RhbChjb3B5VmVyc2lvbkluZGV4KTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dBZGRWZXJzaW9uTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb25OYW1lID0gaW5wdXQudmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHZlcnNpb25OYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlbmFtZVZlcnNpb25JbmRleCAhPT0gbnVsbCAmJiByZW5hbWVWZXJzaW9uSW5kZXggPj0gMCAmJiByZW5hbWVWZXJzaW9uSW5kZXggPCB2ZXJzaW9ucy5sZW5ndGgpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J/QtdGA0LXQuNC80LXQvdC+0LLRi9Cy0LDQtdC8INCy0LXRgNGB0LjRjlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0gdmVyc2lvbnNbcmVuYW1lVmVyc2lvbkluZGV4XTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3Qgb2xkTmFtZSA9IHZlcnNpb24ubmFtZSB8fCB2ZXJzaW9uLnZlcnNpb24gfHwgYFZlcnNpb24gJHtyZW5hbWVWZXJzaW9uSW5kZXggKyAxfWA7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINC90LUg0YHRg9GJ0LXRgdGC0LLRg9C10YIg0LvQuCDRg9C20LUg0LLQtdGA0YHQuNGPINGBINGC0LDQutC40Lwg0LjQvNC10L3QtdC8ICjQutGA0L7QvNC1INGC0LXQutGD0YnQtdC5KVxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBleGlzdGluZ1ZlcnNpb24gPSB2ZXJzaW9ucy5maW5kKCh2LCBpZHgpID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZHggIT09IHJlbmFtZVZlcnNpb25JbmRleCAmJiAodi5uYW1lID09PSB2ZXJzaW9uTmFtZSB8fCB2LnZlcnNpb24gPT09IHZlcnNpb25OYW1lKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZXhpc3RpbmdWZXJzaW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgVmVyc2lvbiB3aXRoIG5hbWUgXCIke3ZlcnNpb25OYW1lfVwiIGFscmVhZHkgZXhpc3RzYCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnB1dC5mb2N1cygpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXQuc2VsZWN0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQuNC80Y8g0LLQtdGA0YHQuNC4XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb24ubmFtZSA9IHZlcnNpb25OYW1lO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmVyc2lvbi52ZXJzaW9uKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZWxldGUgdmVyc2lvbi52ZXJzaW9uO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwgc2VsZWN0ZWRWZXJzaW9uTmFtZSwg0LXRgdC70Lgg0L/QtdGA0LXQuNC80LXQvdC+0LLRi9Cy0LDQtdGC0YHRjyDQstGL0LHRgNCw0L3QvdCw0Y8g0LLQtdGA0YHQuNGPXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzZWxlY3RlZFZlcnNpb25OYW1lID09PSBvbGROYW1lKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZWxlY3RlZFZlcnNpb25OYW1lID0gdmVyc2lvbk5hbWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBWZXJzaW9uIFwiJHtvbGROYW1lfVwiIHJlbmFtZWQgdG8gXCIke3ZlcnNpb25OYW1lfVwiIHN1Y2Nlc3NmdWxseWAsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlbmFtZVZlcnNpb25JbmRleCA9IG51bGw7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmIChjb3B5VmVyc2lvbkluZGV4ICE9PSBudWxsICYmIGNvcHlWZXJzaW9uSW5kZXggPj0gMCAmJiBjb3B5VmVyc2lvbkluZGV4IDwgdmVyc2lvbnMubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCa0L7Qv9C40YDRg9C10Lwg0LLQtdGA0YHQuNGOXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IG9yaWdpbmFsVmVyc2lvbiA9IHZlcnNpb25zW2NvcHlWZXJzaW9uSW5kZXhdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdWZXJzaW9uOiBhbnkgPSB7IC4uLm9yaWdpbmFsVmVyc2lvbiB9O1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdWZXJzaW9uLm5hbWUgPSB2ZXJzaW9uTmFtZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMucHVzaChuZXdWZXJzaW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYFZlcnNpb24gXCIke3ZlcnNpb25OYW1lfVwiIGNvcGllZCBzdWNjZXNzZnVsbHkgZnJvbSBcIiR7b3JpZ2luYWxWZXJzaW9uLm5hbWUgfHwgb3JpZ2luYWxWZXJzaW9uLnZlcnNpb259XCJgLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb3B5VmVyc2lvbkluZGV4ID0gbnVsbDtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDQodC+0LfQtNCw0LXQvCDQvdC+0LLRg9GOINCy0LXRgNGB0LjRjlxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBuZXdWZXJzaW9uOiBhbnkgPSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBuYW1lOiB2ZXJzaW9uTmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHByb2Q6IHRydWVcclxuICAgICAgICAgICAgICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC+0LHRj9C30LDRgtC10LvRjNC90YvQtSDQv9C10YDQtdC80LXQvdC90YvQtSDQuNC3INC60L7QvdGE0LjQs9CwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChyZXF1aXJlZFZhcmlhYmxlcyAmJiBPYmplY3Qua2V5cyhyZXF1aXJlZFZhcmlhYmxlcykubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXMocmVxdWlyZWRWYXJpYWJsZXMpLmZvckVhY2godmFyTmFtZSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmV3VmVyc2lvblt2YXJOYW1lXSA9IHJlcXVpcmVkVmFyaWFibGVzW3Zhck5hbWVdO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMucHVzaChuZXdWZXJzaW9uKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYFZlcnNpb24gXCIke3ZlcnNpb25OYW1lfVwiIGFkZGVkIHN1Y2Nlc3NmdWxseWAsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0YDQuNC80LXQvdGP0LXQvCDQvtCx0Y/Qt9Cw0YLQtdC70YzQvdGL0LUg0L/QtdGA0LXQvNC10L3QvdGL0LUg0LrQviDQstGB0LXQvCDQstC10YDRgdC40Y/QvCAo0L3QsCDRgdC70YPRh9Cw0LksINC10YHQu9C4INC+0L3QuCDQuNC30LzQtdC90LjQu9C40YHRjClcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGx5UmVxdWlyZWRWYXJpYWJsZXMoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLm1hcmtWZXJzaW9uc0FzQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZUFkZFZlcnNpb25Nb2RhbCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuZGlzcGxheVZlcnNpb25FZGl0b3IoKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1ZlcnNpb24gbmFtZSBjYW5ub3QgYmUgZW1wdHknLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICBpbnB1dC5mb2N1cygpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIGFkZGluZy9jb3B5aW5nL3JlbmFtaW5nIHZlcnNpb246ICR7ZXJyb3J9YCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQv9C+0LrQsNC30LAg0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0LTQvtCx0LDQstC70LXQvdC40Y8g0L/QtdGA0LXQvNC10L3QvdC+0LlcclxuICAgICAgICBzaG93QWRkVmFyaWFibGVNb2RhbCgpIHtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmFyaWFibGVNb2RhbCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy53YXJuaW5nLWhlYWRlciBoMycpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lSW5wdXQgPSB0aGlzLiQuYWRkVmFyaWFibGVOYW1lSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgdmFsdWVJbnB1dCA9IHRoaXMuJC5hZGRWYXJpYWJsZVZhbHVlSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IHRoaXMuJC5hZGRWYXJpYWJsZUNvbmZpcm0gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChtb2RhbCAmJiBuYW1lSW5wdXQgJiYgdmFsdWVJbnB1dCAmJiBtb2RhbFRpdGxlICYmIGNvbmZpcm1CdXR0b24pIHtcclxuICAgICAgICAgICAgICAgIG1vZGFsVGl0bGUudGV4dENvbnRlbnQgPSAnQWRkIE5ldyBWYXJpYWJsZSc7XHJcbiAgICAgICAgICAgICAgICBjb25maXJtQnV0dG9uLnRleHRDb250ZW50ID0gJ0FkZCc7XHJcbiAgICAgICAgICAgICAgICBuYW1lSW5wdXQudmFsdWUgPSAnJztcclxuICAgICAgICAgICAgICAgIHZhbHVlSW5wdXQudmFsdWUgPSAnJztcclxuICAgICAgICAgICAgICAgIG5hbWVJbnB1dC5kaXNhYmxlZCA9IGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgbmFtZUlucHV0LmZvY3VzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0YTQu9Cw0LPQuCDRgNC10LTQsNC60YLQuNGA0L7QstCw0L3QuNGPXHJcbiAgICAgICAgICAgICAgICBkZWxldGUgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmFyaWFibGU7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmVyc2lvbkluZGV4O1xyXG5cclxuICAgICAgICAgICAgICAgIG1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0YHQutGA0YvRgtC40Y8g0LzQvtC00LDQu9GM0L3QvtCz0L4g0L7QutC90LAg0LTQvtCx0LDQstC70LXQvdC40Y8g0L/QtdGA0LXQvNC10L3QvdC+0LlcclxuICAgICAgICBoaWRlQWRkVmFyaWFibGVNb2RhbCgpIHtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmFyaWFibGVNb2RhbCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgbmFtZUlucHV0ID0gdGhpcy4kLmFkZFZhcmlhYmxlTmFtZUlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgIGlmIChtb2RhbCkge1xyXG4gICAgICAgICAgICAgICAgLy8g0J7Rh9C40YnQsNC10Lwg0YTQu9Cw0LMg0YDQtdC00LDQutGC0LjRgNC+0LLQsNC90LjRjyDQuCDRgNCw0LfQsdC70L7QutC40YDRg9C10LwgaW5wdXRcclxuICAgICAgICAgICAgICAgIGRlbGV0ZSBtb2RhbC5kYXRhc2V0LmVkaXRpbmdWYXJpYWJsZTtcclxuICAgICAgICAgICAgICAgIGlmIChuYW1lSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lSW5wdXQuZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIG1vZGFsLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L/QvtC60LDQt9CwINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINGA0LXQtNCw0LrRgtC40YDQvtCy0LDQvdC40Y8g0L/QtdGA0LXQvNC10L3QvdC+0LlcclxuICAgICAgICBzaG93RWRpdFZhcmlhYmxlTW9kYWwodmFyaWFibGVOYW1lOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmFyaWFibGVNb2RhbCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy53YXJuaW5nLWhlYWRlciBoMycpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lSW5wdXQgPSB0aGlzLiQuYWRkVmFyaWFibGVOYW1lSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgdmFsdWVJbnB1dCA9IHRoaXMuJC5hZGRWYXJpYWJsZVZhbHVlSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IHRoaXMuJC5hZGRWYXJpYWJsZUNvbmZpcm0gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICBpZiAobW9kYWwgJiYgbmFtZUlucHV0ICYmIHZhbHVlSW5wdXQgJiYgbW9kYWxUaXRsZSAmJiBjb25maXJtQnV0dG9uKSB7XHJcbiAgICAgICAgICAgICAgICAvLyDQn9C+0LvRg9GH0LDQtdC8INGC0LXQutGD0YnQtdC1INC30L3QsNGH0LXQvdC40LUg0L/QtdGA0LXQvNC10L3QvdC+0LlcclxuICAgICAgICAgICAgICAgIGxldCBjdXJyZW50VmFsdWUgPSB2YXJpYWJsZXNTdG9yYWdlW3ZhcmlhYmxlTmFtZV07XHJcbiAgICAgICAgICAgICAgICBpZiAoY3VycmVudFZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBleGFtcGxlVmVyc2lvbiA9IHZlcnNpb25zLmZpbmQodiA9PiB2YXJpYWJsZU5hbWUgaW4gdik7XHJcbiAgICAgICAgICAgICAgICAgICAgY3VycmVudFZhbHVlID0gZXhhbXBsZVZlcnNpb24gPyBleGFtcGxlVmVyc2lvblt2YXJpYWJsZU5hbWVdIDogJyc7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgbW9kYWxUaXRsZS50ZXh0Q29udGVudCA9ICdFZGl0IFZhcmlhYmxlJztcclxuICAgICAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSAnU2F2ZSc7XHJcbiAgICAgICAgICAgICAgICBuYW1lSW5wdXQudmFsdWUgPSB2YXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgICAgICBuYW1lSW5wdXQuZGlzYWJsZWQgPSB0cnVlOyAvLyDQmNC80Y8g0L/QtdGA0LXQvNC10L3QvdC+0Lkg0L3QtdC70YzQt9GPINGA0LXQtNCw0LrRgtC40YDQvtCy0LDRgtGMXHJcbiAgICAgICAgICAgICAgICB2YWx1ZUlucHV0LnZhbHVlID0gY3VycmVudFZhbHVlICE9PSB1bmRlZmluZWQgPyBTdHJpbmcoY3VycmVudFZhbHVlKSA6ICcnO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVJbnB1dC5mb2N1cygpO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVJbnB1dC5zZWxlY3QoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0LjQvNGPINGA0LXQtNCw0LrRgtC40YDRg9C10LzQvtC5INC/0LXRgNC10LzQtdC90L3QvtC5INCyIGRhdGEt0LDRgtGA0LjQsdGD0YLQtVxyXG4gICAgICAgICAgICAgICAgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmFyaWFibGUgPSB2YXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgICAgICBkZWxldGUgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmVyc2lvbkluZGV4OyAvLyDQntGH0LjRidCw0LXQvCDRhNC70LDQsyDRgNC10LTQsNC60YLQuNGA0L7QstCw0L3QuNGPINCy0LXRgNGB0LjQuFxyXG5cclxuICAgICAgICAgICAgICAgIG1vZGFsLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0L/QvtC60LDQt9CwINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINGA0LXQtNCw0LrRgtC40YDQvtCy0LDQvdC40Y8g0L/QtdGA0LXQvNC10L3QvdC+0Lkg0LIg0LLQtdGA0YHQuNC4XHJcbiAgICAgICAgc2hvd0VkaXRWZXJzaW9uVmFyaWFibGVNb2RhbCh2YXJpYWJsZU5hbWU6IHN0cmluZywgdmVyc2lvbkluZGV4OiBudW1iZXIpIHtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWwgPSB0aGlzLiQuYWRkVmFyaWFibGVNb2RhbCBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgbW9kYWxUaXRsZSA9IG1vZGFsLnF1ZXJ5U2VsZWN0b3IoJy53YXJuaW5nLWhlYWRlciBoMycpIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICBjb25zdCBuYW1lSW5wdXQgPSB0aGlzLiQuYWRkVmFyaWFibGVOYW1lSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgdmFsdWVJbnB1dCA9IHRoaXMuJC5hZGRWYXJpYWJsZVZhbHVlSW5wdXQgYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgY29uc3QgY29uZmlybUJ1dHRvbiA9IHRoaXMuJC5hZGRWYXJpYWJsZUNvbmZpcm0gYXMgSFRNTEJ1dHRvbkVsZW1lbnQ7XHJcblxyXG4gICAgICAgICAgICBpZiAobW9kYWwgJiYgbmFtZUlucHV0ICYmIHZhbHVlSW5wdXQgJiYgbW9kYWxUaXRsZSAmJiBjb25maXJtQnV0dG9uICYmIHZlcnNpb25zW3ZlcnNpb25JbmRleF0pIHtcclxuICAgICAgICAgICAgICAgIC8vINCf0L7Qu9GD0YfQsNC10Lwg0YLQtdC60YPRidC10LUg0LfQvdCw0YfQtdC90LjQtSDQv9C10YDQtdC80LXQvdC90L7QuSDQsiDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgIGNvbnN0IGN1cnJlbnRWYWx1ZSA9IHZlcnNpb25zW3ZlcnNpb25JbmRleF1bdmFyaWFibGVOYW1lXTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb25OYW1lID0gdmVyc2lvbnNbdmVyc2lvbkluZGV4XS5uYW1lIHx8IHZlcnNpb25zW3ZlcnNpb25JbmRleF0udmVyc2lvbiB8fCBgVmVyc2lvbiAke3ZlcnNpb25JbmRleCArIDF9YDtcclxuXHJcbiAgICAgICAgICAgICAgICBtb2RhbFRpdGxlLnRleHRDb250ZW50ID0gYEVkaXQgVmFyaWFibGUgaW4gXCIke3ZlcnNpb25OYW1lfVwiYDtcclxuICAgICAgICAgICAgICAgIGNvbmZpcm1CdXR0b24udGV4dENvbnRlbnQgPSAnU2F2ZSc7XHJcbiAgICAgICAgICAgICAgICBuYW1lSW5wdXQudmFsdWUgPSB2YXJpYWJsZU5hbWU7XHJcbiAgICAgICAgICAgICAgICBuYW1lSW5wdXQuZGlzYWJsZWQgPSB0cnVlOyAvLyDQmNC80Y8g0L/QtdGA0LXQvNC10L3QvdC+0Lkg0L3QtdC70YzQt9GPINGA0LXQtNCw0LrRgtC40YDQvtCy0LDRgtGMXHJcbiAgICAgICAgICAgICAgICB2YWx1ZUlucHV0LnZhbHVlID0gY3VycmVudFZhbHVlICE9PSB1bmRlZmluZWQgPyBTdHJpbmcoY3VycmVudFZhbHVlKSA6ICcnO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVJbnB1dC5mb2N1cygpO1xyXG4gICAgICAgICAgICAgICAgdmFsdWVJbnB1dC5zZWxlY3QoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0LjQvNGPINGA0LXQtNCw0LrRgtC40YDRg9C10LzQvtC5INC/0LXRgNC10LzQtdC90L3QvtC5INC4INC40L3QtNC10LrRgSDQstC10YDRgdC40Lgg0LIgZGF0YS3QsNGC0YDQuNCx0YPRgtCw0YVcclxuICAgICAgICAgICAgICAgIG1vZGFsLmRhdGFzZXQuZWRpdGluZ1ZhcmlhYmxlID0gdmFyaWFibGVOYW1lO1xyXG4gICAgICAgICAgICAgICAgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmVyc2lvbkluZGV4ID0gU3RyaW5nKHZlcnNpb25JbmRleCk7XHJcblxyXG4gICAgICAgICAgICAgICAgbW9kYWwuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvLyDQnNC10YLQvtC0INC00LvRjyDQtNC+0LHQsNCy0LvQtdC90LjRjyDQvdC+0LLQvtC5INC/0LXRgNC10LzQtdC90L3QvtC5XHJcbiAgICAgICAgYWRkTmV3VmFyaWFibGUoKSB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBtb2RhbCA9IHRoaXMuJC5hZGRWYXJpYWJsZU1vZGFsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbmFtZUlucHV0ID0gdGhpcy4kLmFkZFZhcmlhYmxlTmFtZUlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZUlucHV0ID0gdGhpcy4kLmFkZFZhcmlhYmxlVmFsdWVJbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgaWYgKCFuYW1lSW5wdXQgfHwgIXZhbHVlSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dBZGRWYXJpYWJsZU1vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCwg0YDQtdC00LDQutGC0LjRgNGD0LXQvCDQu9C4INC80Ysg0YHRg9GJ0LXRgdGC0LLRg9GO0YnRg9GOINC/0LXRgNC10LzQtdC90L3Rg9GOXHJcbiAgICAgICAgICAgICAgICBjb25zdCBlZGl0aW5nVmFyaWFibGUgPSBtb2RhbC5kYXRhc2V0LmVkaXRpbmdWYXJpYWJsZTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGVkaXRpbmdWZXJzaW9uSW5kZXggPSBtb2RhbC5kYXRhc2V0LmVkaXRpbmdWZXJzaW9uSW5kZXg7XHJcblxyXG4gICAgICAgICAgICAgICAgaWYgKGVkaXRpbmdWYXJpYWJsZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhcmlhYmxlTmFtZSA9IGVkaXRpbmdWYXJpYWJsZTtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZVN0ciA9IHZhbHVlSW5wdXQudmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCB0eXBlZFZhbHVlOiBhbnkgPSB2YWx1ZVN0cjtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/Ri9GC0LDQtdC80YHRjyDQvtC/0YDQtdC00LXQu9C40YLRjCDRgtC40L8g0LfQvdCw0YfQtdC90LjRj1xyXG4gICAgICAgICAgICAgICAgICAgIGlmICh2YWx1ZVN0ciA9PT0gJ3RydWUnIHx8IHZhbHVlU3RyID09PSAnZmFsc2UnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGVkVmFsdWUgPSB2YWx1ZVN0ciA9PT0gJ3RydWUnO1xyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIWlzTmFOKE51bWJlcih2YWx1ZVN0cikpICYmIHZhbHVlU3RyICE9PSAnJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlZFZhbHVlID0gTnVtYmVyKHZhbHVlU3RyKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyID09PSAnJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlZFZhbHVlID0gJyc7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoZWRpdGluZ1ZlcnNpb25JbmRleCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCg0LXQttC40Lwg0YDQtdC00LDQutGC0LjRgNC+0LLQsNC90LjRjyDQv9C10YDQtdC80LXQvdC90L7QuSDQsiDQutC+0L3QutGA0LXRgtC90L7QuSDQstC10YDRgdC40LhcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkluZGV4ID0gcGFyc2VJbnQoZWRpdGluZ1ZlcnNpb25JbmRleCwgMTApO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodmVyc2lvbnNbdmVyc2lvbkluZGV4XSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnNbdmVyc2lvbkluZGV4XVt2YXJpYWJsZU5hbWVdID0gdHlwZWRWYWx1ZTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHZlcnNpb25OYW1lID0gdmVyc2lvbnNbdmVyc2lvbkluZGV4XS5uYW1lIHx8IHZlcnNpb25zW3ZlcnNpb25JbmRleF0udmVyc2lvbiB8fCBgVmVyc2lvbiAke3ZlcnNpb25JbmRleCArIDF9YDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBWYXJpYWJsZSBcIiR7dmFyaWFibGVOYW1lfVwiIGluIHZlcnNpb24gXCIke3ZlcnNpb25OYW1lfVwiIHVwZGF0ZWQgc3VjY2Vzc2Z1bGx5YCwgJ3N1Y2Nlc3MnKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCg0LXQttC40Lwg0YDQtdC00LDQutGC0LjRgNC+0LLQsNC90LjRjyDQtNC10YTQvtC70YLQvdC+0LPQviDQt9C90LDRh9C10L3QuNGPINC/0LXRgNC10LzQtdC90L3QvtC5XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQt9C90LDRh9C10L3QuNC1INCyINGF0YDQsNC90LjQu9C40YnQtVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNTdG9yYWdlW3ZhcmlhYmxlTmFtZV0gPSB0eXBlZFZhbHVlO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INC30L3QsNGH0LXQvdC40LUg0LLQviDQstGB0LXRhSDQstC10YDRgdC40Y/RhSwg0LPQtNC1INC40YHQv9C+0LvRjNC30YPQtdGC0YHRjyDRjdGC0LAg0L/QtdGA0LXQvNC10L3QvdCw0Y9cclxuICAgICAgICAgICAgICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCh2ZXJzaW9uT2JqID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh2YXJpYWJsZU5hbWUgaW4gdmVyc2lvbk9iaikge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb25PYmpbdmFyaWFibGVOYW1lXSA9IHR5cGVkVmFsdWU7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYFZhcmlhYmxlIFwiJHt2YXJpYWJsZU5hbWV9XCIgdXBkYXRlZCBzdWNjZXNzZnVsbHlgLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrVmVyc2lvbnNBc0NoYW5nZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhpZGVBZGRWYXJpYWJsZU1vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDRhNC70LDQs9C4INGA0LXQtNCw0LrRgtC40YDQvtCy0LDQvdC40Y9cclxuICAgICAgICAgICAgICAgICAgICBkZWxldGUgbW9kYWwuZGF0YXNldC5lZGl0aW5nVmFyaWFibGU7XHJcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIG1vZGFsLmRhdGFzZXQuZWRpdGluZ1ZlcnNpb25JbmRleDtcclxuICAgICAgICAgICAgICAgICAgICBuYW1lSW5wdXQuZGlzYWJsZWQgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0KDQtdC20LjQvCDQtNC+0LHQsNCy0LvQtdC90LjRjyDQvdC+0LLQvtC5INC/0LXRgNC10LzQtdC90L3QvtC5XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFyaWFibGVOYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIXZhcmlhYmxlTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnVmFyaWFibGUgbmFtZSBjYW5ub3QgYmUgZW1wdHknLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZUlucHV0LmZvY3VzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCwg0L3QtSDRgdGD0YnQtdGB0YLQstGD0LXRgiDQu9C4INGD0LbQtSDRgtCw0LrQsNGPINC/0LXRgNC10LzQtdC90L3QsNGPICjQsiDRhdGA0LDQvdC40LvQuNGJ0LUg0LjQu9C4INCyINCy0LXRgNGB0LjRj9GFKVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFsbFZhcmlhYmxlcyA9IHRoaXMuZ2V0QWxsVmFyaWFibGVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKGFsbFZhcmlhYmxlcy5oYXModmFyaWFibGVOYW1lKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgVmFyaWFibGUgXCIke3ZhcmlhYmxlTmFtZX1cIiBhbHJlYWR5IGV4aXN0c2AsICdlcnJvcicpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lSW5wdXQuZm9jdXMoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZUlucHV0LnNlbGVjdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9C+0LvRg9GH0LDQtdC8INC30L3QsNGH0LXQvdC40LUg0L/QtdGA0LXQvNC10L3QvdC+0LlcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCB2YWx1ZVN0ciA9IHZhbHVlSW5wdXQudmFsdWUudHJpbSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGxldCBkZWZhdWx0VmFsdWU6IGFueSA9IHZhbHVlU3RyO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9GL0YLQsNC10LzRgdGPINC+0L/RgNC10LTQtdC70LjRgtGMINGC0LjQvyDQt9C90LDRh9C10L3QuNGPXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlU3RyID09PSAndHJ1ZScgfHwgdmFsdWVTdHIgPT09ICdmYWxzZScpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlID0gdmFsdWVTdHIgPT09ICd0cnVlJztcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFpc05hTihOdW1iZXIodmFsdWVTdHIpKSAmJiB2YWx1ZVN0ciAhPT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgZGVmYXVsdFZhbHVlID0gTnVtYmVyKHZhbHVlU3RyKTtcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlU3RyID09PSAnJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBkZWZhdWx0VmFsdWUgPSAnJztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQv9C10YDQtdC80LXQvdC90YPRjiDQsiDRhdGA0LDQvdC40LvQuNGJ0LVcclxuICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNTdG9yYWdlW3ZhcmlhYmxlTmFtZV0gPSBkZWZhdWx0VmFsdWU7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKGBWYXJpYWJsZSBcIiR7dmFyaWFibGVOYW1lfVwiIGFkZGVkIHN1Y2Nlc3NmdWxseSB0byB2YXJpYWJsZXMgc3RvcmFnZWAsICdzdWNjZXNzJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXJrVmVyc2lvbnNBc0NoYW5nZWQoKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmhpZGVBZGRWYXJpYWJsZU1vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIGFkZGluZy9lZGl0aW5nIHZhcmlhYmxlOiAke2Vycm9yfWAsICdlcnJvcicpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLy8g0JzQtdGC0L7QtCDQtNC70Y8g0YHQvtGF0YDQsNC90LXQvdC40Y8g0LLQtdGA0YHQuNC5INCyINGE0LDQudC7XHJcbiAgICAgICAgc2F2ZVZlcnNpb25zKCkge1xyXG4gICAgICAgICAgICAvLyDQn9GA0LXQtNC+0YLQstGA0LDRidCw0LXQvCDQvNC90L7QttC10YHRgtCy0LXQvdC90YvQtSDQvtC00L3QvtCy0YDQtdC80LXQvdC90YvQtSDRgdC+0YXRgNCw0L3QtdC90LjRj1xyXG4gICAgICAgICAgICBpZiAoaXNTYXZpbmcpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgICAgIGlzU2F2aW5nID0gdHJ1ZTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQn9C10YDQtdC0INGB0L7RhdGA0LDQvdC10L3QuNC10Lwg0LPQsNGA0LDQvdGC0LjRgNGD0LXQvCDQvdCw0LvQuNGH0LjQtSDQvtCx0Y/Qt9Cw0YLQtdC70YzQvdGL0YUg0L/QtdGA0LXQvNC10L3QvdGL0YUg0LLQviDQstGB0LXRhSDQstC10YDRgdC40Y/RhVxyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBseVJlcXVpcmVkVmFyaWFibGVzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgY29uc3QgcHJvamVjdFBhdGggPSBqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdmVyc2lvbkZpbGVQYXRoID0gam9pbihwcm9qZWN0UGF0aCwgJ3ZlcnNpb25zLmNqcycpO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghZXhpc3RzU3luYyh2ZXJzaW9uRmlsZVBhdGgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYHZlcnNpb25zLmNqcyBmaWxlIG5vdCBmb3VuZDogJHt2ZXJzaW9uRmlsZVBhdGh9YCwgJ2Vycm9yJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgaXNTYXZpbmcgPSBmYWxzZTtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0KfQuNGC0LDQtdC8INC+0YDQuNCz0LjQvdCw0LvRjNC90YvQuSDRhNCw0LnQuyDQtNC70Y8g0YHQvtGF0YDQsNC90LXQvdC40Y8gbGFuZ3VhZ2Ug0Lgg0LrQvtC80LzQtdC90YLQsNGA0LjQtdCyXHJcbiAgICAgICAgICAgICAgICBjb25zdCBvcmlnaW5hbENvbnRlbnQgPSByZWFkRmlsZVN5bmModmVyc2lvbkZpbGVQYXRoLCAndXRmLTgnKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGxhbmd1YWdlTWF0Y2ggPSBvcmlnaW5hbENvbnRlbnQubWF0Y2goL3ZlcnNpb25zXFwubGFuZ3VhZ2VcXHMqPVxccypbJ1wiXShbXidcIl0rKVsnXCJdLyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBsYW5ndWFnZSA9IGxhbmd1YWdlTWF0Y2ggPyBsYW5ndWFnZU1hdGNoWzFdIDogJ2VuJztcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQmNC30LLQu9C10LrQsNC10Lwg0LrQvtC80LzQtdC90YLQsNGA0LjQuCDQv9C+0YHQu9C1IG1vZHVsZS5leHBvcnRzXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb21tZW50c01hdGNoID0gb3JpZ2luYWxDb250ZW50Lm1hdGNoKC9tb2R1bGVcXC5leHBvcnRzXFxzKj1cXHMqdmVyc2lvbnM7XFxzKihbXFxzXFxTXSopJC8pO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29tbWVudHMgPSBjb21tZW50c01hdGNoID8gY29tbWVudHNNYXRjaFsxXSA6ICcnO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCk0L7RgNC80LjRgNGD0LXQvCDRgdC+0LTQtdGA0LbQuNC80L7QtSDRhNCw0LnQu9CwXHJcbiAgICAgICAgICAgICAgICBsZXQgZmlsZUNvbnRlbnQgPSAnbGV0IHZlcnNpb25zID0gW1xcbic7XHJcblxyXG4gICAgICAgICAgICAgICAgdmVyc2lvbnMuZm9yRWFjaCgodmVyc2lvbiwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSAnICAgIHtcXG4nO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCh0L7RgNGC0LjRgNGD0LXQvCDQutC70Y7Rh9C4LCDRh9GC0L7QsdGLIG5hbWUg0LHRi9C7INC/0LXRgNCy0YvQvFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyh2ZXJzaW9uKS5zb3J0KChhLCBiKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChhID09PSAnbmFtZScgfHwgYSA9PT0gJ3ZlcnNpb24nKSByZXR1cm4gLTE7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChiID09PSAnbmFtZScgfHwgYiA9PT0gJ3ZlcnNpb24nKSByZXR1cm4gMTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGEubG9jYWxlQ29tcGFyZShiKTtcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgICAgICBrZXlzLmZvckVhY2goKGtleSwga2V5SW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB2ZXJzaW9uW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZVN0ciA9ICcnO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCt0LrRgNCw0L3QuNGA0YPQtdC8INC60LDQstGL0YfQutC4INCyINGB0YLRgNC+0LrQsNGFXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBlc2NhcGVkVmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cIi9nLCAnXFxcXFwiJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0ciA9IGBcIiR7ZXNjYXBlZFZhbHVlfVwiYDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVTdHIgPSBTdHJpbmcodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyID0gU3RyaW5nKHZhbHVlKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0ciA9ICdudWxsJztcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyID0gSlNPTi5zdHJpbmdpZnkodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSBgICAgICAgICAke2tleX06ICR7dmFsdWVTdHJ9YDtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGtleUluZGV4IDwga2V5cy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSAnLCc7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJ1xcbic7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJyAgICB9JztcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaW5kZXggPCB2ZXJzaW9ucy5sZW5ndGggLSAxKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9ICcsJztcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJ1xcbic7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSAnXTtcXG4nO1xyXG4gICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gYHZlcnNpb25zLmxhbmd1YWdlID0gJyR7bGFuZ3VhZ2V9JztcXG5gO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDQstGL0LHRgNCw0L3QvdGD0Y4g0LLQtdGA0YHQuNGOXHJcbiAgICAgICAgICAgICAgICBpZiAoc2VsZWN0ZWRWZXJzaW9uTmFtZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9IGB2ZXJzaW9ucy5zZWxlY3RlZFZlcnNpb24gPSAnJHtzZWxlY3RlZFZlcnNpb25OYW1lLnJlcGxhY2UoLycvZywgXCJcXFxcJ1wiKX0nO1xcbmA7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSAnXFxuJztcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQo9Cx0LXQttC00LDQtdC80YHRjywg0YfRgtC+INCy0YHQtSDQv9C10YDQtdC80LXQvdC90YvQtSDQuNC3INCy0LXRgNGB0LjQuSDQtdGB0YLRjCDQsiDRhdGA0LDQvdC40LvQuNGJ0LVcclxuICAgICAgICAgICAgICAgIHZlcnNpb25zLmZvckVhY2godmVyc2lvbiA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgT2JqZWN0LmtleXModmVyc2lvbikuZm9yRWFjaChrZXkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoa2V5ICE9PSAnbmFtZScgJiYga2V5ICE9PSAndmVyc2lvbicgJiYgIShrZXkgaW4gdmFyaWFibGVzU3RvcmFnZSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQv9C10YDQtdC80LXQvdC90YPRjiDQsiDRhdGA0LDQvdC40LvQuNGJ0LUg0YEg0LTQtdGE0L7Qu9GC0L3Ri9C8INC30L3QsNGH0LXQvdC40LXQvCDQuNC3INCy0LXRgNGB0LjQuFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFyaWFibGVzU3RvcmFnZVtrZXldID0gdmVyc2lvbltrZXldO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0YXRgNCw0L3QuNC70LjRidC1INC/0LXRgNC10LzQtdC90L3Ri9GFXHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YXJpYWJsZXNLZXlzID0gT2JqZWN0LmtleXModmFyaWFibGVzU3RvcmFnZSk7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFyaWFibGVzS2V5cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJy8vIFZhcmlhYmxlcyBzdG9yYWdlIHdpdGggZGVmYXVsdCB2YWx1ZXNcXG4nO1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9ICd2ZXJzaW9ucy52YXJpYWJsZXMgPSB7XFxuJztcclxuICAgICAgICAgICAgICAgICAgICB2YXJpYWJsZXNLZXlzLmZvckVhY2goKGtleSwgaW5kZXgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSB2YXJpYWJsZXNTdG9yYWdlW2tleV07XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGxldCB2YWx1ZVN0ciA9ICcnO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGVzY2FwZWRWYWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyID0gYFwiJHtlc2NhcGVkVmFsdWV9XCJgO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ2Jvb2xlYW4nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZVN0ciA9IFN0cmluZyh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVTdHIgPSBTdHJpbmcodmFsdWUpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlU3RyID0gJ251bGwnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVTdHIgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9IGAgICAgJHtrZXl9OiAke3ZhbHVlU3RyfWA7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChpbmRleCA8IHZhcmlhYmxlc0tleXMubGVuZ3RoIC0gMSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJywnO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9ICdcXG4nO1xyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgICAgIGZpbGVDb250ZW50ICs9ICd9O1xcblxcbic7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgZmlsZUNvbnRlbnQgKz0gJ21vZHVsZS5leHBvcnRzID0gdmVyc2lvbnM7XFxuJztcclxuICAgICAgICAgICAgICAgIGlmIChjb21tZW50cy50cmltKCkpIHtcclxuICAgICAgICAgICAgICAgICAgICBmaWxlQ29udGVudCArPSBjb21tZW50cztcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQl9Cw0L/QuNGB0YvQstCw0LXQvCDRhNCw0LnQu1xyXG4gICAgICAgICAgICAgICAgd3JpdGVGaWxlU3luYyh2ZXJzaW9uRmlsZVBhdGgsIGZpbGVDb250ZW50LCAndXRmLTgnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINCx0YvQu9C+INC70Lgg0Y3RgtC+INCw0LLRgtC+0LzQsNGC0LjRh9C10YHQutC+0LUg0YHQvtGF0YDQsNC90LXQvdC40LVcclxuICAgICAgICAgICAgICAgIGNvbnN0IGF1dG9zYXZlQ2hlY2tib3ggPSB0aGlzLiQuYXV0b3NhdmVDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50O1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaXNBdXRvc2F2ZSA9IGF1dG9zYXZlQ2hlY2tib3ggJiYgYXV0b3NhdmVDaGVja2JveC5jaGVja2VkO1xyXG5cclxuICAgICAgICAgICAgICAgIGlmICghaXNBdXRvc2F2ZSkge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INGB0L7QvtCx0YnQtdC90LjQtSDRgtC+0LvRjNC60L4g0L/RgNC4INGA0YPRh9C90L7QvCDRgdC+0YXRgNCw0L3QtdC90LjQuFxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCdWZXJzaW9ucyBzYXZlZCBzdWNjZXNzZnVsbHknLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDRgtC10LrRg9GJ0LjQtSDQstC10YDRgdC40Lgg0Lgg0YXRgNCw0L3QuNC70LjRidC1INC60LDQuiDQvtGA0LjQs9C40L3QsNC70YzQvdGL0LUg0Lgg0YHQsdGA0LDRgdGL0LLQsNC10Lwg0YTQu9Cw0LMg0LjQt9C80LXQvdC10L3QuNC5XHJcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFZlcnNpb25zID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh2ZXJzaW9ucykpO1xyXG4gICAgICAgICAgICAgICAgb3JpZ2luYWxWYXJpYWJsZXNTdG9yYWdlID0gSlNPTi5wYXJzZShKU09OLnN0cmluZ2lmeSh2YXJpYWJsZXNTdG9yYWdlKSk7XHJcbiAgICAgICAgICAgICAgICBvcmlnaW5hbFNlbGVjdGVkVmVyc2lvbk5hbWUgPSBzZWxlY3RlZFZlcnNpb25OYW1lO1xyXG4gICAgICAgICAgICAgICAgaGFzVW5zYXZlZENoYW5nZXMgPSBmYWxzZTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0L7RgtC+0LHRgNCw0LbQtdC90LjQtVxyXG4gICAgICAgICAgICAgICAgdGhpcy5kaXNwbGF5VmVyc2lvbkVkaXRvcigpO1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEVycm9yIHNhdmluZyB2ZXJzaW9uczogJHtlcnJvcn1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgfSBmaW5hbGx5IHtcclxuICAgICAgICAgICAgICAgIGlzU2F2aW5nID0gZmFsc2U7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICBmaW5hbGl6ZUJ1aWxkKCkge1xyXG4gICAgICAgICAgICAvLyDQlNC+0L/QvtC70L3QuNGC0LXQu9GM0L3QsNGPINC/0YDQvtCy0LXRgNC60LAsINGH0YLQviDQstGB0LUg0L/RgNC+0YbQtdGB0YHRiyDQt9Cw0LLQtdGA0YjQtdC90YtcclxuICAgICAgICAgICAgaWYgKHJ1bm5pbmdQcm9jZXNzZXMubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYFdhcm5pbmc6ICR7cnVubmluZ1Byb2Nlc3Nlcy5sZW5ndGh9IHByb2Nlc3NlcyBhcmUgc3RpbGwgYWN0aXZlLCB3YWl0aW5nIGZvciBjb21wbGV0aW9uLi4uYCwgJ3dhcm4nKTtcclxuICAgICAgICAgICAgICAgIHRoaXMud2FpdEZvckFsbFByb2Nlc3Nlc1RvQ29tcGxldGUoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgdGhpcy50b2dnbGVCdWlsZEJ1dHRvbihmYWxzZSk7XHJcbiAgICAgICAgICAgIC8vIHRoaXMudXBkYXRlU3RhdHVzKCfQk9C+0YLQvtCy0L4nKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCh0L3QsNGH0LDQu9CwINGB0LHRgNCw0YHRi9Cy0LDQtdC8INCy0YHQtSDRgdC+0YHRgtC+0Y/QvdC40Y8g0L/RgNC+0LPRgNC10YHRgdCwINC4INCw0L3QuNC80LDRhtC40LhcclxuICAgICAgICAgICAgdGhpcy5oaWRlQnVpbGRQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgLy8g0JfQsNGC0LXQvCDRgSDQt9Cw0LTQtdGA0LbQutC+0Lkg0YDQsNC30LHQu9C+0LrQuNGA0YPQtdC8INCz0LDQu9C+0YfQutC4XHJcbiAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8g0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LLQutC70Y7Rh9Cw0LXQvCDQstGB0LUg0LPQsNC70L7Rh9C60Lgg0L7QsdGA0LDRgtC90L5cclxuICAgICAgICAgICAgICAgIHRoaXMuZm9yY2VFbmFibGVBbGxDaGVja2JveGVzKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JTQsNC10Lwg0LTQvtC/0L7Qu9C90LjRgtC10LvRjNC90L7QtSDQstGA0LXQvNGPINC90LAg0L7QsdGA0LDQsdC+0YLQutGDINCy0YHQtdGFINC70L7Qs9C+0LIg0L/QtdGA0LXQtCDQv9C+0LrQsNC30L7QvCDQuNGC0L7Qs9C+0LJcclxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INC40YLQvtCz0LhcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dMYXN0QnVpbGRJbmZvKCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCQ0LLRgtC+0LzQsNGC0LjRh9C10YHQutC4INC+0LHQvdC+0LLQu9GP0LXQvCDQtNCw0L3QvdGL0LUg0L/QvtGB0LvQtSDQt9Cw0LLQtdGA0YjQtdC90LjRjyDRgdCx0L7RgNC60LhcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnQXV0b21hdGljIGRhdGEgdXBkYXRlIGFmdGVyIGJ1aWxkLi4uJywgJ3dhcm4nKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlZnJlc2hEYXRhQWZ0ZXJCdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgfSwgMjAwMCk7IC8vINCU0LDQtdC8IDIg0YHQtdC60YPQvdC00Ysg0L3QsCDQvtCx0YDQsNCx0L7RgtC60YMg0LLRgdC10YUg0LvQvtCz0L7QslxyXG4gICAgICAgICAgICB9LCA1MDApOyAvLyDQo9C80LXQvdGM0YjQsNC10Lwg0LfQsNC00LXRgNC20LrRgywg0L3QviDQtNCw0LXQvCDQstGA0LXQvNGPINC90LAg0YHQsdGA0L7RgSDQsNC90LjQvNCw0YbQuNC4XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICog0J/RgNC+0LLQtdGA0Y/QtdGCINC90LDQu9C40YfQuNC1INC90LXRgdC+0YXRgNCw0L3QtdC90L3Ri9GFINC40LfQvNC10L3QtdC90LjQuSDQsiDRgtC10LrRg9GJ0LXQuSDRgdGG0LXQvdC1XHJcbiAgICAgICAgICog0JjRgdC/0L7Qu9GM0LfRg9C10LwgQVBJOiBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdxdWVyeS1kaXJ0eScpXHJcbiAgICAgICAgICog0JTQvtC60YPQvNC10L3RgtCw0YbQuNGPOiBAY29jb3MvY3JlYXRvci10eXBlcy9lZGl0b3IvcGFja2FnZXMvc2NlbmUvQHR5cGVzL21lc3NhZ2UuZC50c1xyXG4gICAgICAgICAqINCS0L7Qt9Cy0YDQsNGJ0LDQtdGCIGJvb2xlYW5cclxuICAgICAgICAgKi9cclxuICAgICAgICBhc3luYyBjaGVja1NjZW5lRGlydHkoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIEVkaXRvciA9PT0gJ3VuZGVmaW5lZCcgfHwgIUVkaXRvci5NZXNzYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgXHJcbiAgICAgICAgICAgICAgICBjb25zdCBpc0RpcnR5OiBib29sZWFuID0gYXdhaXQgRWRpdG9yLk1lc3NhZ2UucmVxdWVzdCgnc2NlbmUnLCAncXVlcnktZGlydHknKTtcclxuICAgICAgICAgICAgICAgIHJldHVybiBpc0RpcnR5O1xyXG4gICAgICAgICAgICB9IGNhdGNoIChlcnJvcikge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdGYWlsZWQgdG8gY2hlY2sgc2NlbmUgZGlydHkgc3RhdGU6JywgZXJyb3IpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICog0KHQvtGF0YDQsNC90Y/QtdGCINGC0LXQutGD0YnRg9GOINGB0YbQtdC90YNcclxuICAgICAgICAgKiDQmNGB0L/QvtC70YzQt9GD0LXQvCBBUEk6IEVkaXRvci5NZXNzYWdlLnJlcXVlc3QoJ3NjZW5lJywgJ3NhdmUtc2NlbmUnKVxyXG4gICAgICAgICAqINCU0L7QutGD0LzQtdC90YLQsNGG0LjRjzogQGNvY29zL2NyZWF0b3ItdHlwZXMvZWRpdG9yL3BhY2thZ2VzL3NjZW5lL0B0eXBlcy9tZXNzYWdlLmQudHNcclxuICAgICAgICAgKi9cclxuICAgICAgICBhc3luYyBzYXZlU2NlbmUoKTogUHJvbWlzZTxib29sZWFuPiB7XHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIEVkaXRvciA9PT0gJ3VuZGVmaW5lZCcgfHwgIUVkaXRvci5NZXNzYWdlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ0FQSSDRgNC10LTQsNC60YLQvtGA0LAg0L3QtdC00L7RgdGC0YPQv9C10L0nLCAnd2FybicpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIFxyXG4gICAgICAgICAgICAgICAgLy8g0KHQvtC+0LHRidC10L3QuNC1ICdzYXZlLXNjZW5lJyDQv9GA0LjQvdC40LzQsNC10YIg0L7Qv9GG0LjQvtC90LDQu9GM0L3Ri9C5IGJvb2xlYW4g0L/QsNGA0LDQvNC10YLRgFxyXG4gICAgICAgICAgICAgICAgLy8g0Lgg0LLQvtC30LLRgNCw0YnQsNC10YIgc3RyaW5nIHwgdW5kZWZpbmVkICjQv9GD0YLRjCDQuiDRgdC+0YXRgNCw0L3QtdC90L3QvtC5INGB0YbQtdC90LUpXHJcbiAgICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBFZGl0b3IuTWVzc2FnZS5yZXF1ZXN0KCdzY2VuZScsICdzYXZlLXNjZW5lJyk7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygn0KHRhtC10L3QsCDRgdC+0YXRgNCw0L3QtdC90LAnLCAnc3VjY2VzcycpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdGYWlsZWQgdG8gc2F2ZSBzY2VuZTonLCBlcnJvcik7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygn0J7RiNC40LHQutCwINC/0YDQuCDRgdC+0YXRgNCw0L3QtdC90LjQuCDRgdGG0LXQvdGLOiAnICsgZXJyb3IsICdlcnJvcicpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgdHJpZ2dlckJ1aWxkKCkge1xyXG4gICAgICAgICAgICBpZiAoaXNCdWlsZGluZykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5jYW5jZWxCdWlsZCgpO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNC5INCyINGB0YbQtdC90LVcclxuICAgICAgICAgICAgdGhpcy5jaGVja1NjZW5lRGlydHkoKS50aGVuKChoYXNVbnNhdmVkU2NlbmVDaGFuZ2VzOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBpZiAoaGFzVW5zYXZlZFNjZW5lQ2hhbmdlcykge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INC80L7QtNCw0LvRjNC90L7QtSDQvtC60L3QviDRgSDQv9GA0LXQtNC70L7QttC10L3QuNC10Lwg0YHQvtGF0YDQsNC90LjRgtGMINGB0YbQtdC90YNcclxuICAgICAgICAgICAgICAgICAgICBtb2RhbE1hbmFnZXIuc2hvd1Vuc2F2ZWRTY2VuZUNoYW5nZXNNb2RhbCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQldGB0LvQuCDQvdC10YIg0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNC5LCDQv9GA0L7QtNC+0LvQttCw0LXQvCDQvtCx0YvRh9C90YPRjiDQv9GA0L7QstC10YDQutGDXHJcbiAgICAgICAgICAgICAgICB0aGlzLnByb2NlZWRXaXRoQnVpbGRDaGVjaygpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiDQn9GA0L7QtNC+0LvQttCw0LXRgiDQv9GA0L7QstC10YDQutGDINC/0LXRgNC10LQg0LfQsNC/0YPRgdC60L7QvCDQsdC40LvQtNCwICjQv9C+0YHQu9C1INC/0YDQvtCy0LXRgNC60Lgg0YHRhtC10L3RiylcclxuICAgICAgICAgKi9cclxuICAgICAgICBwcm9jZWVkV2l0aEJ1aWxkQ2hlY2soKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1haW5CdWlsZEVuYWJsZWQgPSAodGhpcy4kLm1haW5CdWlsZENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpLmNoZWNrZWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHN1cGVySHRtbEVuYWJsZWQgPSAodGhpcy4kLnN1cGVyaHRtbENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpLmNoZWNrZWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IGxvYWRUb1NmdHAgPSAodGhpcy4kLnNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkO1xyXG4gICAgICAgICAgICBjb25zdCBjbGVhclNmdHBFbmFibGVkID0gKHRoaXMuJC5jbGVhclNmdHBDaGVja2JveCBhcyBIVE1MSW5wdXRFbGVtZW50KS5jaGVja2VkO1xyXG4gICAgICAgICAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vJyk7XHJcblxyXG4gICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINC90YPQttC90L4g0LvQuCDQv9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QviDQsNC60YLQuNCy0LjRgNC+0LLQsNGC0Ywg0L7RgdC90L7QstC90L7QuSDQsdC40LvQtFxyXG4gICAgICAgICAgICB0aGlzLmNoZWNrQW5kRm9yY2VNYWluQnVpbGQocHJvamVjdFBhdGgpLnRoZW4oKGZvcmNlZE1haW5CdWlsZDogYm9vbGVhbikgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZmluYWxNYWluQnVpbGRFbmFibGVkID0gZm9yY2VkTWFpbkJ1aWxkIHx8IG1haW5CdWlsZEVuYWJsZWQ7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JXRgdC70Lgg0L7RgdC90L7QstC90L7QuSDQsdC40LvQtCDQvdC1INCy0LrQu9GO0YfQtdC9INC4INC90LUg0L/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LDQutGC0LjQstC40YDQvtCy0LDQvSwg0L/QvtC60LDQt9GL0LLQsNC10Lwg0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjQtVxyXG4gICAgICAgICAgICAgICAgaWYgKCFmaW5hbE1haW5CdWlsZEVuYWJsZWQgJiYgIWZvcmNlZE1haW5CdWlsZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIG1vZGFsTWFuYWdlci5zaG93V2FybmluZ01vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgIC8vINCV0YHQu9C4INCy0YHQtSDQsiDQv9C+0YDRj9C00LrQtSwg0LfQsNC/0YPRgdC60LDQtdC8INGB0LHQvtGA0LrRg1xyXG4gICAgICAgICAgICAgICAgdGhpcy5wcm9jZWVkV2l0aEJ1aWxkKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vINCf0L7QutCw0LfQsNGC0Ywg0L/RgNC10LTRg9C/0YDQtdC20LTQtdC90LjQtSBTRlRQINGBINC40L3RhNC+0YDQvNCw0YbQuNC10Lkg0L4gY2xlYW4taW5mb1xyXG4gICAgICAgIGFzeW5jIHNob3dTZnRwV2FybmluZ1dpdGhJbmZvKHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0LzQvtC00LDQu9GM0L3QvtC1INC+0LrQvdC+INGBINC40L3QtNC40LrQsNGC0L7RgNC+0Lwg0LfQsNCz0YDRg9C30LrQuFxyXG4gICAgICAgICAgICBtb2RhbE1hbmFnZXIuc2hvd1NmdHBXYXJuaW5nV2l0aEluZm8oKTtcclxuXHJcbiAgICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDQv9GA0LXQtNGL0LTRg9GJ0LjQtSDQtNCw0L3QvdGL0LVcclxuICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5jbGVhclNmdHBDbGVhbkluZm8oKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBjbGVhbkluZm8gPSBhd2FpdCB0aGlzLmdldFNmdHBDbGVhbkluZm8ocHJvamVjdFBhdGgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCV0YHQu9C4INGDINC90LDRgSDQtdGB0YLRjCDRgdGC0YDRg9C60YLRg9GA0LjRgNC+0LLQsNC90L3Ri9C1INC00LDQvdC90YvQtSwg0LjRgdC/0L7Qu9GM0LfRg9C10Lwg0LjRhVxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc2Z0cENsZWFuSW5mbyA9IHByb2dyZXNzTWFuYWdlci5nZXRTZnRwQ2xlYW5JbmZvKCk7XHJcblxyXG5cclxuICAgICAgICAgICAgICAgIGlmIChzZnRwQ2xlYW5JbmZvLml0ZW1zLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIudXBkYXRlU2Z0cENsZWFuSW5mbygpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAvLyBGYWxsYmFjayDQuiDRgdGC0LDRgNC+0LzRgyDRhNC+0YDQvNCw0YLQuNGA0L7QstCw0L3QuNGOXHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgZm9ybWF0dGVkSW5mbyA9IGNsZWFuSW5mb1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAuc3BsaXQoJ1xcbicpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoKGxpbmU6IHN0cmluZykgPT4gbGluZS50cmltKCkpXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5tYXAoKGxpbmU6IHN0cmluZykgPT4gYDxkaXY+JHtsaW5lfTwvZGl2PmApXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCcnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgbW9kYWxNYW5hZ2VyLnVwZGF0ZVNmdHBDbGVhbkluZm8oZm9ybWF0dGVkSW5mbyB8fCAnPHA+Rm9sZGVyIGluZm9ybWF0aW9uIG5vdCBmb3VuZDwvcD4nKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgICAgICAgICAgIG1vZGFsTWFuYWdlci51cGRhdGVTZnRwQ2xlYW5JbmZvKGA8cD5FcnJvciBnZXR0aW5nIGluZm9ybWF0aW9uOiAke2Vycm9yfTwvcD5gKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8vINCc0LXRgtC+0LQg0LTQu9GPINC/0YDQvtC00L7Qu9C20LXQvdC40Y8g0YHQsdC+0YDQutC4ICjQstGL0LfRi9Cy0LDQtdGC0YHRjyDQv9C+0YHQu9C1INC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40Y8g0LjQu9C4INC10YHQu9C4INC/0YDQtdC00YPQv9GA0LXQttC00LXQvdC40LUg0L3QtSDQvdGD0LbQvdC+KVxyXG4gICAgICAgIHByb2NlZWRXaXRoQnVpbGQoKSB7XHJcbiAgICAgICAgICAgIC8vINCY0L3QuNGG0LjQsNC70LjQt9Cw0YbQuNGPINGB0LHQvtGA0LrQuFxyXG4gICAgICAgICAgICBidWlsZFN0YXJ0VGltZSA9IG5ldyBEYXRlKCk7XHJcbiAgICAgICAgICAgIGN1cnJlbnRCdWlsZFRhc2tzID0gW107XHJcbiAgICAgICAgICAgIHJlbW90ZVVybHMgPSB7fTsgLy8g0J7Rh9C40YnQsNC10LwgVVJMINC/0YDQtdC00YvQtNGD0YnQtdC5INGB0LHQvtGA0LrQuFxyXG4gICAgICAgICAgICAvLyDQntGH0LjRidCw0LXQvCDQstGA0LXQvNGPINGN0YLQsNC/0L7QsiDQv9GA0LXQtNGL0LTRg9GJ0LXQuSDRgdCx0L7RgNC60LhcclxuICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmNsZWFyQWxsUHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzKCk7XHJcblxyXG4gICAgICAgICAgICAvLyDQodCx0YDQsNGB0YvQstCw0LXQvCDQv9GA0L7Qs9GA0LXRgdGBINC80LXQudC9INCx0LjQu9C00LAgKNC90L4g0J3QlSDQvtGH0LjRidCw0LXQvCDQtNCw0L3QvdGL0LUg0L4g0YTQsNC50LvQsNGFKVxyXG4gICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIucmVzZXRQcm9ncmVzc09ubHkoKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCe0YfQuNGJ0LDQtdC8INCy0YHQtSDQuNC90YLQtdGA0LLQsNC70Ysg0LLRgNC10LzQtdC90LhcclxuICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmNsZWFyQWxsUHJvZ3Jlc3NUaW1lSW50ZXJ2YWxzKCk7XHJcblxyXG4gICAgICAgICAgICB0aGlzLnRvZ2dsZUJ1aWxkQnV0dG9uKHRydWUpO1xyXG4gICAgICAgICAgICAvLyB0aGlzLnVwZGF0ZVN0YXR1cygn0KHQsdC+0YDQutCwINC30LDQv9GD0YnQtdC90LAuLi4nKTtcclxuICAgICAgICAgICAgdGhpcy5zaG93QnVpbGRQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgY29uc3QgbWFpbkJ1aWxkRW5hYmxlZCA9ICh0aGlzLiQubWFpbkJ1aWxkQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZDtcclxuICAgICAgICAgICAgY29uc3Qgc3VwZXJIdG1sRW5hYmxlZCA9ICh0aGlzLiQuc3VwZXJodG1sQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudCkuY2hlY2tlZDtcclxuICAgICAgICAgICAgY29uc3QgbG9hZFRvU2Z0cCA9ICh0aGlzLiQuc2Z0cENoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQpLmNoZWNrZWQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHByb2plY3RQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuXHJcbiAgICAgICAgICAgIC8vINCf0YDQvtCy0LXRgNGP0LXQvCwg0L3Rg9C20L3QviDQu9C4INC/0YDQuNC90YPQtNC40YLQtdC70YzQvdC+INCw0LrRgtC40LLQuNGA0L7QstCw0YLRjCDQvtGB0L3QvtCy0L3QvtC5INCx0LjQu9C0XHJcbiAgICAgICAgICAgIHRoaXMuY2hlY2tBbmRGb3JjZU1haW5CdWlsZChwcm9qZWN0UGF0aCkudGhlbigoZm9yY2VkTWFpbkJ1aWxkOiBib29sZWFuKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAvLyDQntGC0LrQu9GO0YfQsNC10Lwg0LPQsNC70L7Rh9C60Lgg0LLQviDQstGA0LXQvNGPINGB0LHQvtGA0LrQuCDQn9Ce0KHQm9CVINC/0YDQvtCy0LXRgNC60Lgg0L/RgNC40L3Rg9C00LjRgtC10LvRjNC90L7QuSDQsNC60YLQuNCy0LDRhtC40LhcclxuICAgICAgICAgICAgICAgIHRoaXMuc2V0Q2hlY2tib3hlc0VuYWJsZWQoZmFsc2UpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgZmluYWxNYWluQnVpbGRFbmFibGVkID0gZm9yY2VkTWFpbkJ1aWxkIHx8IG1haW5CdWlsZEVuYWJsZWQ7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J7RgtC80LXRh9Cw0LXQvCDQv9GA0L7Qv9GD0YnQtdC90L3Ri9C1INGN0YLQsNC/0Ysg0YfQtdGA0LXQtyBQcm9ncmVzc01hbmFnZXJcclxuICAgICAgICAgICAgICAgIGlmICghZmluYWxNYWluQnVpbGRFbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnJlc2V0U2VjdGlvblN0YXRlKCdtYWluQnVpbGQnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmICghbG9hZFRvU2Z0cCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5yZXNldFNlY3Rpb25TdGF0ZSgnc2Z0cCcpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgaWYgKCFzdXBlckh0bWxFbmFibGVkKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLnJlc2V0U2VjdGlvblN0YXRlKCdzdXBlckh0bWwnKTtcclxuICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQl9Cw0L/Rg9GB0LrQsNC10Lwg0YHQsdC+0YDQutGDINGBINC+0LHQvdC+0LLQu9C10L3QvdGL0LzQuCDQv9Cw0YDQsNC80LXRgtGA0LDQvNC4XHJcbiAgICAgICAgICAgICAgICB0aGlzLnJ1bkJ1aWxkUHJvY2VzcyhmaW5hbE1haW5CdWlsZEVuYWJsZWQsIHN1cGVySHRtbEVuYWJsZWQsIGxvYWRUb1NmdHAsIHByb2plY3RQYXRoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgcnVuQnVpbGRQcm9jZXNzKG1haW5CdWlsZEVuYWJsZWQ6IGJvb2xlYW4sIHN1cGVySHRtbEVuYWJsZWQ6IGJvb2xlYW4sIGxvYWRUb1NmdHA6IGJvb2xlYW4sIHByb2plY3RQYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgLy8g0J7RgdC90L7QstC90L7QuSDQsdC40LvQtFxyXG4gICAgICAgICAgICBjb25zdCBydW5NYWluQnVpbGQgPSAoKSA9PiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpc0J1aWxkaW5nIHx8ICFtYWluQnVpbGRFbmFibGVkKSB7IHJlc29sdmUoKTsgcmV0dXJuOyB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J/QvtC60LDQt9GL0LLQsNC10Lwg0L/RgNC+0LPRgNC10YHRgS3QsdCw0YAg0LTQu9GPINC+0YHQvdC+0LLQvdC+0LPQviDQsdC40LvQtNCwXHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIuc2hvd1NlY3Rpb25Qcm9ncmVzcygnbWFpbkJ1aWxkJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J/RgNC+0LPRgNC10YHRgSDQvtGB0L3QvtCy0L3QvtCz0L4g0LHQuNC70LTQsCDRg9C/0YDQsNCy0LvRj9C10YLRgdGPINGH0LXRgNC10LcgUHJvZ3Jlc3NNYW5hZ2VyXHJcbiAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnU3RhcnRpbmcgbWFpbiBidWlsZC4uLicpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCd0LDRh9C40L3QsNC10Lwg0L7RgtGB0LvQtdC20LjQstCw0L3QuNC1INCy0YDQtdC80LXQvdC4XHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIuc3RhcnRTdGFnZVRpbWluZygnbWFpbkJ1aWxkJyk7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0JfQsNC/0YPRgdC60LDQtdC8INC80L7QvdC40YLQvtGA0LjQvdCzINC30LDRgdGC0YDRj9Cy0YjQtdCz0L4g0L/RgNC+0LPRgNC10YHRgdCwXHJcbiAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIuc3RhcnRTdHVja1Byb2dyZXNzTW9uaXRvcmluZygpO1xyXG5cclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvY29zRXhlUGF0aCA9IE9iamVjdC5rZXlzKEVkaXRvci5BcHAuYXJncylbMF07XHJcbiAgICAgICAgICAgICAgICAvLyDQmtGA0L7RgdGB0L/Qu9Cw0YLRhNC+0YDQvNC10L3QvdC+0LUg0L7Qv9GA0LXQtNC10LvQtdC90LjQtSDRgNCw0LHQvtGH0LXQuSDQtNC40YDQtdC60YLQvtGA0LjQuFxyXG4gICAgICAgICAgICAgICAgY29uc3QgY3dkID0gcmVxdWlyZSgncGF0aCcpLmRpcm5hbWUoY29jb3NFeGVQYXRoKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGNvbmZpZ1BhdGggPSBqb2luKHByb2plY3RQYXRoLCAnYnVpbGQtdGVtcGxhdGVzJywgJ2NyYWRhX3BsYXlhYmxlXzJELmpzb24nKTtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCBtYWluQnVpbGQgPSBzcGF3bihjb2Nvc0V4ZVBhdGgsIFtgLS1wcm9qZWN0YCwgcHJvamVjdFBhdGgsIGAtLWJ1aWxkYCwgYGNvbmZpZ1BhdGg9JHtjb25maWdQYXRofWBdLCB7IGN3ZCwgc2hlbGw6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgICAgICAgcnVubmluZ1Byb2Nlc3Nlcy5wdXNoKG1haW5CdWlsZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkLnN0ZG91dC5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHRoaXMuYXBwZW5kTG9nKGRhdGEudG9TdHJpbmcoKSkpO1xyXG4gICAgICAgICAgICAgICAgbWFpbkJ1aWxkLnN0ZGVyci5vbignZGF0YScsIChkYXRhOiBCdWZmZXIpID0+IHRoaXMuYXBwZW5kTG9nKGRhdGEudG9TdHJpbmcoKSwgJ2Vycm9yJykpO1xyXG5cclxuICAgICAgICAgICAgICAgIG1haW5CdWlsZC5vbignY2xvc2UnLCAoY29kZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJ1bm5pbmdQcm9jZXNzZXMgPSBydW5uaW5nUHJvY2Vzc2VzLmZpbHRlcihwID0+IHAgIT09IG1haW5CdWlsZCk7XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIGlmICghaXNCdWlsZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZygnTWFpbiBidWlsZCB3YXMgY2FuY2VsbGVkJywgJ3dhcm4nKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoY29kZSA9PT0gMzYpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC40L3Rg9C00LjRgtC10LvRjNC90L4g0LfQsNCy0LXRgNGI0LDQtdC8INC/0YDQvtCz0YDQtdGB0YEg0L7RgdC90L7QstC90L7Qs9C+INCx0LjQu9C00LBcclxuICAgICAgICAgICAgICAgICAgICAgICAgcHJvZ3Jlc3NNYW5hZ2VyLmZvcmNlQ29tcGxldGVNYWluQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgY3VycmVudEJ1aWxkVGFza3MucHVzaCgnTWFpbiBCdWlsZCcpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmFwcGVuZExvZyhgTWFpbiBidWlsZCBjb21wbGV0ZWQgc3VjY2Vzc2Z1bGx5YCwgJ3N1Y2Nlc3MnKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vINCe0LHQvdC+0LLQu9GP0LXQvCDQtNCw0L3QvdGL0LUg0L/QvtGB0LvQtSDRg9GB0L/QtdGI0L3QvtCz0L4g0L7RgdC90L7QstC90L7Qs9C+INCx0LjQu9C00LBcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coJ1VwZGF0aW5nIGRhdGEgYWZ0ZXIgbWFpbiBidWlsZC4uLicsICd3YXJuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVmcmVzaERhdGFBZnRlckJ1aWxkKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYE1haW4gYnVpbGQgY29tcGxldGVkIHdpdGggZXJyb3IgKGNvZGUgJHtjb2RlfSlgLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgICAgIC8vINCX0LDQstC10YDRiNCw0LXQvCDQvtGC0YHQu9C10LbQuNCy0LDQvdC40LUg0LLRgNC10LzQtdC90LhcclxuICAgICAgICAgICAgICAgICAgICBwcm9ncmVzc01hbmFnZXIuZW5kU3RhZ2VUaW1pbmcoJ21haW5CdWlsZCcpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQntGB0YLQsNC90LDQstC70LjQstCw0LXQvCDQvNC+0L3QuNGC0L7RgNC40L3QsyDQt9Cw0YHRgtGA0Y/QstGI0LXQs9C+INC/0YDQvtCz0YDQtdGB0YHQsFxyXG4gICAgICAgICAgICAgICAgICAgIHByb2dyZXNzTWFuYWdlci5zdG9wU3R1Y2tQcm9ncmVzc01vbml0b3JpbmcoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH0pO1xyXG5cclxuICAgICAgICAgICAgcnVuTWFpbkJ1aWxkKClcclxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQnVpbGRpbmcpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc3VwZXJIdG1sRW5hYmxlZCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5ydW5TdXBlckh0bWxCdWlsZChwcm9qZWN0UGF0aClcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoIWlzQnVpbGRpbmcpIHJldHVybjtcclxuICAgICAgICAgICAgICAgICAgICBpZiAobG9hZFRvU2Z0cCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5ydW5TRlRQTG9hZChwcm9qZWN0UGF0aClcclxuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNCdWlsZGluZykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10LwsINGH0YLQviDQstGB0LUg0L/RgNC+0YbQtdGB0YHRiyDQt9Cw0LLQtdGA0YjQtdC90YtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHJ1bm5pbmdQcm9jZXNzZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmZpbmFsaXplQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vINCV0YHQu9C4INC10YHRgtGMINCw0LrRgtC40LLQvdGL0LUg0L/RgNC+0YbQtdGB0YHRiywg0LbQtNC10Lwg0LjRhSDQt9Cw0LLQtdGA0YjQtdC90LjRj1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy53YWl0Rm9yQWxsUHJvY2Vzc2VzVG9Db21wbGV0ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgfSlcclxuICAgICAgICAgICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5hcHBlbmRMb2coYEJ1aWxkIGVycm9yOiAke2Vycn1gLCAnZXJyb3InKTtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC90LDRh9Cw0LvQsCDRgdCx0YDQsNGB0YvQstCw0LXQvCDQstGB0LUg0YHQvtGB0YLQvtGP0L3QuNGPINC/0YDQvtCz0YDQtdGB0YHQsCDQuCDQsNC90LjQvNCw0YbQuNC4XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oaWRlQnVpbGRQcm9ncmVzcygpO1xyXG5cclxuICAgICAgICAgICAgICAgICAgICAvLyDQl9Cw0YLQtdC8INGBINC30LDQtNC10YDQttC60L7QuSDRgNCw0LfQsdC70L7QutC40YDRg9C10Lwg0LPQsNC70L7Rh9C60Lgg0L/RgNC4INC+0YjQuNCx0LrQtVxyXG4gICAgICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0LjQvdGD0LTQuNGC0LXQu9GM0L3QviDQstC60LvRjtGH0LDQtdC8INCy0YHQtSDQs9Cw0LvQvtGH0LrQuCDQvtCx0YDQsNGC0L3QviDQv9GA0Lgg0L7RiNC40LHQutC1XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuZm9yY2VFbmFibGVBbGxDaGVja2JveGVzKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSwgNTAwKTtcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqINCe0LbQuNC00LDQvdC40LUg0LfQsNCy0LXRgNGI0LXQvdC40Y8g0LLRgdC10YUg0LDQutGC0LjQstC90YvRhSDQv9GA0L7RhtC10YHRgdC+0LJcclxuICAgICAgICAgKi9cclxuICAgICAgICB3YWl0Rm9yQWxsUHJvY2Vzc2VzVG9Db21wbGV0ZSgpIHtcclxuICAgICAgICAgICAgaWYgKHJ1bm5pbmdQcm9jZXNzZXMubGVuZ3RoID09PSAwKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmZpbmFsaXplQnVpbGQoKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8INC60LDQttC00YvQtSAxMDDQvNGBLCDQtdGB0YLRjCDQu9C4INC10YnQtSDQsNC60YLQuNCy0L3Ri9C1INC/0YDQvtGG0LXRgdGB0YtcclxuICAgICAgICAgICAgY29uc3QgY2hlY2tJbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgICAgICAgICAgIGlmIChydW5uaW5nUHJvY2Vzc2VzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgICAgICAgICAgICAgICAgIGNsZWFySW50ZXJ2YWwoY2hlY2tJbnRlcnZhbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5maW5hbGl6ZUJ1aWxkKCk7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCFpc0J1aWxkaW5nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JXRgdC70Lgg0LHQuNC70LQg0L7RgtC80LXQvdC10L0sINC/0YDQtdGA0YvQstCw0LXQvCDQvtC20LjQtNCw0L3QuNC1XHJcbiAgICAgICAgICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChjaGVja0ludGVydmFsKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSwgMTAwKTtcclxuICAgICAgICB9LFxyXG5cclxuICAgICAgICAvKipcclxuICAgICAgICAgKiDQntCx0L3QvtCy0LvRj9C10YIg0YHQvtGB0YLQvtGP0L3QuNC1INC60L3QvtC/0LrQuCDQstCw0LvQuNC00LDRgtC+0YDQsCDQsiDQt9Cw0LLQuNGB0LjQvNC+0YHRgtC4INC+0YIg0YDQtdC30YPQu9GM0YLQsNGC0L7QsiDQstCw0LvQuNC00LDRhtC40LhcclxuICAgICAgICAgKi9cclxuICAgICAgICB1cGRhdGVWYWxpZGF0b3JCdXR0b25TdGF0ZSgpIHtcclxuICAgICAgICAgICAgY29uc3QgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uID0gdGhpcy4kLnRvZ2dsZVZhbGlkYXRvckJ1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudDtcclxuICAgICAgICAgICAgaWYgKCF0b2dnbGVWYWxpZGF0b3JCdXR0b24pIHJldHVybjtcclxuXHJcbiAgICAgICAgICAgIGlmICh2YWxpZGF0aW9uU3RhdGUuaGFzRXJyb3JzKSB7XHJcbiAgICAgICAgICAgICAgICB0b2dnbGVWYWxpZGF0b3JCdXR0b24uY2xhc3NMaXN0LmFkZCgnaGFzLWVycm9ycycpO1xyXG4gICAgICAgICAgICAgICAgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uLmNsYXNzTGlzdC5yZW1vdmUoJ25vLWVycm9ycycpO1xyXG4gICAgICAgICAgICAgICAgLy8g0JzQtdC90Y/QtdC8INC40LrQvtC90LrRgyDQvdCwINCy0L7RgdC60LvQuNGG0LDRgtC10LvRjNC90YvQuSDQt9C90LDQuiDQv9GA0Lgg0L7RiNC40LHQutCw0YVcclxuICAgICAgICAgICAgICAgIHRvZ2dsZVZhbGlkYXRvckJ1dHRvbi50ZXh0Q29udGVudCA9ICchJztcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHRvZ2dsZVZhbGlkYXRvckJ1dHRvbi5jbGFzc0xpc3QuYWRkKCduby1lcnJvcnMnKTtcclxuICAgICAgICAgICAgICAgIHRvZ2dsZVZhbGlkYXRvckJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdoYXMtZXJyb3JzJyk7XHJcbiAgICAgICAgICAgICAgICAvLyDQnNC10L3Rj9C10Lwg0LjQutC+0L3QutGDINC90LAg0LPQsNC70L7Rh9C60YMg0L/RgNC4INGD0YHQv9C10YjQvdC+0Lkg0LLQsNC70LjQtNCw0YbQuNC4XHJcbiAgICAgICAgICAgICAgICB0b2dnbGVWYWxpZGF0b3JCdXR0b24udGV4dENvbnRlbnQgPSAn4pyTJztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqINCX0LDQv9GD0YHQuiDQstCw0LvQuNC00LDRhtC40Lgg0L/QsNGA0LDQvNC10YLRgNC+0LJcclxuICAgICAgICAgKi9cclxuICAgICAgICBhc3luYyBydW5WYWxpZGF0aW9uKCkge1xyXG4gICAgICAgICAgICB0cnkge1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCf0L7QutCw0LfRi9Cy0LDQtdC8INC40L3QtNC40LrQsNGC0L7RgCDQt9Cw0LPRgNGD0LfQutC4XHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWxpZGF0b3JDb250ZW50ID0gdGhpcy4kLnZhbGlkYXRvckNvbnRlbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9yQ29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvckNvbnRlbnQuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidmFsaWRhdG9yLWxvYWRpbmdcIj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJsb2FkaW5nLXNwaW5uZXJcIj48L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxwPlNjYW5uaW5nIFR5cGVTY3JpcHQgZmlsZXMuLi48L3A+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgIGA7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgICAgLy8gU3RhcnQgdmFsaWRhdGlvblxyXG4gICAgICAgICAgICAgICAgY29uc3Qgc3VtbWFyeSA9IGF3YWl0IHZhbGlkYXRvci52YWxpZGF0ZSgpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCh0L7RhdGA0LDQvdGP0LXQvCDRgdC+0YHRgtC+0Y/QvdC40LUg0LLQsNC70LjQtNCw0YbQuNC4XHJcbiAgICAgICAgICAgICAgICB2YWxpZGF0aW9uU3RhdGUubGFzdFZhbGlkYXRpb24gPSBzdW1tYXJ5O1xyXG4gICAgICAgICAgICAgICAgdmFsaWRhdGlvblN0YXRlLmhhc0Vycm9ycyA9ICFzdW1tYXJ5LmlzVmFsaWRhdGlvblN1Y2Nlc3NmdWw7XHJcblxyXG4gICAgICAgICAgICAgICAgLy8g0J7QsdC90L7QstC70Y/QtdC8INGB0L7RgdGC0L7Rj9C90LjQtSDQutC90L7Qv9C60Lgg0LLQsNC70LjQtNCw0YLQvtGA0LBcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVmFsaWRhdG9yQnV0dG9uU3RhdGUoKTtcclxuXHJcbiAgICAgICAgICAgICAgICAvLyDQk9C10L3QtdGA0LjRgNGD0LXQvCBIVE1MINC+0YLRh9C10YJcclxuICAgICAgICAgICAgICAgIGNvbnN0IGh0bWxSZXBvcnQgPSB2YWxpZGF0b3IuZ2VuZXJhdGVIdG1sUmVwb3J0KHN1bW1hcnkpO1xyXG5cclxuICAgICAgICAgICAgICAgIC8vINCe0YLQvtCx0YDQsNC20LDQtdC8INGA0LXQt9GD0LvRjNGC0LDRglxyXG4gICAgICAgICAgICAgICAgaWYgKHZhbGlkYXRvckNvbnRlbnQpIHtcclxuICAgICAgICAgICAgICAgICAgICB2YWxpZGF0b3JDb250ZW50LmlubmVySFRNTCA9IGh0bWxSZXBvcnQ7XHJcbiAgICAgICAgICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuXHJcbiAgICAgICAgICAgICAgICBjb25zdCB2YWxpZGF0b3JDb250ZW50ID0gdGhpcy4kLnZhbGlkYXRvckNvbnRlbnQgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICBpZiAodmFsaWRhdG9yQ29udGVudCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHZhbGlkYXRvckNvbnRlbnQuaW5uZXJIVE1MID0gYFxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwidmFsaWRhdG9yLWVycm9yXCI+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8aDM+4p2MIFZhbGlkYXRpb24gRXJyb3I8L2gzPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHA+RmFpbGVkIHRvIHZhbGlkYXRlIHBhcmFtZXRlcnM6PC9wPlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzcz1cImVycm9yLWRldGFpbHNcIj4ke2Vycm9yfTwvZGl2PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgICAgICAgICBgO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfSxcclxuXHJcbiAgICByZWFkeSgpIHtcclxuICAgICAgICAvLyDQo9GB0YLQsNC90LDQstC70LjQstCw0LXQvCDQstC10YDRgdC40Y4g0LHQuNC70LTQtdGA0LBcclxuICAgICAgICBpZiAodGhpcy4kLmJ1aWxkZXJWZXJzaW9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5idWlsZGVyVmVyc2lvbi50ZXh0Q29udGVudCA9IHBhY2thZ2VKU09OLnZlcnNpb24gfHwgJ3Vua25vd24nO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCBMb2dNYW5hZ2VyXHJcbiAgICAgICAgbG9nTWFuYWdlciA9IG5ldyBMb2dNYW5hZ2VyKFxyXG4gICAgICAgICAgICB0aGlzLiQubG9nQ29udGVudCBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgdGhpcy4kLmxvZ1N1bW1hcnlUZXh0IGFzIEhUTUxFbGVtZW50XHJcbiAgICAgICAgKTtcclxuXHJcbiAgICAgICAgLy8g0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCBQcm9ncmVzc01hbmFnZXJcclxuICAgICAgICBwcm9ncmVzc01hbmFnZXIgPSBuZXcgUHJvZ3Jlc3NNYW5hZ2VyKHtcclxuICAgICAgICAgICAgLy8gQ2hlY2tib3ggc2VjdGlvbnMgZm9yIHByb2dyZXNzIGRpc3BsYXlcclxuICAgICAgICAgICAgbWFpbkJ1aWxkU2VjdGlvbjogdGhpcy4kLm1haW5CdWlsZFNlY3Rpb24gYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgIHN1cGVyaHRtbFNlY3Rpb246IHRoaXMuJC5zdXBlcmh0bWxTZWN0aW9uIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICBzZnRwU2VjdGlvbjogdGhpcy4kLnNmdHBTZWN0aW9uIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAvLyBQcm9ncmVzcyBpbmRpY2F0b3JzIGluc2lkZSBzZWN0aW9uc1xyXG4gICAgICAgICAgICBtYWluQnVpbGRQcm9ncmVzczogdGhpcy4kLm1haW5CdWlsZFByb2dyZXNzIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICBzdXBlcmh0bWxQcm9ncmVzczogdGhpcy4kLnN1cGVyaHRtbFByb2dyZXNzIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICBzZnRwUHJvZ3Jlc3M6IHRoaXMuJC5zZnRwUHJvZ3Jlc3MgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgIC8vIFRpbWUgZWxlbWVudHNcclxuICAgICAgICAgICAgbWFpbkJ1aWxkVGltZTogdGhpcy4kLm1haW5CdWlsZFRpbWUgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgIHN1cGVyaHRtbFRpbWU6IHRoaXMuJC5zdXBlcmh0bWxUaW1lIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICBzZnRwVGltZTogdGhpcy4kLnNmdHBUaW1lIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAvLyBQcm9ncmVzcyBzdGF0dXNlc1xyXG4gICAgICAgICAgICBtYWluQnVpbGRTdGF0dXM6IHRoaXMuJC5tYWluQnVpbGRTdGF0dXMgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgIHN1cGVyaHRtbFN0YXR1czogdGhpcy4kLnN1cGVyaHRtbFN0YXR1cyBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgc2Z0cFN0YXR1czogdGhpcy4kLnNmdHBTdGF0dXMgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgIHNmdHBDbGVhbkluZm86IHRoaXMuJC5zZnRwQ2xlYW5JbmZvIGFzIEhUTUxFbGVtZW50XHJcbiAgICAgICAgfSk7XHJcblxyXG4gICAgICAgIC8vINCj0YHRgtCw0L3QsNCy0LvQuNCy0LDQtdC8INC00L7Qv9C+0LvQvdC40YLQtdC70YzQvdGL0LUg0Y3Qu9C10LzQtdC90YLRiyDQv9GA0L7Qs9GA0LXRgdGBLdCx0LDRgNC+0LJcclxuICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5tYWluQnVpbGRQcm9ncmVzc0ZpbGwgPSB0aGlzLiQubWFpbkJ1aWxkUHJvZ3Jlc3NGaWxsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIChwcm9ncmVzc01hbmFnZXIgYXMgYW55KS51aUVsZW1lbnRzLnN1cGVyaHRtbFByb2dyZXNzRmlsbCA9IHRoaXMuJC5zdXBlcmh0bWxQcm9ncmVzc0ZpbGwgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgKHByb2dyZXNzTWFuYWdlciBhcyBhbnkpLnVpRWxlbWVudHMuc2Z0cFByb2dyZXNzRmlsbCA9IHRoaXMuJC5zZnRwUHJvZ3Jlc3NGaWxsIGFzIEhUTUxFbGVtZW50O1xyXG4gICAgICAgIChwcm9ncmVzc01hbmFnZXIgYXMgYW55KS51aUVsZW1lbnRzLm1haW5CdWlsZFBlcmNlbnRhZ2UgPSB0aGlzLiQubWFpbkJ1aWxkUGVyY2VudGFnZSBhcyBIVE1MRWxlbWVudDtcclxuICAgICAgICAocHJvZ3Jlc3NNYW5hZ2VyIGFzIGFueSkudWlFbGVtZW50cy5zdXBlcmh0bWxQZXJjZW50YWdlID0gdGhpcy4kLnN1cGVyaHRtbFBlcmNlbnRhZ2UgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICAgICAgKHByb2dyZXNzTWFuYWdlciBhcyBhbnkpLnVpRWxlbWVudHMuc2Z0cFBlcmNlbnRhZ2UgPSB0aGlzLiQuc2Z0cFBlcmNlbnRhZ2UgYXMgSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgICAgIGlmICh0aGlzLiQuYnVpbGRCdXR0b24pIHtcclxuICAgICAgICAgICAgdGhpcy4kLmJ1aWxkQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy50cmlnZ2VyQnVpbGQoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0aGlzLiQuY2xlYXJMb2dzQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5jbGVhckxvZ3NCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmNsZWFyTG9ncygpKTtcclxuICAgICAgICB9XHJcblxyXG5cclxuICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L7QsdGA0LDQsdC+0YLRh9C40Log0LTQu9GPINCz0LDQu9C+0YfQutC4IFN1cGVySFRNTCDQsdC40LvQtNCwXHJcbiAgICAgICAgaWYgKHRoaXMuJC5zdXBlcmh0bWxDaGVja2JveCkge1xyXG4gICAgICAgICAgICB0aGlzLiQuc3VwZXJodG1sQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50b2dnbGVDbGVhckRpc3RWaXNpYmlsaXR5KCk7XHJcbiAgICAgICAgICAgICAgICAvLyDQntCx0L3QvtCy0LvRj9C10Lwg0LTQvtGB0YLRg9C/0L3QvtGB0YLRjCBTRlRQINC/0YDQuCDQuNC30LzQtdC90LXQvdC40LggU3VwZXJIVE1MINCz0LDQu9C+0YfQutC4XHJcbiAgICAgICAgICAgICAgICBjb25zdCBwcm9qZWN0UGF0aCA9IGpvaW4oX19kaXJuYW1lLCAnLi4vLi4vLi4vLi4vLi4vJyk7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBzZnRwRm9sZGVyRXhpc3RzID0gdGhpcy5jaGVja1NmdHBGb2xkZXJFeGlzdHMocHJvamVjdFBhdGgpO1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zZXRTZnRwQ2hlY2tib3hFbmFibGVkKHNmdHBGb2xkZXJFeGlzdHMpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQtNC70Y8g0LPQsNC70L7Rh9C60LggU0ZUUFxyXG4gICAgICAgIGlmICh0aGlzLiQuc2Z0cENoZWNrYm94KSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5zZnRwQ2hlY2tib3guYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgKCkgPT4gdGhpcy50b2dnbGVDbGVhclNmdHBWaXNpYmlsaXR5KCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JjQvdC40YbQuNCw0LvQuNC30LjRgNGD0LXQvCBNb2RhbE1hbmFnZXJcclxuICAgICAgICBtb2RhbE1hbmFnZXIgPSBuZXcgTW9kYWxNYW5hZ2VyKFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICB3YXJuaW5nTW9kYWw6IHRoaXMuJC53YXJuaW5nTW9kYWwgYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB3YXJuaW5nQ2FuY2VsOiB0aGlzLiQud2FybmluZ0NhbmNlbCBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHdhcm5pbmdDb250aW51ZTogdGhpcy4kLndhcm5pbmdDb250aW51ZSBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHNmdHBXYXJuaW5nTW9kYWw6IHRoaXMuJC5zZnRwV2FybmluZ01vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgc2Z0cFdhcm5pbmdDYW5jZWw6IHRoaXMuJC5zZnRwV2FybmluZ0NhbmNlbCBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHNmdHBXYXJuaW5nQ29udGludWU6IHRoaXMuJC5zZnRwV2FybmluZ0NvbnRpbnVlIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgc2Z0cENsZWFuSW5mbzogdGhpcy4kLnNmdHBDbGVhbkluZm8gYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc01vZGFsOiB0aGlzLiQudW5zYXZlZENoYW5nZXNNb2RhbCBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHVuc2F2ZWRDaGFuZ2VzQ2FuY2VsOiB0aGlzLiQudW5zYXZlZENoYW5nZXNDYW5jZWwgYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB1bnNhdmVkQ2hhbmdlc0Rpc2NhcmQ6IHRoaXMuJC51bnNhdmVkQ2hhbmdlc0Rpc2NhcmQgYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB1cGRhdGVDb21wbGV0ZWRNb2RhbDogdGhpcy4kLnVwZGF0ZUNvbXBsZXRlZE1vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdXBkYXRlQ29tcGxldGVkT2s6IHRoaXMuJC51cGRhdGVDb21wbGV0ZWRPayBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIGluZm9TZWN0aW9uOiB0aGlzLiQuaW5mb1NlY3Rpb24gYXMgSFRNTEVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICB0b2dnbGVJbmZvQnV0dG9uOiB0aGlzLiQudG9nZ2xlSW5mb0J1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIGNsb3NlSW5mb0J1dHRvbjogdGhpcy4kLmNsb3NlSW5mb0J1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHBhdGhzU2VjdGlvbjogdGhpcy4kLnBhdGhzU2VjdGlvbiBhcyBIVE1MRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHRvZ2dsZVBhdGhzQnV0dG9uOiB0aGlzLiQudG9nZ2xlUGF0aHNCdXR0b24gYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICBjbG9zZVBhdGhzQnV0dG9uOiB0aGlzLiQuY2xvc2VQYXRoc0J1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgIHZhbGlkYXRvclNlY3Rpb246IHRoaXMuJC52YWxpZGF0b3JTZWN0aW9uIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgdG9nZ2xlVmFsaWRhdG9yQnV0dG9uOiB0aGlzLiQudG9nZ2xlVmFsaWRhdG9yQnV0dG9uIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgY2xvc2VWYWxpZGF0b3JCdXR0b246IHRoaXMuJC5jbG9zZVZhbGlkYXRvckJ1dHRvbiBhcyBIVE1MQnV0dG9uRWxlbWVudCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsOiB0aGlzLiQudW5zYXZlZFNjZW5lQ2hhbmdlc01vZGFsIGFzIEhUTUxFbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnNhdmVkU2NlbmVDYW5jZWw6IHRoaXMuJC51bnNhdmVkU2NlbmVDYW5jZWwgYXMgSFRNTEJ1dHRvbkVsZW1lbnQsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuc2F2ZWRTY2VuZVNhdmU6IHRoaXMuJC51bnNhdmVkU2NlbmVTYXZlIGFzIEhUTUxCdXR0b25FbGVtZW50LFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB1bnNhdmVkU2NlbmVDb250aW51ZTogdGhpcy4kLnVuc2F2ZWRTY2VuZUNvbnRpbnVlIGFzIEhUTUxCdXR0b25FbGVtZW50XHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uV2FybmluZ0NvbnRpbnVlOiAoKSA9PiB0aGlzLmNvbnRpbnVlQnVpbGQoKSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgb25TZnRwV2FybmluZ0NvbnRpbnVlOiAoKSA9PiB0aGlzLmNvbnRpbnVlU2Z0cEJ1aWxkKCksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVW5zYXZlZENoYW5nZXNEaXNjYXJkOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7RgdGC0L4g0YHQutGA0YvQstCw0LXQvCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L4sINC30LDQutGA0YvRgtC40LUgaW5mby1zZWN0aW9uINC/0YDQvtC40LfQvtC50LTQtdGCINCw0LLRgtC+0LzQsNGC0LjRh9C10YHQutC4XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG9uVW5zYXZlZFNjZW5lQ2FuY2VsOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyDQntGC0LzQtdC90Y/QtdC8INC30LDQv9GD0YHQuiDQsdC40LvQtNCwXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBvblVuc2F2ZWRTY2VuZVNhdmU6IGFzeW5jICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQodC+0YXRgNCw0L3Rj9C10Lwg0YHRhtC10L3RgyDQuCDQv9GA0L7QtNC+0LvQttCw0LXQvCDQsdC40LvQtFxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNhdmVkID0gYXdhaXQgdGhpcy5zYXZlU2NlbmUoKTtcclxuICAgICAgICAgICAgICAgICAgICBpZiAoc2F2ZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZWVkV2l0aEJ1aWxkQ2hlY2soKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgb25VbnNhdmVkU2NlbmVDb250aW51ZTogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCf0YDQvtC00L7Qu9C20LDQtdC8INCx0LjQu9C0INCx0LXQtyDRgdC+0YXRgNCw0L3QtdC90LjRj1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYXBwZW5kTG9nKCfQkdC40LvQtCDQv9GA0L7QtNC+0LvQttCw0LXRgtGB0Y8g0LHQtdC3INGB0L7RhdGA0LDQvdC10L3QuNGPINGB0YbQtdC90YsuINCj0LHQtdC00LjRgtC10YHRjCwg0YfRgtC+INGB0YbQtdC90LAg0YHQvtGF0YDQsNC90LXQvdCwINCy0YDRg9GH0L3Rg9GOLicsICd3YXJuJyk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wcm9jZWVkV2l0aEJ1aWxkQ2hlY2soKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBvbkNoZWNrVW5zYXZlZENoYW5nZXM6ICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0L3QtdGB0L7RhdGA0LDQvdC10L3QvdGL0YUg0LjQt9C80LXQvdC10L3QuNC5XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgYXV0b3NhdmVDaGVja2JveCA9IHRoaXMuJC5hdXRvc2F2ZUNoZWNrYm94IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgaXNBdXRvc2F2ZUVuYWJsZWQgPSBhdXRvc2F2ZUNoZWNrYm94ICYmIGF1dG9zYXZlQ2hlY2tib3guY2hlY2tlZDtcclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JXRgdC70Lgg0LDQstGC0L7RgdC10LnQsiDQstC60LvRjtGH0LXQvSwg0L3QtSDQv9C+0LrQsNC30YvQstCw0LXQvCDQvNC+0LTQsNC70YzQvdC+0LUg0L7QutC90L5cclxuICAgICAgICAgICAgICAgICAgICBpZiAoaXNBdXRvc2F2ZUVuYWJsZWQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0J/RgNC+0LLQtdGA0Y/QtdC8INC90LDQu9C40YfQuNC1INC90LXRgdC+0YXRgNCw0L3QtdC90L3Ri9GFINC40LfQvNC10L3QtdC90LjQuVxyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBoYXNVbnNhdmVkQ2hhbmdlcyAmJiB0aGlzLmhhc1ZlcnNpb25zQ2hhbmdlZCgpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIG9uVmFsaWRhdG9yT3BlbjogKCkgPT4gdGhpcy5ydW5WYWxpZGF0aW9uKCksXHJcbiAgICAgICAgICAgICAgICBvblBhdGhzT3BlbjogKCkgPT4gdGhpcy5yZWZyZXNoRGF0YSgpLFxyXG4gICAgICAgICAgICAgICAgb25JbmZvT3BlbjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIC8vINCX0LDQs9GA0YPQttCw0LXQvCDRgdCy0LXQttGD0Y4g0LjQvdGE0L7RgNC80LDRhtC40Y4g0L/QviDRgtGA0LXQsdC+0LLQsNC90LjRjiDQv9C10YDQtdC80LXQvdC90YvRhSDQuNC3INGC0LDQudGC0Lsg0LrQvtC90YTQuNCz0LAg0L/RgNC4INC+0YLQutGA0YvRgtC40Lgg0YDQtdC00LDQutGC0L7RgNCwINCy0LXRgNGB0LjQuVxyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb2plY3RQYXRoID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdldFN1ZmZpeEFuZEhhc2gocHJvamVjdFBhdGgsICgpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgLy8g0J/QvtGB0LvQtSDQt9Cw0LPRgNGD0LfQutC4IHRpdGxlQ29uZmlnINC+0LHQvdC+0LLQu9GP0LXQvCDRgNC10LTQsNC60YLQvtGAINCy0LXRgNGB0LjQuVxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmRpc3BsYXlWZXJzaW9uRWRpdG9yKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICApO1xyXG5cclxuICAgICAgICAvLyDQmNC90LjRhtC40LDQu9C40LfQuNGA0YPQtdC8INCy0LDQu9C40LTQsNGC0L7RgFxyXG4gICAgICAgIGNvbnN0IHByb2plY3RSb290ID0gam9pbihfX2Rpcm5hbWUsICcuLi8uLi8uLi8uLi8uLi8nKTtcclxuICAgICAgICB2YWxpZGF0b3IgPSBuZXcgVmFsaWRhdG9yKHByb2plY3RSb290KTtcclxuXHJcbiAgICAgICAgdGhpcy5nZXRWZXJzaW9ucyhqb2luKF9fZGlybmFtZSwgJy4uLy4uLy4uLy4uLy4uLycpKTtcclxuICAgICAgICB0aGlzLnNldHVwUmVmcmVzaEJ1dHRvbigpO1xyXG5cclxuICAgICAgICAvLyDQn9GA0L7QstC10YDRj9C10Lwg0L3QsNC70LjRh9C40LUg0L7QsdC90L7QstC70LXQvdC40Lkg0LHQuNC70LTQtdGA0LAgKNGBINC90LXQsdC+0LvRjNGI0L7QuSDQt9Cw0LTQtdGA0LbQutC+0LksINGH0YLQvtCx0YsgRE9NINCx0YvQuyDQs9C+0YLQvtCyKVxyXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xyXG4gICAgICAgICAgICB0aGlzLmNoZWNrRm9yQnVpbGRlclVwZGF0ZSgpO1xyXG4gICAgICAgIH0sIDUwMCk7XHJcblxyXG4gICAgICAgIC8vINCX0LDQv9GD0YHQutCw0LXQvCDQstCw0LvQuNC00LDRhtC40Y4g0L/RgNC4INGB0YLQsNGA0YLQtVxyXG4gICAgICAgIHRoaXMucnVuVmFsaWRhdGlvbigpO1xyXG5cclxuICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L7QsdGA0LDQsdC+0YLRh9C40Log0LTQu9GPINC60L3QvtC/0LrQuCDQvtGC0LrRgNGL0YLQuNGPINGE0LDQudC70LAgdmVyc2lvblxyXG4gICAgICAgIGlmICh0aGlzLiQub3BlblZlcnNpb25GaWxlQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5vcGVuVmVyc2lvbkZpbGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLm9wZW5WZXJzaW9uRmlsZSgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQtNC70Y8g0LrQvdC+0L/QutC4INC+0LHQvdC+0LLQu9C10L3QuNGPINGE0LDQudC70LAgdmVyc2lvblxyXG4gICAgICAgIGlmICh0aGlzLiQucmVmcmVzaFZlcnNpb25GaWxlQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5yZWZyZXNoVmVyc2lvbkZpbGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnJlZnJlc2hWZXJzaW9uRmlsZSgpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCU0L7QsdCw0LLQu9GP0LXQvCDQvtCx0YDQsNCx0L7RgtGH0LjQuiDQtNC70Y8g0LrQvdC+0L/QutC4INC+0LHQvdC+0LLQu9C10L3QuNGPINCx0LjQu9C00LXRgNCwXHJcbiAgICAgICAgaWYgKHRoaXMuJC51cGRhdGVCdWlsZGVyQnV0dG9uKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC51cGRhdGVCdWlsZGVyQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy51cGRhdGVCdWlsZGVyKCkpO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0JTQvtCx0LDQstC70Y/QtdC8INC+0LHRgNCw0LHQvtGC0YfQuNC6INC00LvRjyDRh9C10LrQsdC+0LrRgdCwINCw0LLRgtC+0YHQtdC50LLQsFxyXG4gICAgICAgIGlmICh0aGlzLiQuYXV0b3NhdmVDaGVja2JveCkge1xyXG4gICAgICAgICAgICB0aGlzLiQuYXV0b3NhdmVDaGVja2JveC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBhdXRvc2F2ZUNoZWNrYm94ID0gdGhpcy4kLmF1dG9zYXZlQ2hlY2tib3ggYXMgSFRNTElucHV0RWxlbWVudDtcclxuICAgICAgICAgICAgICAgIGlmIChhdXRvc2F2ZUNoZWNrYm94ICYmIGF1dG9zYXZlQ2hlY2tib3guY2hlY2tlZCAmJiBoYXNVbnNhdmVkQ2hhbmdlcyAmJiB0aGlzLmhhc1ZlcnNpb25zQ2hhbmdlZCgpKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgLy8g0JXRgdC70Lgg0LDQstGC0L7RgdC10LnQsiDQstC60LvRjtGH0LXQvSDQuCDQtdGB0YLRjCDQvdC10YHQvtGF0YDQsNC90LXQvdC90YvQtSDQuNC30LzQtdC90LXQvdC40Y8sINGB0L7RhdGA0LDQvdGP0LXQvCDQuNGFXHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zYXZlVmVyc2lvbnMoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L7QsdGA0LDQsdC+0YLRh9C40Log0LTQu9GPINC60L3QvtC/0LrQuCDRgdC+0YXRgNCw0L3QtdC90LjRjyDQstC10YDRgdC40LlcclxuICAgICAgICBpZiAodGhpcy4kLnNhdmVWZXJzaW9uc0J1dHRvbikge1xyXG4gICAgICAgICAgICB0aGlzLiQuc2F2ZVZlcnNpb25zQnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5zYXZlVmVyc2lvbnMoKSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQlNC+0LHQsNCy0LvRj9C10Lwg0L7QsdGA0LDQsdC+0YLRh9C40Log0LTQu9GPINC60L3QvtC/0LrQuCDQtNC+0LHQsNCy0LvQtdC90LjRjyDQstC10YDRgdC40LhcclxuICAgICAgICBpZiAodGhpcy4kLmFkZFZlcnNpb25CdXR0b24pIHtcclxuICAgICAgICAgICAgdGhpcy4kLmFkZFZlcnNpb25CdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0FkZFZlcnNpb25Nb2RhbCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIC8vINCe0LHRgNCw0LHQvtGC0YfQuNC60Lgg0LTQu9GPINC80L7QtNCw0LvRjNC90L7Qs9C+INC+0LrQvdCwINC00L7QsdCw0LLQu9C10L3QuNGPINCy0LXRgNGB0LjQuFxyXG4gICAgICAgIGlmICh0aGlzLiQuYWRkVmVyc2lvbkNhbmNlbCkge1xyXG4gICAgICAgICAgICB0aGlzLiQuYWRkVmVyc2lvbkNhbmNlbC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcclxuICAgICAgICAgICAgICAgIHRoaXMuaGlkZUFkZFZlcnNpb25Nb2RhbCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLiQuYWRkVmVyc2lvbkNvbmZpcm0pIHtcclxuICAgICAgICAgICAgdGhpcy4kLmFkZFZlcnNpb25Db25maXJtLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5hZGROZXdWZXJzaW9uKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdC+0YLQutCwIEVudGVyINCyINC/0L7Qu9C1INCy0LLQvtC00LBcclxuICAgICAgICBpZiAodGhpcy4kLmFkZFZlcnNpb25JbnB1dCkge1xyXG4gICAgICAgICAgICB0aGlzLiQuYWRkVmVyc2lvbklucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTmV3VmVyc2lvbigpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcclxuICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5oaWRlQWRkVmVyc2lvbk1vZGFsKCk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdC+0YLRh9C40LrQuCDQtNC70Y8g0LrQvdC+0L/QutC4INC00L7QsdCw0LLQu9C10L3QuNGPINC/0LXRgNC10LzQtdC90L3QvtC5XHJcbiAgICAgICAgaWYgKHRoaXMuJC5hZGRWYXJpYWJsZUJ1dHRvbikge1xyXG4gICAgICAgICAgICB0aGlzLiQuYWRkVmFyaWFibGVCdXR0b24uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcclxuICAgICAgICAgICAgICAgIHRoaXMuc2hvd0FkZFZhcmlhYmxlTW9kYWwoKTtcclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQntCx0YDQsNCx0L7RgtGH0LjQutC4INC00LvRjyDQvNC+0LTQsNC70YzQvdC+0LPQviDQvtC60L3QsCDQtNC+0LHQsNCy0LvQtdC90LjRjyDQv9C10YDQtdC80LXQvdC90L7QuVxyXG4gICAgICAgIGlmICh0aGlzLiQuYWRkVmFyaWFibGVDYW5jZWwpIHtcclxuICAgICAgICAgICAgdGhpcy4kLmFkZFZhcmlhYmxlQ2FuY2VsLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5oaWRlQWRkVmFyaWFibGVNb2RhbCgpO1xyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLiQuYWRkVmFyaWFibGVDb25maXJtKSB7XHJcbiAgICAgICAgICAgIHRoaXMuJC5hZGRWYXJpYWJsZUNvbmZpcm0uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLmFkZE5ld1ZhcmlhYmxlKCk7XHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgLy8g0J7QsdGA0LDQsdC+0YLQutCwIEVudGVyINCyINC/0L7Qu9GP0YUg0LLQstC+0LTQsCDQv9C10YDQtdC80LXQvdC90L7QuVxyXG4gICAgICAgIGlmICh0aGlzLiQuYWRkVmFyaWFibGVOYW1lSW5wdXQpIHtcclxuICAgICAgICAgICAgdGhpcy4kLmFkZFZhcmlhYmxlTmFtZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHZhbHVlSW5wdXQgPSB0aGlzLiQuYWRkVmFyaWFibGVWYWx1ZUlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQ7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHZhbHVlSW5wdXQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgdmFsdWVJbnB1dC5mb2N1cygpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZUFkZFZhcmlhYmxlTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAodGhpcy4kLmFkZFZhcmlhYmxlVmFsdWVJbnB1dCkge1xyXG4gICAgICAgICAgICB0aGlzLiQuYWRkVmFyaWFibGVWYWx1ZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoJ2tleWRvd24nLCAoZSkgPT4ge1xyXG4gICAgICAgICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuYWRkTmV3VmFyaWFibGUoKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdFc2NhcGUnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuaGlkZUFkZFZhcmlhYmxlTW9kYWwoKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICAvLyDQmNC90LjRhtC40LDQu9C40LfQuNGA0YPQtdC8INCy0LjQtNC40LzQvtGB0YLRjCDQs9Cw0LvQvtGH0LXQuiDQvtGH0LjRgdGC0LrQuFxyXG4gICAgICAgIHRoaXMudG9nZ2xlQ2xlYXJEaXN0VmlzaWJpbGl0eSgpO1xyXG4gICAgICAgIHRoaXMudG9nZ2xlQ2xlYXJTZnRwVmlzaWJpbGl0eSgpO1xyXG5cclxuICAgICAgICAvLyDQmNC90LjRhtC40LDQu9C40LfQuNGA0YPQtdC8INGB0LjRgdGC0LXQvNGDINC/0L7QtNGB0LrQsNC30L7QulxyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZVRvb2x0aXBzKCk7XHJcbiAgICB9XHJcbn0pO1xyXG4iXX0=
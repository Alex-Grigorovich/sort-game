/**
 * Модуль управления модальными окнами
 * Отвечает за показ/скрытие модальных окон, обработку событий и анимации
 */

export interface ModalElements {
    warningModal: HTMLElement;
    warningCancel: HTMLButtonElement;
    warningContinue: HTMLButtonElement;
    sftpWarningModal: HTMLElement;
    sftpWarningCancel: HTMLButtonElement;
    sftpWarningContinue: HTMLButtonElement;
    sftpCleanInfo: HTMLElement;
    unsavedChangesModal: HTMLElement;
    unsavedChangesCancel: HTMLButtonElement;
    unsavedChangesDiscard: HTMLButtonElement;
    unsavedSceneChangesModal: HTMLElement;
    unsavedSceneCancel: HTMLButtonElement;
    unsavedSceneSave: HTMLButtonElement;
    unsavedSceneContinue: HTMLButtonElement;
    updateCompletedModal: HTMLElement;
    updateCompletedOk: HTMLButtonElement;
    infoSection: HTMLElement;
    toggleInfoButton: HTMLButtonElement;
    closeInfoButton: HTMLButtonElement;
    pathsSection: HTMLElement;
    togglePathsButton: HTMLButtonElement;
    closePathsButton: HTMLButtonElement;
    validatorSection: HTMLElement;
    toggleValidatorButton: HTMLButtonElement;
    closeValidatorButton: HTMLButtonElement;
}

export interface ModalCallbacks {
    onWarningContinue: () => void;
    onSftpWarningContinue: () => void;
    onUnsavedChangesDiscard?: () => Promise<void> | void;
    onUnsavedSceneCancel?: () => void;
    onUnsavedSceneSave?: () => Promise<void> | void;
    onUnsavedSceneContinue?: () => void;
    onValidatorOpen?: () => void;
    onPathsOpen?: () => void; // Вызывается при открытии секции paths
    onInfoOpen?: () => void; // Вызывается при открытии секции info (редактора версий)
    onCheckUnsavedChanges?: () => boolean; // Проверка наличия несохраненных изменений
}

export class ModalManager {
    private elements: ModalElements;
    private callbacks: ModalCallbacks;

    constructor(elements: ModalElements, callbacks: ModalCallbacks) {
        this.elements = elements;
        this.callbacks = callbacks;
        this.setupEventListeners();
    }

    /**
     * Настройка всех обработчиков событий для модальных окон
     */
    private setupEventListeners(): void {
        this.setupWarningModal();
        this.setupSftpWarningModal();
        this.setupUnsavedChangesModal();
        this.setupUnsavedSceneChangesModal();
        this.setupUpdateCompletedModal();
        this.setupInfoSection();
        this.setupPathsSection();
        this.setupValidatorSection();
        this.setupKeyboardHandlers();
    }

    /**
     * Настройка модального окна предупреждения
     */
    private setupWarningModal(): void {
        const { warningModal, warningCancel, warningContinue } = this.elements;

        if (warningCancel) {
            warningCancel.addEventListener('click', () => this.hideWarningModal());
        }

        if (warningContinue) {
            warningContinue.addEventListener('click', () => this.callbacks.onWarningContinue());
        }

        // Закрытие по клику на фон
        if (warningModal) {
            warningModal.addEventListener('click', (e) => {
                if (e.target === warningModal) {
                    this.hideWarningModal();
                }
            });
        }
    }

    /**
     * Настройка модального окна предупреждения SFTP
     */
    private setupSftpWarningModal(): void {
        const { sftpWarningModal, sftpWarningCancel, sftpWarningContinue } = this.elements;

        if (sftpWarningCancel) {
            sftpWarningCancel.addEventListener('click', () => this.hideSftpWarningModal());
        }

        if (sftpWarningContinue) {
            sftpWarningContinue.addEventListener('click', () => this.callbacks.onSftpWarningContinue());
        }

        // Закрытие по клику на фон
        if (sftpWarningModal) {
            sftpWarningModal.addEventListener('click', (e) => {
                if (e.target === sftpWarningModal) {
                    this.hideSftpWarningModal();
                }
            });
        }
    }

    /**
     * Настройка модального окна предупреждения о несохраненных изменениях
     */
    private setupUnsavedChangesModal(): void {
        const { unsavedChangesModal, unsavedChangesCancel, unsavedChangesDiscard } = this.elements;

        if (unsavedChangesCancel) {
            unsavedChangesCancel.addEventListener('click', () => this.hideUnsavedChangesModal());
        }

        if (unsavedChangesDiscard) {
            unsavedChangesDiscard.addEventListener('click', () => {
                if (this.callbacks.onUnsavedChangesDiscard) {
                    this.callbacks.onUnsavedChangesDiscard();
                }
                this.hideUnsavedChangesModal();
                
                // Если есть отложенное закрытие info-section, выполняем его
                if ((this as any).pendingCloseInfoSection) {
                    (this as any).pendingCloseInfoSection();
                    (this as any).pendingCloseInfoSection = null;
                }
            });
        }

        // Закрытие по клику на фон
        if (unsavedChangesModal) {
            unsavedChangesModal.addEventListener('click', (e) => {
                if (e.target === unsavedChangesModal) {
                    this.hideUnsavedChangesModal();
                }
            });
        }
    }

    /**
     * Настройка информационной секции
     */
    private setupInfoSection(): void {
        const { infoSection, toggleInfoButton, closeInfoButton } = this.elements;

        if (toggleInfoButton) {
            toggleInfoButton.addEventListener('click', () => this.toggleInfoSection());
        }

        if (closeInfoButton) {
            closeInfoButton.addEventListener('click', () => this.closeInfoSection());
        }

        // Закрытие по клику на фон
        if (infoSection) {
            infoSection.addEventListener('click', (e) => {
                if (e.target === infoSection) {
                    this.closeInfoSection();
                }
            });
        }
    }

    /**
     * Настройка модального окна предупреждения о несохраненных изменениях в сцене
     */
    private setupUnsavedSceneChangesModal(): void {
        const { unsavedSceneChangesModal, unsavedSceneCancel, unsavedSceneSave, unsavedSceneContinue } = this.elements;

        if (unsavedSceneCancel) {
            unsavedSceneCancel.addEventListener('click', () => this.hideUnsavedSceneChangesModal());
        }

        if (unsavedSceneSave) {
            unsavedSceneSave.addEventListener('click', async () => {
                if (this.callbacks.onUnsavedSceneSave) {
                    await this.callbacks.onUnsavedSceneSave();
                }
                this.hideUnsavedSceneChangesModal();
            });
        }

        if (unsavedSceneContinue) {
            unsavedSceneContinue.addEventListener('click', () => {
                if (this.callbacks.onUnsavedSceneContinue) {
                    this.callbacks.onUnsavedSceneContinue();
                }
                this.hideUnsavedSceneChangesModal();
            });
        }

        // Закрытие по клику на фон
        if (unsavedSceneChangesModal) {
            unsavedSceneChangesModal.addEventListener('click', (e) => {
                if (e.target === unsavedSceneChangesModal) {
                    this.hideUnsavedSceneChangesModal();
                }
            });
        }
    }

    /**
     * Настройка модального окна об обновлении
     */
    private setupUpdateCompletedModal(): void {
        const { updateCompletedModal, updateCompletedOk } = this.elements;

        if (updateCompletedOk) {
            updateCompletedOk.addEventListener('click', () => this.hideUpdateCompletedModal());
        }

        // Закрытие по клику на фон
        if (updateCompletedModal) {
            updateCompletedModal.addEventListener('click', (e) => {
                if (e.target === updateCompletedModal) {
                    this.hideUpdateCompletedModal();
                }
            });
        }
    }

    /**
     * Настройка секции путей
     */
    private setupPathsSection(): void {
        const { pathsSection, togglePathsButton, closePathsButton } = this.elements;

        if (togglePathsButton) {
            togglePathsButton.addEventListener('click', () => this.togglePathsSection());
        }

        if (closePathsButton) {
            closePathsButton.addEventListener('click', () => this.closePathsSection());
        }

        // Закрытие по клику на фон
        if (pathsSection) {
            pathsSection.addEventListener('click', (e) => {
                if (e.target === pathsSection) {
                    this.closePathsSection();
                }
            });
        }
    }

    /**
     * Настройка секции валидатора
     */
    private setupValidatorSection(): void {
        const { validatorSection, toggleValidatorButton, closeValidatorButton } = this.elements;

        if (toggleValidatorButton) {
            toggleValidatorButton.addEventListener('click', () => this.toggleValidatorSection());
        }

        if (closeValidatorButton) {
            closeValidatorButton.addEventListener('click', () => this.closeValidatorSection());
        }

        // Закрытие по клику на фон
        if (validatorSection) {
            validatorSection.addEventListener('click', (e) => {
                if (e.target === validatorSection) {
                    this.closeValidatorSection();
                }
            });
        }
    }

    /**
     * Настройка обработчиков клавиатуры
     */
    private setupKeyboardHandlers(): void {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.handleEscapeKey();
            }
        });
    }

    /**
     * Обработка нажатия клавиши Escape
     */
    private handleEscapeKey(): void {
        const { warningModal, sftpWarningModal, unsavedChangesModal, unsavedSceneChangesModal, updateCompletedModal, infoSection, pathsSection, validatorSection } = this.elements;

        // Приоритет: warning modal > sftp warning modal > unsaved changes modal > unsaved scene changes modal > update completed modal > info section > paths section > validator section
        if (warningModal && !warningModal.classList.contains('hidden')) {
            this.hideWarningModal();
        } else if (sftpWarningModal && !sftpWarningModal.classList.contains('hidden')) {
            this.hideSftpWarningModal();
        } else if (unsavedChangesModal && !unsavedChangesModal.classList.contains('hidden')) {
            this.hideUnsavedChangesModal();
        } else if (unsavedSceneChangesModal && !unsavedSceneChangesModal.classList.contains('hidden')) {
            this.hideUnsavedSceneChangesModal();
        } else if (updateCompletedModal && !updateCompletedModal.classList.contains('hidden')) {
            this.hideUpdateCompletedModal();
        } else if (infoSection && infoSection.classList.contains('show')) {
            this.closeInfoSection();
        } else if (pathsSection && pathsSection.classList.contains('show')) {
            this.closePathsSection();
        } else if (validatorSection && validatorSection.classList.contains('show')) {
            this.closeValidatorSection();
        }
    }

    /**
     * Показать модальное окно предупреждения
     */
    showWarningModal(): void {
        const { warningModal } = this.elements;
        if (!warningModal) return;

        warningModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            warningModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    /**
     * Скрыть модальное окно предупреждения
     */
    hideWarningModal(): void {
        const { warningModal } = this.elements;
        if (!warningModal) return;

        warningModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            warningModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Показать модальное окно предупреждения SFTP
     */
    showSftpWarningModal(): void {
        const { sftpWarningModal } = this.elements;
        if (!sftpWarningModal) return;

        sftpWarningModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            sftpWarningModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    /**
     * Скрыть модальное окно предупреждения SFTP
     */
    hideSftpWarningModal(): void {
        const { sftpWarningModal } = this.elements;
        if (!sftpWarningModal) return;

        sftpWarningModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            sftpWarningModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Переключить информационную секцию
     */
    toggleInfoSection(): void {
        const { infoSection } = this.elements;
        if (!infoSection) return;

        const isOpen = infoSection.classList.contains('show');
        if (isOpen) {
            this.closeInfoSection();
        } else {
            this.openInfoSection();
        }
    }

    /**
     * Открыть информационную секцию
     */
    openInfoSection(): void {
        const { infoSection } = this.elements;
        if (!infoSection) return;

        // Блокируем скролл body
        document.body.classList.add('modal-open');

        infoSection.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            infoSection.classList.add('show');
            // Вызываем callback для загрузки свежих данных
            if (this.callbacks.onInfoOpen) {
                this.callbacks.onInfoOpen();
            }
        }, 10);
    }

    /**
     * Закрыть информационную секцию
     */
    closeInfoSection(): void {
        const { infoSection } = this.elements;
        if (!infoSection) return;

        // Проверяем наличие несохраненных изменений перед закрытием
        if (this.callbacks.onCheckUnsavedChanges && this.callbacks.onCheckUnsavedChanges()) {
            // Есть несохраненные изменения - показываем модальное окно
            this.showUnsavedChangesModal();
            // Сохраняем callback для закрытия секции после подтверждения
            (this as any).pendingCloseInfoSection = () => {
                this.doCloseInfoSection();
            };
            return;
        }

        // Нет несохраненных изменений - закрываем сразу
        this.doCloseInfoSection();
    }

    /**
     * Выполнить закрытие информационной секции
     */
    private doCloseInfoSection(): void {
        const { infoSection } = this.elements;
        if (!infoSection) return;

        infoSection.classList.remove('show');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            infoSection.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Переключить секцию путей
     */
    togglePathsSection(): void {
        const { pathsSection, infoSection, validatorSection } = this.elements;

        if (!pathsSection) return;

        // Закрываем другие секции при открытии этой
        if (infoSection && infoSection.classList.contains('show')) {
            this.closeInfoSection();
        }
        if (validatorSection && validatorSection.classList.contains('show')) {
            this.closeValidatorSection();
        }

        if (pathsSection.classList.contains('show')) {
            this.closePathsSection();
        } else {
            pathsSection.classList.add('show');
            // Блокируем скролл body
            document.body.classList.add('modal-open');
            // Вызываем callback для обновления данных
            if (this.callbacks.onPathsOpen) {
                this.callbacks.onPathsOpen();
            }
        }
    }

    /**
     * Закрыть секцию путей
     */
    closePathsSection(): void {
        const { pathsSection } = this.elements;
        if (!pathsSection) return;

        pathsSection.classList.remove('show');
        // Разблокируем скролл body
        document.body.classList.remove('modal-open');
    }

    /**
     * Переключить секцию валидатора
     */
    toggleValidatorSection(): void {
        const { validatorSection } = this.elements;
        if (!validatorSection) return;

        const isOpen = validatorSection.classList.contains('show');
        if (isOpen) {
            this.closeValidatorSection();
        } else {
            this.openValidatorSection();
        }
    }

    /**
     * Открыть секцию валидатора
     */
    openValidatorSection(): void {
        const { validatorSection } = this.elements;
        if (!validatorSection) return;

        // Блокируем скролл body
        document.body.classList.add('modal-open');

        validatorSection.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            validatorSection.classList.add('show');
            // Вызываем callback для запуска валидации
            if (this.callbacks.onValidatorOpen) {
                this.callbacks.onValidatorOpen();
            }
        }, 10);
    }

    /**
     * Закрыть секцию валидатора
     */
    closeValidatorSection(): void {
        const { validatorSection } = this.elements;
        if (!validatorSection) return;

        validatorSection.classList.remove('show');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            validatorSection.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Показать предупреждение SFTP с информацией о clean-info
     */
    showSftpWarningWithInfo(): void {
        const { sftpCleanInfo } = this.elements;
        if (!sftpCleanInfo) return;

        sftpCleanInfo.innerHTML = '<p>Collecting folder information...</p>';
        this.showSftpWarningModal();
    }

    /**
     * Обновить информацию в модальном окне SFTP
     */
    updateSftpCleanInfo(htmlContent: string): void {
        const { sftpCleanInfo } = this.elements;
        if (sftpCleanInfo) {
            sftpCleanInfo.innerHTML = htmlContent;
        }
    }

    /**
     * Показать модальное окно предупреждения о несохраненных изменениях
     */
    showUnsavedChangesModal(): void {
        const { unsavedChangesModal } = this.elements;
        if (!unsavedChangesModal) return;

        unsavedChangesModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            unsavedChangesModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    /**
     * Скрыть модальное окно предупреждения о несохраненных изменениях
     */
    hideUnsavedChangesModal(): void {
        const { unsavedChangesModal } = this.elements;
        if (!unsavedChangesModal) return;

        unsavedChangesModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            unsavedChangesModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Показать модальное окно об обновлении
     */
    showUpdateCompletedModal(): void {
        const { updateCompletedModal } = this.elements;
        if (!updateCompletedModal) return;

        updateCompletedModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            updateCompletedModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    /**
     * Показать модальное окно предупреждения о несохраненных изменениях в сцене
     */
    showUnsavedSceneChangesModal(): void {
        const { unsavedSceneChangesModal } = this.elements;
        if (!unsavedSceneChangesModal) return;

        unsavedSceneChangesModal.style.display = 'flex';
        // Небольшая задержка для плавной анимации
        setTimeout(() => {
            unsavedSceneChangesModal.classList.remove('hidden');
        }, 10);
        // Блокируем скролл body
        document.body.classList.add('modal-open');
    }

    /**
     * Скрыть модальное окно предупреждения о несохраненных изменениях в сцене
     */
    hideUnsavedSceneChangesModal(): void {
        const { unsavedSceneChangesModal } = this.elements;
        if (!unsavedSceneChangesModal) return;

        if (this.callbacks.onUnsavedSceneCancel) {
            this.callbacks.onUnsavedSceneCancel();
        }

        unsavedSceneChangesModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            unsavedSceneChangesModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }

    /**
     * Скрыть модальное окно об обновлении
     */
    hideUpdateCompletedModal(): void {
        const { updateCompletedModal } = this.elements;
        if (!updateCompletedModal) return;

        updateCompletedModal.classList.add('hidden');
        // Ждем завершения анимации перед скрытием
        setTimeout(() => {
            updateCompletedModal.style.display = 'none';
            // Разблокируем скролл body
            document.body.classList.remove('modal-open');
        }, 300);
    }
}
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
    infoSection: HTMLElement;
    toggleInfoButton: HTMLButtonElement;
    closeInfoButton: HTMLButtonElement;
    validatorSection: HTMLElement;
    toggleValidatorButton: HTMLButtonElement;
    closeValidatorButton: HTMLButtonElement;
}

export interface ModalCallbacks {
    onWarningContinue: () => void;
    onSftpWarningContinue: () => void;
    onValidatorOpen?: () => void;
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
        this.setupInfoSection();
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
        const { warningModal, sftpWarningModal, infoSection, validatorSection } = this.elements;

        // Приоритет: warning modal > sftp warning modal > info section > validator section
        if (warningModal && !warningModal.classList.contains('hidden')) {
            this.hideWarningModal();
        } else if (sftpWarningModal && !sftpWarningModal.classList.contains('hidden')) {
            this.hideSftpWarningModal();
        } else if (infoSection && infoSection.classList.contains('show')) {
            this.closeInfoSection();
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
        }, 10);
    }

    /**
     * Закрыть информационную секцию
     */
    closeInfoSection(): void {
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
}

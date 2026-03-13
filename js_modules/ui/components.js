// js_modules/ui/components.js

import { dom } from './dom.js';

// Track the currently active toast element
let currentToastElement = null;
let currentToastTimer = null;

export function showToast(message, type = 'success', persistent = false) {
    // 1. Dismiss existing toast (Slide Down Animation)
    if (currentToastElement) {
        const oldToast = currentToastElement;
        
        // Clear any pending removal timer for the old toast
        if (currentToastTimer) {
            clearTimeout(currentToastTimer);
            currentToastTimer = null;
        }

        // Trigger Exit Animation
        oldToast.classList.remove('show');
        oldToast.classList.add('exit');

        // Remove from DOM after animation finishes (500ms matches CSS transition)
        setTimeout(() => {
            if (oldToast && oldToast.parentNode) {
                oldToast.remove();
            }
        }, 500);
    }

    // 2. Create New Toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // Start hidden (CSS default)
    toast.textContent = message;
    
    document.body.appendChild(toast);
    currentToastElement = toast;

    // Force Reflow to ensure transition triggers
    void toast.offsetWidth;

    // 3. Trigger Enter Animation (Slide Up)
    toast.classList.add('show');

    // 4. Handle Auto-Dismiss
    if (!persistent) {
        currentToastTimer = setTimeout(() => {
            // Only dismiss if this is still the active toast
            if (currentToastElement === toast) {
                toast.classList.remove('show');
                toast.classList.add('exit');
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                    if (currentToastElement === toast) currentToastElement = null;
                }, 500);
            }
        }, 3000);
    }
}

function openModal(modalElement) {
    document.body.classList.add('modal-open');
    document.body.appendChild(modalElement);
}

function closeModal(modalElement) {
    if (modalElement) {
        const isLastModal = document.querySelectorAll('.modal-bg:not(.hidden)').length <= 1;
        if (modalElement.id === 'confirmationModal') {
            modalElement.classList.add('hidden');
        } else {
            modalElement.remove();
        }
        if (isLastModal) {
            document.body.classList.remove('modal-open');
        }
    }
}

export function round(v, d = 3){ if (v === undefined || v === null || Number.isNaN(v)) return '-'; if (d === 0) return Math.round(v); const m = Math.pow(10, d); return (Math.round(v * m) / m).toFixed(d); }
export function createTd(className = '') { const td = document.createElement('td'); if (className) td.className = className; return td; }

export function createInput (type, val, onChangeFn, attrs = {}) {
    const input = document.createElement('input');
    input.type = type;
    input.value = val;
    for (const key in attrs) { input[key] = attrs[key]; }
    input.addEventListener('change', (e) => {
        let value = e.target.value;
        if (input.type === 'number') {
            const min = parseFloat(input.min); const max = parseFloat(input.max);
            value = parseFloat(value);
            if (isNaN(value)) value = min;
            if (value > max) value = max; if (value < min) value = min;
            input.value = value;
        }
        onChangeFn(input.type === 'number' ? Number(value) : value);
    });
    return input;
}

export function createSelectWithOptions (options, val, onChangeFn) {
    const select = document.createElement('select');
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value; option.textContent = opt.text;
        select.appendChild(option);
    });
    select.value = val;
    select.onchange = (e) => onChangeFn(e.target.value);
    return select;
}

export function showConfirmationModal(message, onConfirm) {
    dom.confirmModalMessage.textContent = message;
    const oldConfirmBtn = dom.confirmBtn;
    dom.confirmBtn = oldConfirmBtn.cloneNode(true);
    oldConfirmBtn.parentNode.replaceChild(dom.confirmBtn, oldConfirmBtn);

    const oldCancelBtn = dom.cancelBtn;
    dom.cancelBtn = oldCancelBtn.cloneNode(true);
    oldCancelBtn.parentNode.replaceChild(dom.cancelBtn, oldCancelBtn);

    const confirmHandler = () => { onConfirm(); closeModal(dom.confirmationModal); };
    const cancelHandler = () => { closeModal(dom.confirmationModal); };
    
    dom.confirmBtn.addEventListener('click', confirmHandler);
    dom.cancelBtn.addEventListener('click', cancelHandler);
    
    dom.confirmationModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    dom.confirmBtn.focus();
}

export function initializeTooltips() {
    let tooltipTimer;
    document.body.addEventListener('mouseenter', (e) => {
        const elem = e.target.closest('[data-tooltip]');
        if (!elem) return;
        tooltipTimer = setTimeout(() => {
            dom.tooltip.textContent = elem.dataset.tooltip;
            dom.tooltip.classList.add('visible');
        }, 300);
    }, true);
    document.body.addEventListener('mousemove', (e) => {
        if (!dom.tooltip.classList.contains('visible')) return;
        dom.tooltip.style.left = `${e.clientX + 15}px`;
        dom.tooltip.style.top = `${e.clientY + 15}px`;
    }, true);
    document.body.addEventListener('mouseleave', (e) => {
        const elem = e.target.closest('[data-tooltip]');
        if (!elem) return;
        clearTimeout(tooltipTimer);
        dom.tooltip.classList.remove('visible');
    }, true);
}

export function initializeAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => { header.parentElement.classList.toggle('active'); });
    });
}

export { openModal, closeModal };
/**
 * FILE: components.js
 * PROCESS: Renderer
 * ROLE: Reusable UI primitive components — toast notifications, modal open/close,
 *       tooltip initialization, accordion setup, and shared utility functions.
 *       No app-specific business logic lives here.
 *
 * DEPENDENCIES:
 *   - ui/dom.js: dom — for the confirmation modal's button refs and shared tooltip element
 *
 * EXPORTS:
 *   - showToast(message, type, persistent): Display a slide-in notification
 *   - openModal(element): Append modal to body + lock scroll
 *   - closeModal(element): Remove or hide modal + restore scroll
 *   - round(v, d): Format a number to d decimal places
 *   - createTd(className): Create a <td> element with optional class
 *   - createInput(type, val, onChangeFn, attrs): Create a typed <input> element
 *   - createSelectWithOptions(options, val, onChangeFn): Create a <select> element
 *   - showConfirmationModal(message, onConfirm): Show a confirmation dialog
 *   - initializeTooltips(): Wire the global floating tooltip behavior
 *   - initializeAccordion(): Wire click handlers for accordion UI sections
 *
 * DOCS:
 *   - docs/architecture/overview.md → Module Responsibilities (ui/components.js)
 */

import { dom } from './dom.js';

// ── TOAST STATE MACHINE ───────────────────────────────────────────────────────
// Only one toast is shown at a time. These module-level variables track the
// active toast element and its auto-dismiss timer so we can interrupt them
// when a new toast is triggered before the old one finishes.
let currentToastElement = null; // Reference to the currently visible toast div
let currentToastTimer = null;   // setTimeout handle for auto-dismissing the current toast

/**
 * FUNCTION: showToast
 * PURPOSE: Shows a slide-in notification at the bottom of the screen.
 *          If a toast is already visible, it is dismissed (slide-out) before
 *          the new one appears. Supports persistent toasts (no auto-dismiss)
 *          for in-progress operations like API fetches.
 *
 * @param message    - Text content for the notification
 * @param type       - CSS class to apply: 'success' | 'error' | 'info' (default: 'success')
 * @param persistent - If true, toast stays until the next showToast() call.
 *                     Use for "Loading..." messages that should stay until done.
 *
 * SIDE EFFECTS:
 *   - Appends new <div class="toast"> to document.body
 *   - Removes/exits old toast if one was visible
 *   - Sets setTimeout for auto-dismiss (3000ms) if not persistent
 *
 * CALLED BY: Nearly every module that needs user feedback
 */
export function showToast(message, type = 'success', persistent = false) {
    // 1. Dismiss any existing toast with a slide-out animation
    if (currentToastElement) {
        const oldToast = currentToastElement;

        // Cancel the pending auto-dismiss timer so it doesn't interfere
        if (currentToastTimer) {
            clearTimeout(currentToastTimer);
            currentToastTimer = null;
        }

        // Trigger CSS slide-out animation (removes 'show', adds 'exit')
        oldToast.classList.remove('show');
        oldToast.classList.add('exit');

        // Remove from DOM after the CSS transition completes (500ms = transition length)
        setTimeout(() => {
            if (oldToast && oldToast.parentNode) {
                oldToast.remove();
            }
        }, 500);
    }

    // 2. Create the new toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`; // Initial state: off-screen (CSS positions it)
    toast.textContent = message;

    document.body.appendChild(toast);
    currentToastElement = toast;

    // 3. Force a browser reflow before adding 'show' class.
    //    Without this, the browser may batch the append + class change, skipping
    //    the CSS transition entirely (the toast would just appear without animating).
    void toast.offsetWidth; // Accessing offsetWidth forces a layout recalculation

    // 4. Trigger the slide-in animation
    toast.classList.add('show');

    // 5. Set auto-dismiss timer unless the toast should be persistent
    if (!persistent) {
        currentToastTimer = setTimeout(() => {
            // Only dismiss if this toast is still the active one
            // (guards against race conditions if showToast was called again)
            if (currentToastElement === toast) {
                toast.classList.remove('show');
                toast.classList.add('exit');
                setTimeout(() => {
                    if (toast.parentNode) toast.remove();
                    if (currentToastElement === toast) currentToastElement = null;
                }, 500);
            }
        }, 3000); // 3 seconds visible
    }
}

// ── MODAL OPEN / CLOSE ────────────────────────────────────────────────────────

/**
 * FUNCTION: openModal
 * PURPOSE: Appends a modal element to the document body and locks body scroll.
 *          All dynamic modals (attack editor, lineup editor) use this to mount.
 *
 * @param modalElement - The modal DOM element to display
 *
 * SIDE EFFECTS:
 *   - Appends modal to document.body
 *   - Adds 'modal-open' class to body (CSS prevents background scroll)
 *
 * CALLED BY: ui/modal_attackdata_editor.js, ui/modal_lineup_editor.js
 */
function openModal(modalElement) {
    document.body.classList.add('modal-open'); // Lock background scroll
    document.body.appendChild(modalElement);
}

/**
 * FUNCTION: closeModal
 * PURPOSE: Dismisses a modal and restores body scroll if no other modals remain.
 *          Handles two cases: dynamic modals (removed from DOM) and the static
 *          confirmation modal (toggled with .hidden class).
 *
 * @param modalElement - The modal DOM element to dismiss
 *
 * SIDE EFFECTS:
 *   - Removes dynamic modals from DOM completely
 *   - Adds .hidden class to the static confirmationModal
 *   - Removes 'modal-open' from body only if this was the last visible modal
 *
 * CALLED BY: ui/modal_attackdata_editor.js, ui/modal_lineup_editor.js,
 *            events.js → handleGlobalKeydown()
 */
function closeModal(modalElement) {
    if (modalElement) {
        // Check if this is the last visible modal before removing 'modal-open'
        const isLastModal = document.querySelectorAll('.modal-bg:not(.hidden)').length <= 1;

        if (modalElement.id === 'confirmationModal') {
            // Static modal: just hide it (don't remove from DOM — it's always there)
            modalElement.classList.add('hidden');
        } else {
            // Dynamic modal: remove it entirely from the DOM
            modalElement.remove();
        }

        if (isLastModal) {
            document.body.classList.remove('modal-open'); // Restore scroll
        }
    }
}

// ── SHARED FORMATTING UTILITIES ───────────────────────────────────────────────

/**
 * FUNCTION: round
 * PURPOSE: Formats a number to d decimal places for display. Returns '-' for
 *          missing/null/NaN values so table cells always show something.
 *
 * @param v - Value to format (number or null/undefined/NaN)
 * @param d - Decimal places (default: 3). Pass 0 for integer display.
 * @returns Formatted string or '-'
 *
 * CALLED BY: ui/main_view.js, ui/modal_attackdata_editor.js
 */
export function round(v, d = 3){ if (v === undefined || v === null || Number.isNaN(v)) return '-'; if (d === 0) return Math.round(v); const m = Math.pow(10, d); return (Math.round(v * m) / m).toFixed(d); }

/**
 * FUNCTION: createTd
 * PURPOSE: Creates a <td> element with an optional CSS class. Small utility to
 *          reduce boilerplate in table-building code.
 *
 * @param className - Optional CSS class string to set on the td
 * @returns HTMLTableCellElement
 *
 * CALLED BY: ui/main_view.js (used extensively in row-building functions)
 */
export function createTd(className = '') { const td = document.createElement('td'); if (className) td.className = className; return td; }

/**
 * FUNCTION: createInput
 * PURPOSE: Creates an <input> element with a change handler that enforces
 *          min/max bounds for number inputs.
 *
 * @param type       - Input type string ('text', 'number', 'checkbox', etc.)
 * @param val        - Initial value
 * @param onChangeFn - Callback function called with the validated new value
 * @param attrs      - Optional object of additional properties to set on the input
 * @returns HTMLInputElement
 *
 * CALLED BY: ui/modal_attackdata_editor.js (no longer actively used — preserved for potential future use)
 */
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
            if (isNaN(value)) value = min;         // Clamp NaN to min
            if (value > max) value = max; if (value < min) value = min;
            input.value = value;
        }
        onChangeFn(input.type === 'number' ? Number(value) : value);
    });
    return input;
}

/**
 * FUNCTION: createSelectWithOptions
 * PURPOSE: Creates a <select> element populated with an array of options.
 *
 * @param options    - Array of { value, text } objects for the option elements
 * @param val        - Initially selected value
 * @param onChangeFn - Callback called with the new selected value string on change
 * @returns HTMLSelectElement
 *
 * CALLED BY: ui/modal_attackdata_editor.js (no longer actively used — preserved for future use)
 */
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

// ── CONFIRMATION MODAL ────────────────────────────────────────────────────────

/**
 * FUNCTION: showConfirmationModal
 * PURPOSE: Displays the static confirmation modal with a custom message and
 *          confirm/cancel handlers. Clones buttons to wipe any previously
 *          attached event listeners before adding fresh ones.
 *
 * @param message   - Warning message text to display in the modal body
 * @param onConfirm - Callback called when the user clicks "Confirm"
 *
 * TECHNIQUE: Button cloning (cloneNode + replaceChild) is used to remove all
 *   previously attached click listeners without needing to track them manually.
 *   This prevents "confirm action stacking" if the modal is shown multiple times.
 *
 * SIDE EFFECTS:
 *   - Updates dom.confirmModalMessage.textContent
 *   - Replaces dom.confirmBtn and dom.cancelBtn with clones (wipes old listeners)
 *   - Removes .hidden from confirmationModal and adds 'modal-open' to body
 *   - Focuses the confirm button for keyboard accessibility
 *
 * CALLED BY: events.js → resetDataBtn click listener
 */
export function showConfirmationModal(message, onConfirm) {
    dom.confirmModalMessage.textContent = message;

    // Clone confirm button to remove all previously attached event listeners
    const oldConfirmBtn = dom.confirmBtn;
    dom.confirmBtn = oldConfirmBtn.cloneNode(true);
    oldConfirmBtn.parentNode.replaceChild(dom.confirmBtn, oldConfirmBtn);

    // Clone cancel button to remove all previously attached event listeners
    const oldCancelBtn = dom.cancelBtn;
    dom.cancelBtn = oldCancelBtn.cloneNode(true);
    oldCancelBtn.parentNode.replaceChild(dom.cancelBtn, oldCancelBtn);

    // Wire up fresh handlers
    const confirmHandler = () => { onConfirm(); closeModal(dom.confirmationModal); };
    const cancelHandler = () => { closeModal(dom.confirmationModal); };

    dom.confirmBtn.addEventListener('click', confirmHandler);
    dom.cancelBtn.addEventListener('click', cancelHandler);

    dom.confirmationModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    dom.confirmBtn.focus(); // Keyboard accessibility: focus confirm button
}

// ── TOOLTIP ───────────────────────────────────────────────────────────────────

/**
 * FUNCTION: initializeTooltips
 * PURPOSE: Sets up the global floating tooltip. Any element with a data-tooltip
 *          attribute gets a tooltip shown on hover (after a 300ms delay).
 *          The tooltip follows the mouse cursor position.
 *
 * TECHNIQUE: Uses event delegation on document.body for mouseenter/mouseleave
 *   to avoid attaching individual listeners to every tooltip-bearing element.
 *   Uses { capture: true } to intercept events before they bubble.
 *
 * SIDE EFFECTS:
 *   - Attaches mouseenter, mousemove, and mouseleave listeners to document.body
 *
 * CALLED BY: renderer.js (once on startup)
 */
export function initializeTooltips() {
    let tooltipTimer;
    // Show tooltip after a short delay (300ms) to avoid flicker on quick passes
    document.body.addEventListener('mouseenter', (e) => {
        const elem = e.target.closest('[data-tooltip]');
        if (!elem) return;
        tooltipTimer = setTimeout(() => {
            dom.tooltip.textContent = elem.dataset.tooltip;
            dom.tooltip.classList.add('visible');
        }, 300);
    }, true); // capture: true for early interception

    // Update tooltip position to follow the cursor
    document.body.addEventListener('mousemove', (e) => {
        if (!dom.tooltip.classList.contains('visible')) return;
        dom.tooltip.style.left = `${e.clientX + 15}px`; // Offset to avoid covering cursor
        dom.tooltip.style.top = `${e.clientY + 15}px`;
    }, true);

    // Hide tooltip when cursor leaves the element
    document.body.addEventListener('mouseleave', (e) => {
        const elem = e.target.closest('[data-tooltip]');
        if (!elem) return;
        clearTimeout(tooltipTimer);
        dom.tooltip.classList.remove('visible');
    }, true);
}

// ── ACCORDION ─────────────────────────────────────────────────────────────────

/**
 * FUNCTION: initializeAccordion
 * PURPOSE: Wires click handlers to all accordion header elements.
 *          Clicking a header toggles the 'active' class on its parent container,
 *          which CSS uses to show/hide the accordion body.
 *
 * CALLED BY: renderer.js (once on startup)
 */
export function initializeAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => { header.parentElement.classList.toggle('active'); });
    });
}

// Re-export openModal and closeModal so they can be imported by modal modules
export { openModal, closeModal };
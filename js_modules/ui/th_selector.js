/**
 * FILE: th_selector.js
 * PROCESS: Renderer
 * ROLE: Custom Town Hall level dropdown component. Renders a styled selector
 *       with TH images (TH18 down to TH1) instead of a native <select>.
 *       Supports keyboard navigation, smart flip-up positioning, and a
 *       global click-outside-to-close behaviour.
 *
 * DEPENDENCIES: none (standalone UI component)
 *
 * EXPORTS:
 *   - createThSelector(initialValue, onChangeCallback): Creates and returns
 *     a fully wired TH selector widget element
 *
 * DOCS:
 *   - docs/changelogs/v1.1.0.md → TH18 Support (loop now starts at 18)
 */

/**
 * FUNCTION: closeAllThSelectors
 * PURPOSE: Closes all open TH selector dropdowns. Called on document click
 *          to implement click-outside-to-close behaviour. Each selector that
 *          does not contain the clicked element has 'open' removed.
 *
 * @param event - Optional MouseEvent. If provided, selectors containing the
 *                clicked target are NOT closed (allows clicking inside them).
 *                If omitted (called programmatically), ALL selectors are closed.
 *
 * CALLED BY:
 *   - Document 'click' listener at module level (click-outside-to-close)
 *   - createThSelector() → selectedDisplay click handler (before re-opening)
 */
function closeAllThSelectors(event) {
    document.querySelectorAll('.th-selector').forEach(selector => {
        if (!event || !selector.contains(event.target)) {
            selector.classList.remove('open');
        }
    });
}

// Global click listener: closes all TH selectors when clicking anywhere outside them
document.addEventListener('click', closeAllThSelectors);

/**
 * FUNCTION: createThSelector
 * PURPOSE: Creates a fully wired custom TH level dropdown component.
 *          Returns a div element that can be inserted anywhere in the DOM.
 *          The component manages its own open/close state and all user interactions.
 *
 * @param initialValue     - Starting TH level (1-18). Displayed immediately on creation.
 * @param onChangeCallback - Called with the new TH level (number) when user selects one.
 *
 * @returns HTMLDivElement — the .th-selector wrapper element, fully wired and ready to insert
 *
 * COMPONENT STRUCTURE:
 *   .th-selector (wrapper — tabindex for keyboard focus)
 *     .th-selector-selected (the clickable "button" showing current selection)
 *       .th-selector-text-icon-wrapper
 *         .th-selector-text  (TH level number)
 *         .th-selector-icon  (TH image)
 *       .th-selector-caret   (dropdown arrow indicator)
 *     .th-selector-options   (dropdown list, hidden by default)
 *       .th-selector-option × 18  (one per TH level, TH18 first)
 *
 * SMART POSITIONING:
 *   When the dropdown opens, it checks how much space remains below the selector.
 *   If less than 200px below AND more than 200px above, the dropdown flips upward
 *   ('flip-up' class) to avoid being cut off at the screen edge.
 *
 * KEYBOARD SUPPORT:
 *   Enter or Space on the wrapper element triggers the dropdown click.
 *
 * SPECIAL PROPERTY:
 *   wrapper.updateValue(th) — public method to programmatically change the selected value
 *   (e.g., when player TH changes from an API fetch without user interaction)
 *
 * CALLED BY:
 *   - ui/main_view.js → createPlayerRowElement() (TH column in players table)
 */
export function createThSelector(initialValue, onChangeCallback) {
    // ── BUILD COMPONENT STRUCTURE ─────────────────────────────────────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'th-selector';
    wrapper.setAttribute('tabindex', '0'); // Allow keyboard focus

    const selectedDisplay = document.createElement('div');
    selectedDisplay.className = 'th-selector-selected';

    const textIconWrapper = document.createElement('div');
    textIconWrapper.className = 'th-selector-text-icon-wrapper';

    const selectedText = document.createElement('span');
    selectedText.className = 'th-selector-text';

    const selectedIcon = document.createElement('img');
    selectedIcon.className = 'th-selector-icon';

    textIconWrapper.append(selectedText, selectedIcon);

    const caret = document.createElement('i');
    caret.className = 'th-selector-caret'; // CSS rotates this on .open

    selectedDisplay.append(textIconWrapper, caret);

    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'th-selector-options';

    /**
     * FUNCTION: updateDisplay
     * PURPOSE: Updates the selected display area to show the given TH value.
     *          Shows TH number + TH image for valid values (>= 1),
     *          or a prohibition icon for invalid/unset values (0 or null).
     *
     * @param value - TH level number (1-18), or 0/falsy for unset state
     *
     * Also exposed as wrapper.updateValue for external programmatic use.
     */
    function updateDisplay(value) {
        if (value && value >= 1) {
            selectedText.textContent = value;
            selectedIcon.src = `img/th${value}.png`; // e.g., img/th18.png
        } else {
            selectedText.textContent = '';
            selectedIcon.src = 'img/prohibition.png'; // "not set" visual indicator
        }
    }

    // Initialize the display with the provided starting value
    updateDisplay(initialValue);

    // ── BUILD OPTION LIST (TH18 → TH1) ───────────────────────────────────────
    // Loop starts at 18 (added in v1.1.0) and goes down to TH1.
    // TH18 is at the top of the list (most common in CWL).
    for (let i = 18; i >= 1; i--) {
        const option = document.createElement('div');
        option.className = 'th-selector-option';
        option.dataset.value = i;

        // Highlight the currently selected option
        if (i === initialValue) option.classList.add('selected');

        const optionText = document.createElement('span');
        optionText.textContent = i;

        const optionIcon = document.createElement('img');
        optionIcon.className = 'th-selector-icon';
        optionIcon.src = `img/th${i}.png`;

        option.append(optionText, optionIcon);
        optionsContainer.appendChild(option);

        option.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the global click listener from triggering
            updateDisplay(i);   // Update the selected display
            // Move 'selected' highlight to the clicked option
            wrapper.querySelector('.th-selector-option.selected')?.classList.remove('selected');
            option.classList.add('selected');
            onChangeCallback(i); // Notify parent of the new value
            wrapper.classList.remove('open'); // Close the dropdown
        });
    }

    wrapper.append(selectedDisplay, optionsContainer);

    // ── OPEN / CLOSE INTERACTION ──────────────────────────────────────────────
    selectedDisplay.addEventListener('click', (e) => {
        // If the selector is disabled (e.g., locked by parent state), ignore clicks
        if (wrapper.classList.contains('disabled')) return;

        e.stopPropagation(); // Prevent global click-outside from immediately closing

        const wasOpen = wrapper.classList.contains('open');

        // Close all other open selectors first (only one open at a time)
        closeAllThSelectors();

        if (!wasOpen) {
            wrapper.classList.add('open');

            // ── SMART FLIP-UP POSITIONING ─────────────────────────────────────
            // If there's not enough space below the selector, flip the dropdown
            // upward so it doesn't get cut off at the bottom of the viewport.
            const rect = wrapper.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 200 && rect.top > 200) {
                optionsContainer.classList.add('flip-up');
            } else {
                optionsContainer.classList.remove('flip-up');
            }
        }
        // If wasOpen: closeAllThSelectors() already closed it, so nothing more to do
    });

    // ── KEYBOARD SUPPORT ─────────────────────────────────────────────────────
    // Enter or Space opens/closes the dropdown (standard keyboard UX for selects)
    wrapper.addEventListener('keydown', (e) => {
        if (wrapper.classList.contains('disabled')) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault(); // Prevent space from scrolling the page
            selectedDisplay.click();
        }
    });

    // Expose updateDisplay as a public method for external programmatic value changes
    wrapper.updateValue = updateDisplay;

    return wrapper;
}
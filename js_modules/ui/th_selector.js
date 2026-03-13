// js_modules/ui/th_selector.js

function closeAllThSelectors(event) {
    document.querySelectorAll('.th-selector').forEach(selector => {
        if (!event || !selector.contains(event.target)) {
            selector.classList.remove('open');
        }
    });
}

document.addEventListener('click', closeAllThSelectors);

export function createThSelector(initialValue, onChangeCallback) {
    const wrapper = document.createElement('div');
    wrapper.className = 'th-selector';
    wrapper.setAttribute('tabindex', '0');
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
    caret.className = 'th-selector-caret';
    selectedDisplay.append(textIconWrapper, caret);
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'th-selector-options';
    
    function updateDisplay(value) {
        if (value && value >= 1) {
            selectedText.textContent = value;
            selectedIcon.src = `img/th${value}.png`;
        } else {
            selectedText.textContent = '';
            selectedIcon.src = 'img/prohibition.png';
        }
    }
    
    updateDisplay(initialValue);
    
    // ### DEFINITIVE FIX: Loop now starts at 18. ###
    for (let i = 18; i >= 1; i--) {
        const option = document.createElement('div');
        option.className = 'th-selector-option';
        option.dataset.value = i;
        if (i === initialValue) option.classList.add('selected');
        const optionText = document.createElement('span');
        optionText.textContent = i;
        const optionIcon = document.createElement('img');
        optionIcon.className = 'th-selector-icon';
        optionIcon.src = `img/th${i}.png`;
        option.append(optionText, optionIcon);
        optionsContainer.appendChild(option);
        option.addEventListener('click', (e) => {
            e.stopPropagation();
            updateDisplay(i);
            wrapper.querySelector('.th-selector-option.selected')?.classList.remove('selected');
            option.classList.add('selected');
            onChangeCallback(i);
            wrapper.classList.remove('open');
        });
    }
    
    wrapper.append(selectedDisplay, optionsContainer);
    
    selectedDisplay.addEventListener('click', (e) => {
        if (wrapper.classList.contains('disabled')) return;
        e.stopPropagation();
        const wasOpen = wrapper.classList.contains('open');
        closeAllThSelectors();
        if (!wasOpen) {
            wrapper.classList.add('open');
            const rect = wrapper.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 200 && rect.top > 200) optionsContainer.classList.add('flip-up');
            else optionsContainer.classList.remove('flip-up');
        }
    });
    
    wrapper.addEventListener('keydown', (e) => {
        if (wrapper.classList.contains('disabled')) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectedDisplay.click(); }
    });
    
    wrapper.updateValue = updateDisplay;
    return wrapper;
}
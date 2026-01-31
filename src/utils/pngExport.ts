/**
 * Utility to prepare elements for PNG export with html2canvas
 * html2canvas doesn't support oklab() colors from Tailwind v4
 */


// Convert computed styles with oklab/oklch to rgb/hex
function modernColorToHex(colorStr: string): string {
  // Handle both oklab and oklch color functions
  // Simple fallbacks for common colors - html2canvas can't parse these

  // Check if it's a modern color function we need to convert
  if (!colorStr.includes('oklab') && !colorStr.includes('oklch')) {
    return colorStr; // Return as-is if not a modern color
  }

  // Gray shades (by lightness value)
  if (colorStr.includes('0.97') || colorStr.includes('97%')) return '#f5f5f5'; // gray-100
  if (colorStr.includes('0.92') || colorStr.includes('92%')) return '#e5e5e5'; // gray-200
  if (colorStr.includes('0.87') || colorStr.includes('87%')) return '#d4d4d8'; // gray-300
  if (colorStr.includes('0.70') || colorStr.includes('70%')) return '#a1a1aa'; // gray-400
  if (colorStr.includes('0.55') || colorStr.includes('55%')) return '#71717a'; // gray-500
  if (colorStr.includes('0.45') || colorStr.includes('45%')) return '#52525b'; // gray-600
  if (colorStr.includes('0.37') || colorStr.includes('37%')) return '#3f3f46'; // gray-700
  if (colorStr.includes('0.27') || colorStr.includes('27%') || colorStr.includes('0.26')) return '#27272a'; // gray-800
  if (colorStr.includes('0.21') || colorStr.includes('21%') || colorStr.includes('0.18')) return '#18181b'; // gray-900
  if (colorStr.includes('0.14') || colorStr.includes('14%') || colorStr.includes('0.12')) return '#0f0f0f'; // near black

  // Green shades (hue around 140-160)
  if (colorStr.includes('142') || colorStr.includes('145') || colorStr.includes('green')) {
    if (colorStr.includes('0.72') || colorStr.includes('72%')) return '#22c55e'; // green-500
    if (colorStr.includes('0.63') || colorStr.includes('63%')) return '#16a34a'; // green-600
    if (colorStr.includes('0.80') || colorStr.includes('80%')) return '#4ade80'; // green-400
    return '#22c55e'; // default green
  }

  // Red shades (hue around 25-30)
  if (colorStr.includes('25.') || colorStr.includes('29.') || colorStr.includes('red')) {
    if (colorStr.includes('0.63') || colorStr.includes('63%')) return '#ef4444'; // red-500
    if (colorStr.includes('0.58') || colorStr.includes('58%')) return '#dc2626'; // red-600
    if (colorStr.includes('0.70') || colorStr.includes('70%')) return '#f87171'; // red-400
    return '#ef4444'; // default red
  }

  // Coral (our brand - orange-red hue)
  if (colorStr.includes('coral') || colorStr.includes('16.') || (colorStr.includes('0.65') && colorStr.includes('0.2'))) {
    return '#FF6B6B';
  }

  // Blue shades (hue around 230-260)
  if (colorStr.includes('230') || colorStr.includes('250') || colorStr.includes('blue')) {
    if (colorStr.includes('0.62') || colorStr.includes('62%')) return '#3b82f6'; // blue-500
    return '#3b82f6';
  }

  // Yellow/Orange (hue around 40-80)
  if (colorStr.includes('50.') || colorStr.includes('60.') || colorStr.includes('yellow') || colorStr.includes('orange')) {
    return '#facc15'; // yellow-400
  }

  // Purple (hue around 280-310)
  if (colorStr.includes('280') || colorStr.includes('300') || colorStr.includes('purple')) {
    return '#a855f7'; // purple-500
  }

  // White
  if (colorStr.includes('1 ') || colorStr.includes('100%') || colorStr.includes('0.99')) {
    return '#ffffff';
  }

  // Transparent/none
  if (colorStr.includes('none') || colorStr.includes('0 0 0 / 0')) {
    return 'transparent';
  }

  // Default to a neutral gray if we can't match
  return '#71717a';
}

/**
 * Prepare an element for html2canvas by converting oklab colors to hex
 * Returns a cleanup function to restore original styles
 */
export function prepareForCapture(element: HTMLElement): () => void {
  const elementsToRestore: { el: HTMLElement; prop: string; value: string }[] = [];

  function processElement(el: HTMLElement) {
    const computed = window.getComputedStyle(el);

    // Check color properties that might use oklab
    const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor'];

    colorProps.forEach(prop => {
      const cssProp = prop === 'backgroundColor' ? 'background-color' : prop === 'borderColor' ? 'border-color' : prop;
      const value = computed.getPropertyValue(cssProp);
      if (value && (value.includes('oklab') || value.includes('oklch'))) {
        const originalInline = el.style.getPropertyValue(cssProp);
        elementsToRestore.push({
          el,
          prop: cssProp,
          value: originalInline
        });

        const hexColor = modernColorToHex(value);
        if (prop === 'backgroundColor') {
          el.style.backgroundColor = hexColor;
        } else if (prop === 'color') {
          el.style.color = hexColor;
        } else if (prop === 'borderColor') {
          el.style.borderColor = hexColor;
        } else {
          el.style.setProperty(cssProp, hexColor);
        }
      }
    });

    // Process children
    Array.from(el.children).forEach(child => {
      if (child instanceof HTMLElement) {
        processElement(child);
      }
    });
  }

  processElement(element);

  // Return cleanup function
  return () => {
    elementsToRestore.forEach(({ el, prop, value }) => {
      if (value) {
        el.style.setProperty(prop, value);
      } else {
        el.style.removeProperty(prop);
      }
    });
  };
}

/**
 * Simple approach: Clone the element and apply inline hex colors
 * This avoids modifying the original DOM
 */
export async function captureWithColors(
  element: HTMLElement,
  html2canvas: (el: HTMLElement, options?: any) => Promise<HTMLCanvasElement>,
  options: any = {}
): Promise<HTMLCanvasElement> {
  const cleanup = prepareForCapture(element);

  try {
    const canvas = await html2canvas(element, {
      ...options,
      onclone: (clonedDoc: Document, clonedElement: HTMLElement) => {
        // Apply hex colors to cloned element
        applyHexColors(clonedElement);
        if (options.onclone) {
          options.onclone(clonedDoc, clonedElement);
        }
      }
    });
    return canvas;
  } finally {
    cleanup();
  }
}

function applyHexColors(element: HTMLElement) {
  // Apply safe hex colors to all elements in the clone
  const allElements = element.querySelectorAll('*');

  const applyToElement = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el);

    // Background
    const bg = computed.backgroundColor;
    if (bg && (bg.includes('oklab') || bg.includes('oklch'))) {
      el.style.backgroundColor = modernColorToHex(bg);
    }

    // Text color
    const color = computed.color;
    if (color && (color.includes('oklab') || color.includes('oklch'))) {
      el.style.color = modernColorToHex(color);
    }

    // Border
    const border = computed.borderColor;
    if (border && (border.includes('oklab') || border.includes('oklch'))) {
      el.style.borderColor = modernColorToHex(border);
    }
  };

  if (element instanceof HTMLElement) {
    applyToElement(element);
  }

  allElements.forEach(el => {
    if (el instanceof HTMLElement) {
      applyToElement(el);
    }
  });
}

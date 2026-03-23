/**
 * Базовые стили масок пазла для `/styles` и `DndMatchingPuzzleQuestion`.
 * Анимация зазора между колонками — на `.puzzle-pair-grid` (`column-gap`), не на `.puzzle-filter`.
 */
export const PUZZLE_BASE_CSS = `
  .puzzle-left-mask, .puzzle-right-mask {
    --r: 20px;
    --shift: 10px;
    outline: none !important;
    transition: background-color 0.2s ease;
  }
  .puzzle-left-mask {
    -webkit-mask: linear-gradient(#000 0 0) 0 0 / calc(100% - var(--r) - var(--shift)) 100% no-repeat, radial-gradient(var(--r) at calc(100% - var(--r)) 50%, #000 calc(100% - 1px), #0000);
    mask: linear-gradient(#000 0 0) 0 0 / calc(100% - var(--r) - var(--shift)) 100% no-repeat, radial-gradient(var(--r) at calc(100% - var(--r)) 50%, #000 calc(100% - 1px), #0000);
  }
  .puzzle-right-mask {
    -webkit-mask: radial-gradient(var(--r) at var(--shift) 50%, #0000 calc(100% - 1px), #000);
    mask: radial-gradient(var(--r) at var(--shift) 50%, #0000 calc(100% - 1px), #000);
  }
  .puzzle-filter {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    filter: drop-shadow(0 0 1px rgba(0,0,0,0.4)) drop-shadow(0 4px 6px rgba(0,0,0,0.1));
    outline: none !important;
    transition: margin 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s ease;
  }
  .puzzle-pair-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    min-width: 0;
    align-items: stretch;
    box-sizing: border-box;
    transition: column-gap 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

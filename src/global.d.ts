export {};

declare global {
  interface Window {
    renderDashboard: () => void;
    openModule: (id: number) => void;
    triggerFusion: (...args: unknown[]) => void;
    closeModule: () => void;
  }
}

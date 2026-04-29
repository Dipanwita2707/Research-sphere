declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module 'mammoth/mammoth.browser' {
  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }
  function convertToHtml(options: { arrayBuffer: ArrayBuffer }): Promise<ConvertResult>;
  const mammoth: { convertToHtml: typeof convertToHtml };
  export = mammoth;
}

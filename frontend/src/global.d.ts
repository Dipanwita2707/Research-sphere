declare module '*.css' {
  const styles: { [className: string]: string };
  export default styles;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.png' {
  const src: string;
  export default src;
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

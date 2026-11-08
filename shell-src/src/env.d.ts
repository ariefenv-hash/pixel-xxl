/// <reference types="vite/client" />

// import.meta.env 类型面（Vite 内置 + 本壳自定义约定）
interface ImportMetaEnv {
  /** 开发模式标记（vite define） */
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

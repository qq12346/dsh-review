declare module '@deepseek-ai/dsh-client-runtime/client' {
  export type SessionId = string

  export interface ClientContext {
    effect(fn: () => () => void): void
  }
}

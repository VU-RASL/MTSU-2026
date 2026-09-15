// src/types/pinia.d.ts
import 'pinia'

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S, Store> {
    sync?: boolean
    defaultFactory?: () => S
  }
}

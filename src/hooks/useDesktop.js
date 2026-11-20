// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

import { useSyncExternalStore } from 'react'
import { SOGLIA_DESKTOP } from '../lib/pannello'

const QUERY_DESKTOP = `(min-width: ${SOGLIA_DESKTOP}px)`
// true = desktop. In SSR e senza matchMedia si assume desktop (non modale):
// è il caso che non blocca nulla.
export function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === 'undefined' || !window.matchMedia) return () => {}
      const mq = window.matchMedia(QUERY_DESKTOP)
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY_DESKTOP).matches : true),
    () => true,
  )
}

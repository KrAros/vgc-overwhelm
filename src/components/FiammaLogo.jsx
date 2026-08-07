// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

// Fiamma SVG condivisa tra Header e Footer — unica fonte di verità.

export default function FiammaLogo({ size = 16 }) {
  return (
    <svg
      width={size}
      height={Math.round(size * 1.33)}
      viewBox="0 0 18 24"
      fill="none"
      aria-hidden="true"
    >
      <path d="M9 23 C3 20 1 14 3 9 C5 5 7 3 6 0 C9 4 8 8 10 10 C10 5 11 2 14 0 C14 6 12 9 14 12 C16 8 17 5 16 1 C19 6 18 13 15 18 C17 14 18 10 16 6 C18 11 17 18 13 21 C11 22 9 23 9 23 Z" fill="#F97316"/>
      <path d="M9 21 C5 18 4 13 5 9 C6 6 8 5 7 2 C9 5 8 8 10 10 C10 6 11 3 13 1 C13 6 11 9 13 12 C14 9 15 6 15 2 C17 6 16 12 14 16 C15 13 16 10 15 7 C16 11 15 17 12 20 C11 21 9 21 9 21 Z" fill="#FACC15"/>
      <path d="M9 18 C7 16 6 12 7 9 C8 7 9 6 9 4 C10 6 10 8 11 10 C11 7 12 5 13 3 C13 7 12 9 13 12 C14 10 14 7 14 5 C15 8 14 13 12 16 C11 17 10 18 9 18 Z" fill="rgba(255,255,255,0.55)"/>
    </svg>
  )
}
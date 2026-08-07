// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 KrAros

export const NATURES = [
  'adamant','bashful','bold','brave','calm','careful','docile',
  'gentle','hardy','hasty','impish','jolly','lax','lonely',
  'mild','modest','naive','naughty','quiet','quirky',
  'rash','relaxed','sassy','serious','timid'
].sort()

export const NATURE_MODIFIERS = {
  hardy:[0,0],bashful:[0,0],docile:[0,0],serious:[0,0],quirky:[0,0],
  lonely:[1,2],brave:[1,5],adamant:[1,3],naughty:[1,4],
  bold:[2,1],relaxed:[2,5],impish:[2,3],lax:[2,4],
  timid:[5,1],hasty:[5,2],jolly:[5,3],naive:[5,4],
  modest:[3,1],mild:[3,2],quiet:[3,5],rash:[3,4],
  calm:[4,1],gentle:[4,2],sassy:[4,5],careful:[4,3],
}
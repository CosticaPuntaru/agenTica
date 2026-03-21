import { describe, it, expect, beforeEach } from 'vitest'
import { createDaemonHooks, callStep } from './lifecycle'
import type { Hookable } from 'hookable'
import type { AgenTicaHookMap, LoopContext } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoopCtx(overrides?: Partial<LoopContext>): LoopContext {
  return { tick: 0, startedAt: new Date(), ...overrides }
}

// ── createDaemonHooks ─────────────────────────────────────────────────────────

describe('createDaemonHooks', () => {
  it('returns a hookable instance with hook and callHook methods', () => {
    const hooks = createDaemonHooks()
    expect(typeof hooks.hook).toBe('function')
    expect(typeof hooks.callHook).toBe('function')
  })
})

// ── callStep ──────────────────────────────────────────────────────────────────

describe('callStep', () => {
  let hooks: Hookable<AgenTicaHookMap>

  beforeEach(() => {
    hooks = createDaemonHooks()
  })

  it('pre-hook mutation is visible to subsequent hooks and reflected in ctx', async () => {
    hooks.hook('preLoop', (ctx) => {
      ctx.tick = 99
    })

    const ctx = makeLoopCtx({ tick: 0 })
    await callStep(hooks, 'preLoop', ctx)

    expect(ctx.tick).toBe(99)
  })

  it('post-hook mutation is reflected in final ctx', async () => {
    hooks.hook('postLoop', (ctx) => {
      ctx.tick = 42
    })

    const ctx = makeLoopCtx({ tick: 0 })
    await callStep(hooks, 'postLoop', ctx)

    expect(ctx.tick).toBe(42)
  })

  it('throws with step name when ctx is invalid before hooks (pre)', async () => {
    const ctx = { tick: 'not-a-number', startedAt: new Date() } as unknown as LoopContext

    await expect(callStep(hooks, 'preLoop', ctx)).rejects.toThrow('"preLoop"')
    await expect(callStep(hooks, 'preLoop', ctx)).rejects.toThrow('(pre)')
  })

  it('throws with step name when a hook mutates ctx to an invalid shape (post)', async () => {
    hooks.hook('preLoop', (ctx) => {
      ;(ctx as unknown as Record<string, unknown>).tick = 'not-a-number'
    })

    const ctx = makeLoopCtx()

    await expect(callStep(hooks, 'preLoop', ctx)).rejects.toThrow('"preLoop"')
    // The first call corrupts tick; reset for a clean post-phase check
    const ctx2 = makeLoopCtx()
    await expect(callStep(hooks, 'preLoop', ctx2)).rejects.toThrow('(post)')
  })

  it('propagates hook error with step name in message', async () => {
    hooks.hook('preLoop', () => {
      throw new Error('boom from hook')
    })

    const ctx = makeLoopCtx()

    await expect(callStep(hooks, 'preLoop', ctx)).rejects.toThrow('"preLoop"')
    await expect(callStep(hooks, 'preLoop', ctx)).rejects.toThrow('boom from hook')
  })

  it('does not throw when ctx is valid and no hooks are registered', async () => {
    const ctx = makeLoopCtx()
    await expect(callStep(hooks, 'preLoop', ctx)).resolves.toBeUndefined()
  })
})

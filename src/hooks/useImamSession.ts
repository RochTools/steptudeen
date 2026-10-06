import React, { useEffect } from 'react';
import { create, act } from 'react-test-renderer';
import { describe, it, expect, vi } from 'vitest';

const listeners = vi.hoisted(() => ({ auth: null as any, roles: [] as any[] }));
vi.mock('firebase/auth', () => ({ onAuthStateChanged: (_auth: any, callback: any) => { listeners.auth = callback; return () => {}; } }));
vi.mock('firebase/firestore', () => ({ doc: (...args: any[]) => args, onSnapshot: (_ref: any, _options: any, next: any, error: any) => { listeners.roles.push({ next, error }); return () => {}; } }));
import { useImamSession } from './src/hooks/useImamSession';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setup() {
  listeners.roles = [];
  const auth: any = { currentUser: null };
  const db: any = {};
  let state: any;
  let allowedTransitions = 0;
  function Probe() {
    state = useImamSession(auth, db);
    // This models the hasVerifiedImam dependency that triggers initFCM in App.
    useEffect(() => { if (state.allowed) allowedTransitions++; }, [state.allowed]);
    return null;
  }
  let root: any;
  act(() => { root = create(React.createElement(Probe)); });
  return {
    state: () => state,
    transitions: () => allowedTransitions,
    login(uid = 'imam-a', anonymous = false) {
      const user = { uid, isAnonymous: anonymous };
      act(() => { auth.currentUser = user; listeners.auth(user); });
    },
    logout() { act(() => { auth.currentUser = null; listeners.auth(null); }); },
    snapshot(role = 'imam', fromCache = false, hasPendingWrites = false, index = listeners.roles.length - 1, exists = true) {
      act(() => listeners.roles[index].next({ metadata: { fromCache, hasPendingWrites }, exists: () => exists, data: () => ({ role }) }));
    },
    error(index = listeners.roles.length - 1) { act(() => listeners.roles[index].error(new Error('permission-denied'))); },
    stop() { act(() => root.unmount()); },
  };
}

describe('Imam session regression', () => {
  it('does not authorize a fresh session from cached or pending role data', () => {
    const t = setup(); t.login();
    t.snapshot('imam', true); expect(t.state().allowed).toBe(false);
    t.snapshot('imam', false, true); expect(t.state().allowed).toBe(false);
    expect(t.state().ready).toBe(false);
    t.snapshot(); expect(t.state().allowed).toBe(true); t.stop();
  });
  it('100 FCM pending/ack cycles do not toggle login or retrigger FCM initialization', () => {
    const t = setup(); t.login(); t.snapshot();
    for (let i = 0; i < 100; i++) {
      t.snapshot('imam', false, true); expect(t.state().allowed).toBe(true);
      t.snapshot(); expect(t.state().allowed).toBe(true);
    }
    expect(t.transitions()).toBe(1); t.stop();
  });
  it('keeps confirmed UI state on cache metadata but revokes on confirmed role change', () => {
    const t = setup(); t.login(); t.snapshot();
    t.snapshot('imam', true); expect(t.state().allowed).toBe(true);
    t.snapshot('user'); expect(t.state().allowed).toBe(false); t.stop();
  });
  it('revokes if server deletes the profile', () => {
    const t = setup(); t.login(); t.snapshot();
    t.snapshot('imam', false, false, 0, false); expect(t.state().allowed).toBe(false); t.stop();
  });
  it('logout revokes access and rejects late role callbacks', () => {
    const t = setup(); t.login(); t.snapshot(); t.logout();
    t.snapshot(); expect(t.state().allowed).toBe(false); expect(t.state().user).toBeNull(); t.stop();
  });
  it('account switch cannot inherit old authorization or be changed by old listener errors', () => {
    const t = setup(); t.login(); t.snapshot(); t.login('imam-b');
    t.snapshot('imam', false, false, 0); expect(t.state().allowed).toBe(false);
    t.snapshot('imam', true); expect(t.state().allowed).toBe(false);
    t.snapshot(); expect(t.state().allowed).toBe(true);
    t.error(0); expect(t.state().allowed).toBe(true); t.stop();
  });
  it('denies access on current role listener error', () => {
    const t = setup(); t.login(); t.snapshot(); t.error(); expect(t.state().allowed).toBe(false); t.stop();
  });
  it('does not authorize anonymous Firebase accounts', () => {
    const t = setup(); t.login('guest', true); expect(t.state().allowed).toBe(false); expect(listeners.roles).toHaveLength(0); t.stop();
  });
});

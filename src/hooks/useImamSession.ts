import { useEffect, useState } from 'react';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';

/** UI gate only. Firestore rules enforce the same authorization on the server. */
export function useImamSession(auth: Auth | null, db: Firestore | null) {
  const [state, setState] = useState<{ user: User | null; ready: boolean; allowed: boolean }>({ user: null, ready: false, allowed: false });
  useEffect(() => {
    let disposed = false;
    let generation = 0;
    let stopRole: (() => void) | undefined;
    setState({ user: null, ready: false, allowed: false });
    if (!auth || !db) {
      setState({ user: null, ready: true, allowed: false });
      return;
    }
    const stopAuth = onAuthStateChanged(auth, user => {
      const version = ++generation;
      stopRole?.();
      setState({ user, ready: !user || user.isAnonymous, allowed: false });
      if (!user || user.isAnonymous) return;
      stopRole = onSnapshot(doc(db, 'users', user.uid), { includeMetadataChanges: true }, snapshot => {
        if (disposed || version !== generation || auth.currentUser?.uid !== user.uid) return;
        // A locally modified/cached role is not proof of authorization.
        const confirmed = !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
        setState({ user, ready: true, allowed: confirmed && snapshot.data()?.role === 'imam' });
      }, () => {
        if (!disposed && version === generation) setState({ user, ready: true, allowed: false });
      });
    }, () => setState({ user: null, ready: true, allowed: false }));
    return () => { disposed = true; generation++; stopRole?.(); stopAuth(); };
  }, [auth, db]);
  return { ...state, allowed: state.allowed && !!state.user && !state.user.isAnonymous && auth?.currentUser?.uid === state.user.uid };
}

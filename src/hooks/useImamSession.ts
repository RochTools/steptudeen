import { useEffect, useState } from 'react';
import { onAuthStateChanged, type Auth, type User } from 'firebase/auth';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';

type ImamSession = { user: User | null; ready: boolean; allowed: boolean };

/** UI gate only. Firestore rules enforce authorization on every server write. */
export function useImamSession(auth: Auth | null, db: Firestore | null) {
  const [state, setState] = useState<ImamSession>({ user: null, ready: false, allowed: false });

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
      if (disposed) return;
      const version = ++generation;
      stopRole?.();
      stopRole = undefined;

      // A new auth session must be verified independently. Never trust storage.
      setState({ user, ready: !user || user.isAnonymous, allowed: false });
      if (!user || user.isAnonymous) return;

      stopRole = onSnapshot(
        doc(db, 'users', user.uid),
        { includeMetadataChanges: true },
        snapshot => {
          if (disposed || version !== generation || auth.currentUser?.uid !== user.uid) return;

          // FCM/profile writes emit a pending snapshot, followed by a server
          // acknowledgement. Neither pending writes nor cache-only snapshots
          // can grant a role OR revoke the last server-confirmed UI state.
          // In particular, do not flip allowed false/true on each FCM write:
          // App would initialize FCM again, causing an endless feedback loop.
          if (snapshot.metadata.fromCache || snapshot.metadata.hasPendingWrites) return;

          const allowed = snapshot.exists() && snapshot.data()?.role === 'imam';
          setState(previous => {
            // Ignore non-role server changes (FCM token, timestamp, name, etc.).
            if (previous.user === user && previous.ready && previous.allowed === allowed) return previous;
            return { user, ready: true, allowed };
          });
        },
        () => {
          if (disposed || version !== generation || auth.currentUser?.uid !== user.uid) return;
          setState({ user, ready: true, allowed: false });
        }
      );
    }, () => {
      if (disposed) return;
      generation++;
      stopRole?.();
      stopRole = undefined;
      setState({ user: null, ready: true, allowed: false });
    });

    return () => {
      disposed = true;
      generation++;
      stopRole?.();
      stopAuth();
    };
  }, [auth, db]);

  return {
    ...state,
    allowed: state.allowed && !!state.user && !state.user.isAnonymous
      && auth?.currentUser?.uid === state.user.uid,
  };
}
